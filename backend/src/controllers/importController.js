const XLSX = require('xlsx');
const { MacroProceso, Proceso, SubProceso, TipoDocumentacion, Documento } = require('../models');
const { sequelize } = require('../config/database');
const fs = require('fs');

const importFromExcel = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó archivo Excel'
      });
    }

    console.log('📁 Procesando archivo:', req.file.originalname);

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      await transaction.rollback();
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'El archivo Excel está vacío'
      });
    }

    console.log(`📊 Total de filas: ${data.length}`);

    const results = {
      total: data.length,
      importados: 0,
      actualizados: 0,
      errores: []
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // +2 porque Excel empieza en 1 y la primera fila son headers

      try {
        // Validar campos requeridos
        if (!row.macro_proceso || !row.proceso || !row.subproceso || !row.tipo_documentacion || !row.codigo || !row.titulo) {
          results.errores.push({
            fila: rowNumber,
            error: 'Faltan campos requeridos (macro_proceso, proceso, subproceso, tipo_documentacion, codigo, titulo)'
          });
          continue;
        }

        // Crear o encontrar Macro Proceso
        const [macroProceso] = await MacroProceso.findOrCreate({
          where: { nombre: String(row.macro_proceso).trim() },
          defaults: { nombre: String(row.macro_proceso).trim() },
          transaction
        });

        // Crear o encontrar Proceso
        const [proceso] = await Proceso.findOrCreate({
          where: { 
            nombre: String(row.proceso).trim(),
            macro_proceso_id: macroProceso.id 
          },
          defaults: { 
            nombre: String(row.proceso).trim(),
            macro_proceso_id: macroProceso.id 
          },
          transaction
        });

        // Crear o encontrar Subproceso
        const [subproceso] = await SubProceso.findOrCreate({
          where: { 
            nombre: String(row.subproceso).trim(),
            proceso_id: proceso.id 
          },
          defaults: { 
            nombre: String(row.subproceso).trim(),
            proceso_id: proceso.id 
          },
          transaction
        });

        // Crear o encontrar Tipo de Documentación
        const [tipoDoc] = await TipoDocumentacion.findOrCreate({
          where: { nombre: String(row.tipo_documentacion).trim() },
          defaults: { nombre: String(row.tipo_documentacion).trim() },
          transaction
        });

        // Preparar datos del documento
        const documentoData = {
          subproceso_id: subproceso.id,
          tipo_documentacion_id: tipoDoc.id,
          codigo: String(row.codigo).trim(),
          titulo: String(row.titulo).trim(),
          version: row.version ? String(row.version).trim() : null,
          fecha_creacion: row.fecha_creacion || null,
          revisa: row.revisa ? String(row.revisa).trim() : null,
          aprueba: row.aprueba ? String(row.aprueba).trim() : null,
          fecha_aprobacion: row.fecha_aprobacion || null,
          autor: row.autor ? String(row.autor).trim() : null,
          estado: row.estado ? String(row.estado).toLowerCase().trim() : 'vigente',
          link_acceso: row.link_acceso ? String(row.link_acceso).trim() : null
        };

        // Validar estado
        if (!['vigente', 'obsoleto', 'en_revision'].includes(documentoData.estado)) {
          documentoData.estado = 'vigente';
        }

        // Verificar si ya existe
        const existente = await Documento.findOne({
          where: { codigo: documentoData.codigo },
          transaction
        });

        if (existente) {
          // Actualizar
          await existente.update(documentoData, { transaction });
          results.actualizados++;
        } else {
          // Crear nuevo
          await Documento.create(documentoData, { transaction });
          results.importados++;
        }

        console.log(`✓ Fila ${rowNumber}: ${documentoData.codigo} - ${documentoData.titulo}`);

      } catch (error) {
        console.error(`✗ Error en fila ${rowNumber}:`, error.message);
        results.errores.push({
          fila: rowNumber,
          error: error.message
        });
      }
    }

    await transaction.commit();
    fs.unlinkSync(req.file.path);

    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║  ✅ IMPORTACIÓN COMPLETADA            ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║  Total filas: ${results.total}`.padEnd(41) + '║');
    console.log(`║  Importados: ${results.importados}`.padEnd(41) + '║');
    console.log(`║  Actualizados: ${results.actualizados}`.padEnd(41) + '║');
    console.log(`║  Errores: ${results.errores.length}`.padEnd(41) + '║');
    console.log('╚════════════════════════════════════════╝');

    res.json({
      success: true,
      message: `Importación completada: ${results.importados} nuevos, ${results.actualizados} actualizados de ${results.total} registros`,
      data: results
    });

  } catch (error) {
    await transaction.rollback();
    
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('❌ Error en importación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al importar archivo Excel',
      error: error.message
    });
  }
};

const downloadTemplate = (req, res) => {
  try {
    const templateData = [{
      macro_proceso: 'Gestión Estratégica',
      proceso: 'Planeación Estratégica',
      subproceso: 'Formulación de Objetivos',
      tipo_documentacion: 'Manual',
      codigo: 'MAN-GE-001',
      titulo: 'Manual de Planeación Estratégica',
      version: '1.0',
      fecha_creacion: '2024-01-15',
      revisa: 'Juan Pérez',
      aprueba: 'María González',
      fecha_aprobacion: '2024-01-20',
      autor: 'Departamento de Planeación',
      estado: 'vigente',
      link_acceso: 'https://drive.google.com/file/d/ejemplo'
    }];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Ajustar ancho de columnas
    worksheet['!cols'] = [
      { wch: 25 }, // macro_proceso
      { wch: 30 }, // proceso
      { wch: 30 }, // subproceso
      { wch: 20 }, // tipo_documentacion
      { wch: 15 }, // codigo
      { wch: 40 }, // titulo
      { wch: 10 }, // version
      { wch: 15 }, // fecha_creacion
      { wch: 25 }, // revisa
      { wch: 25 }, // aprueba
      { wch: 18 }, // fecha_aprobacion
      { wch: 30 }, // autor
      { wch: 15 }, // estado
      { wch: 50 }  // link_acceso
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Documentos');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_documentos_sgc.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error al generar plantilla:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar plantilla'
    });
  }
};

module.exports = { importFromExcel, downloadTemplate };