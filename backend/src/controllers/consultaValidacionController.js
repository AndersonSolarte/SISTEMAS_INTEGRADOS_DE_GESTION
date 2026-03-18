const { Op } = require('sequelize');
const XLSX = require('xlsx');
const SaberProResultadoIndividual = require('../models/SaberProResultadoIndividual');

/* ─────────────────────────────────────────────
   A. CONSULTA INDIVIDUAL POR DOCUMENTO
───────────────────────────────────────────── */
const consultaIndividual = async (req, res) => {
  try {
    const { documento } = req.query;
    if (!documento || !documento.toString().trim()) {
      return res.status(400).json({ success: false, message: 'El número de documento es requerido.' });
    }

    const doc = documento.toString().trim();

    const registros = await SaberProResultadoIndividual.findAll({
      where: { documento: doc },
      order: [['anio', 'DESC'], ['periodo', 'DESC']],
      attributes: [
        'id', 'documento', 'tipo_documento', 'nombre', 'programa',
        'tipo_prueba', 'anio', 'periodo', 'periodo_icfes',
        'puntaje_global', 'percentil_nacional_global', 'percentil_grupo_referencia',
        'numero_registro', 'modulo', 'puntaje_modulo', 'nivel_desempeno',
        'percentil_nacional_modulo', 'novedades', 'grupo_referencia',
        'competencias', 'modalidad', 'lugar_presentacion'
      ]
    });

    if (!registros.length) {
      return res.status(404).json({ success: false, message: `No se encontraron resultados para el documento ${doc}.` });
    }

    /* Agrupar por presentación (año+periodo+tipo_prueba) */
    const presentaciones = {};
    for (const r of registros) {
      const key = `${r.anio}-${r.periodo}-${r.tipo_prueba}`;
      if (!presentaciones[key]) {
        presentaciones[key] = {
          anio: r.anio,
          periodo: r.periodo,
          periodo_icfes: r.periodo_icfes,
          tipo_prueba: r.tipo_prueba,
          documento: r.documento,
          tipo_documento: r.tipo_documento,
          nombre: r.nombre,
          programa: r.programa,
          grupo_referencia: r.grupo_referencia,
          puntaje_global: r.puntaje_global,
          percentil_nacional_global: r.percentil_nacional_global,
          percentil_grupo_referencia: r.percentil_grupo_referencia,
          numero_registro: r.numero_registro,
          novedades: r.novedades,
          modalidad: r.modalidad,
          lugar_presentacion: r.lugar_presentacion,
          competencias: []
        };
      }
      if (r.modulo) {
        presentaciones[key].competencias.push({
          modulo: r.modulo,
          puntaje: r.puntaje_modulo,
          nivel_desempeno: r.nivel_desempeno,
          percentil_nacional: r.percentil_nacional_modulo,
          competencias: r.competencias
        });
      }
    }

    return res.json({ success: true, presentaciones: Object.values(presentaciones) });
  } catch (err) {
    console.error('[consultaIndividual]', err);
    return res.status(500).json({ success: false, message: 'Error interno al consultar.' });
  }
};

/* ─────────────────────────────────────────────
   B. VALIDACIÓN MASIVA (ARCHIVO EXCEL / CSV)
───────────────────────────────────────────── */
const consultaMasiva = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se recibió ningún archivo.' });
    }

    /* Leer archivo con xlsx */
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'El archivo está vacío o no tiene filas de datos.' });
    }

    /* Detectar columna de documento (flexible) */
    const DOCUMENT_KEYS = ['documento', 'Documento', 'DOCUMENTO', 'cedula', 'Cedula', 'CEDULA',
      'num_documento', 'numero_documento', 'doc', 'id'];
    const firstRow = rows[0];
    const docKey = DOCUMENT_KEYS.find((k) => k in firstRow) || Object.keys(firstRow)[0];

    /* Extraer documentos únicos */
    const rawDocs = rows.map((r) => String(r[docKey] || '').trim()).filter(Boolean);
    const uniqueDocs = [...new Set(rawDocs)];

    if (!uniqueDocs.length) {
      return res.status(400).json({ success: false, message: `No se encontró columna de documento. Se detectó: ${Object.keys(firstRow).join(', ')}` });
    }

    /* Buscar en BD — traer TODOS los registros por documento */
    const found = await SaberProResultadoIndividual.findAll({
      where: { documento: { [Op.in]: uniqueDocs } },
      attributes: [
        'documento', 'nombre', 'programa', 'tipo_prueba',
        'anio', 'periodo', 'puntaje_global', 'percentil_nacional_global',
        'numero_registro', 'novedades', 'grupo_referencia'
      ],
      order: [['anio', 'DESC'], ['periodo', 'DESC']]
    });

    /* Index: documento → TODOS sus registros */
    const foundMap = {};
    for (const r of found) {
      if (!foundMap[r.documento]) foundMap[r.documento] = [];
      foundMap[r.documento].push(r);
    }

    /* Une valores únicos de un campo entre múltiples registros */
    const joinUniq = (arr, key) => {
      const vals = [...new Set(arr.map((m) => String(m[key] ?? '').trim()).filter(Boolean))];
      return vals.length ? vals.join(' ; ') : '—';
    };

    /* Construye sub-registros estructurados agrupados por (año+periodo+tipo_prueba) */
    const buildSubRecords = (matches) => {
      if (!matches || !matches.length) return [];
      const seen = new Set();
      const subs = [];
      for (const m of matches) {
        const key = `${m.anio}||${m.periodo}||${String(m.tipo_prueba || '').toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const hasAlert = !!(m.novedades && String(m.novedades).trim()) || parseFloat(m.puntaje_global) === 0;
        subs.push({
          tipo_prueba:     m.tipo_prueba || '',
          anio:            String(m.anio ?? ''),
          periodo:         String(m.periodo ?? ''),
          puntaje_global:  m.puntaje_global,
          numero_registro: m.numero_registro || '',
          observaciones:   m.novedades || '',
          hasAlert
        });
      }
      return subs;
    };

    /* Construir resultado preservando orden del archivo y duplicados */
    const seen = {};
    const resultado = rawDocs.map((doc, idx) => {
      const isDup = seen[doc];
      seen[doc] = true;
      const matches = foundMap[doc];
      const hasValidar = matches?.some(
        (m) => (m.novedades && m.novedades.trim()) || parseFloat(m.puntaje_global) === 0
      );
      return {
        fila: idx + 2,
        documento: doc,
        nombre:          matches ? joinUniq(matches, 'nombre')                    : '—',
        programa:        matches ? joinUniq(matches, 'programa')                  : '—',
        tipo_prueba:     matches ? joinUniq(matches, 'tipo_prueba')               : '—',
        anio:            matches ? joinUniq(matches, 'anio')                      : '—',
        periodo:         matches ? joinUniq(matches, 'periodo')                   : '—',
        puntaje_global:  matches ? joinUniq(matches, 'puntaje_global')            : '—',
        numero_registro: matches ? joinUniq(matches, 'numero_registro')           : '—',
        observaciones:   matches
          ? [...new Set(matches.map((m) => (m.novedades || '').trim()).filter(Boolean))].join(' ; ') || '—'
          : '—',
        subrecords: buildSubRecords(matches),
        estado: !matches
          ? 'No encontrado'
          : isDup
            ? 'Duplicado'
            : hasValidar
              ? 'Validar información'
              : 'Encontrado'
      };
    });

    const stats = {
      total:            resultado.length,
      encontrados:      resultado.filter((r) => r.estado === 'Encontrado').length,
      validar:          resultado.filter((r) => r.estado === 'Validar información').length,
      duplicados:       resultado.filter((r) => r.estado === 'Duplicado').length,
      noEncontrados:    resultado.filter((r) => r.estado === 'No encontrado').length
    };

    return res.json({ success: true, resultado, stats, columnaDetectada: docKey });
  } catch (err) {
    console.error('[consultaMasiva]', err);
    return res.status(500).json({ success: false, message: 'Error procesando el archivo.' });
  }
};

module.exports = { consultaIndividual, consultaMasiva };
