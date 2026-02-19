const XLSX = require('xlsx');
const { MacroProceso, Proceso, SubProceso, TipoDocumentacion, Documento } = require('../models');
const fs = require('fs');

const toText = (value, maxLength = null) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return maxLength ? text.slice(0, maxLength) : text;
};

const normalizeEstado = (value) => {
  const estado = toText(value)?.toLowerCase();
  if (!estado) return 'vigente';
  if (estado === 'activo' || estado === 'activos') return 'vigente';
  if (['vigente', 'obsoleto', 'en_revision'].includes(estado)) return estado;
  return 'vigente';
};

const excelDateToISO = (value) => {
  if (!value && value !== 0) return null;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const y = String(parsed.y).padStart(4, '0');
    const m = String(parsed.m).padStart(2, '0');
    const d = String(parsed.d).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const text = toText(value);
  return text || null;
};

const normalizeMappedFields = (row) => {
  let tipoDocumentacion = toText(row.tipo_documentacion, 200);
  let codigo = toText(row.codigo, 50);
  let titulo = toText(row.titulo, 300);

  const rawTipo = toText(row.tipo_documentacion);
  const rawCodigo = toText(row.codigo);
  const rawTitulo = toText(row.titulo);
  const codigoDemasiadoLargo = rawCodigo && rawCodigo.length > 50;

  if (codigoDemasiadoLargo && rawTipo && rawTitulo) {
    codigo = toText(rawTipo, 50);
    titulo = toText(rawCodigo, 300);
    tipoDocumentacion = toText(rawTitulo, 200);
  }

  return { tipoDocumentacion, codigo, titulo };
};

const importFromExcel = async (req, res) => {
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
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });

    if (data.length === 0) {
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
        const { tipoDocumentacion, codigo, titulo } = normalizeMappedFields(row);

        // Validar campos requeridos
        if (!row.macro_proceso || !row.proceso || !row.subproceso || !tipoDocumentacion || !codigo || !titulo) {
          results.errores.push({
            fila: rowNumber,
            error: 'Faltan campos requeridos (macro_proceso, proceso, subproceso, tipo_documentacion, codigo, titulo)'
          });
          continue;
        }

        // Crear o encontrar Macro Proceso
        const [macroProceso] = await MacroProceso.findOrCreate({
          where: { nombre: toText(row.macro_proceso, 255) },
          defaults: { nombre: toText(row.macro_proceso, 255) }
        });

        // Crear o encontrar Proceso
        const [proceso] = await Proceso.findOrCreate({
          where: { 
            nombre: toText(row.proceso, 255),
            macro_proceso_id: macroProceso.id 
          },
          defaults: { 
            nombre: toText(row.proceso, 255),
            macro_proceso_id: macroProceso.id 
          }
        });

        // Crear o encontrar Subproceso
        const [subproceso] = await SubProceso.findOrCreate({
          where: { 
            nombre: toText(row.subproceso, 255),
            proceso_id: proceso.id 
          },
          defaults: { 
            nombre: toText(row.subproceso, 255),
            proceso_id: proceso.id 
          }
        });

        // Crear o encontrar Tipo de Documentación
        const [tipoDoc] = await TipoDocumentacion.findOrCreate({
          where: { nombre: tipoDocumentacion },
          defaults: { nombre: tipoDocumentacion }
        });

        // Preparar datos del documento
        const documentoData = {
          subproceso_id: subproceso.id,
          tipo_documentacion_id: tipoDoc.id,
          codigo,
          titulo,
          version: toText(row.version, 20),
          fecha_creacion: excelDateToISO(row.fecha_creacion),
          revisa: toText(row.revisa, 200),
          aprueba: toText(row.aprueba, 200),
          fecha_aprobacion: excelDateToISO(row.fecha_aprobacion),
          autor: toText(row.autor, 200),
          estado: normalizeEstado(row.estado),
          link_acceso: toText(row.link_acceso)
        };

        // Verificar si ya existe
        const existente = await Documento.findOne({
          where: { codigo: documentoData.codigo }
        });

        if (existente) {
          // Actualizar
          await existente.update(documentoData);
          results.actualizados++;
        } else {
          // Crear nuevo
          await Documento.create(documentoData);
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
