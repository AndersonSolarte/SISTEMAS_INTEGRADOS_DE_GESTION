const XLSX = require('xlsx');
const { google } = require('googleapis');
const path = require('path');
const { MacroProceso, Proceso, SubProceso, TipoDocumentacion, Documento, GestionInformacionCarga } = require('../models');
const fs = require('fs');
const MAX_DOCUMENT_IMPORT_ROWS = Number(process.env.MAX_DOCUMENT_IMPORT_ROWS || 10000);
const GOOGLE_SHEETS_PUBLIC_TIMEOUT_MS = Number(process.env.GOOGLE_SHEETS_PUBLIC_TIMEOUT_MS || 15000);

const toText = (value, maxLength = null) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return maxLength ? text.slice(0, maxLength) : text;
};

const normalizeEstado = (value) => {
  const estado = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (['activo', 'activos', 'activa', 'activas', 'vigente', 'vigentes'].includes(estado)) return 'vigente';
  if (['revision', 'en revision', 'en_revision', 'pendiente aprobacion', 'pendiente de aprobacion'].includes(estado)) return 'en_revision';
  return 'obsoleto';
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
  if (!text) return null;

  const normalized = text.toLowerCase();
  if (normalized === 'invalid date' || normalized === 'nan' || normalized === 'undefined' || normalized === 'null') {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const dashMatch = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, d, m, y] = dashMatch;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const parsedDate = new Date(text);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return parsedDate.toISOString().slice(0, 10);
};

const normalizeHeader = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

const HEADER_ALIASES = {
  macroproceso: 'macro_proceso',
  macro_proceso: 'macro_proceso',
  proceso: 'proceso',
  subproceso: 'subproceso',
  codigo: 'codigo',
  titulo_documento: 'titulo',
  titulo: 'titulo',
  tipo_documento: 'tipo_documentacion',
  tipo_documentacion: 'tipo_documentacion',
  version: 'version',
  version_: 'version',
  fecha_creacion: 'fecha_creacion',
  revisa: 'revisa',
  aprueba: 'aprueba',
  fecha_aprobacion: 'fecha_aprobacion',
  autor: 'autor',
  estado: 'estado',
  link_acceso: 'link_acceso',
  observaciones: 'observaciones'
};

const mapRowKeys = (row = {}) => {
  const mapped = {};
  Object.entries(row).forEach(([key, value]) => {
    const normalized = normalizeHeader(key);
    const target = HEADER_ALIASES[normalized] || normalized;
    mapped[target] = value;
  });
  return mapped;
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

const getDocumentIdentityKey = (codigo, version) =>
  `${toText(codigo, 50) || ''}::${toText(version, 20) || ''}`;

const comparableValue = (value) => {
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
};

const documentNeedsUpdate = (documento, nextData) => {
  const fields = [
    'subproceso_id',
    'tipo_documentacion_id',
    'macroproceso',
    'proceso_texto',
    'subproceso_texto',
    'tipo_documento',
    'codigo',
    'titulo',
    'version',
    'fecha_creacion',
    'revisa',
    'aprueba',
    'fecha_aprobacion',
    'autor',
    'estado',
    'link_acceso',
    'observaciones',
    'datos_originales'
  ];

  return fields.some((field) => comparableValue(documento.get(field)) !== comparableValue(nextData[field]));
};

const buildExistingDocumentBuckets = async () => {
  const buckets = new Map();
  const documents = await Documento.findAll({ order: [['id', 'ASC']] });
  documents.forEach((doc) => {
    const key = getDocumentIdentityKey(doc.codigo, doc.version);
    if (key.startsWith('::')) return;
    const bucket = buckets.get(key) || [];
    bucket.push(doc);
    buckets.set(key, bucket);
  });
  return buckets;
};

const nextDocumentOccurrence = (occurrences, key) => {
  const index = occurrences.get(key) || 0;
  occurrences.set(key, index + 1);
  return index;
};

const buildSyncMessage = ({ mode, results }) => {
  if (mode === 'incremental') {
    return `Servidor actualizado desde Sheets: ${results.importados} nuevos, ${results.actualizados} actualizados, ${results.omitidos} sin cambios, ${results.errores.length} con error de ${results.total} registros`;
  }

  return `Servidor actualizado desde Sheets sin eliminar registros: ${results.importados} nuevos, ${results.actualizados} actualizados, ${results.omitidos} sin cambios, ${results.errores.length} con error de ${results.total} registros`;
};

const extractSpreadsheetId = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const sheetIdPattern = /^[a-zA-Z0-9-_]{20,}$/;
  if (sheetIdPattern.test(raw)) return raw;

  try {
    const parsed = new URL(raw);
    const fromPath = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i)?.[1];
    if (fromPath) return fromPath;
    const fromQuery = parsed.searchParams.get('id');
    if (fromQuery && sheetIdPattern.test(fromQuery)) return fromQuery;
  } catch (_error) {
    return '';
  }

  return '';
};

const extractSheetGid = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (/^\d+$/.test(raw)) return raw;

  try {
    const parsed = new URL(raw);
    return parsed.searchParams.get('gid') || '';
  } catch (_error) {
    return '';
  }
};

const getGoogleCredentialsPath = () => (
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    ? path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    : path.join(__dirname, '../../keys/google-service-account.json')
);

const parseSheetMatrix = (values = []) => {
  if (values.length < 2) {
    return { success: false, status: 400, message: 'La hoja no tiene datos suficientes' };
  }

  const headers = values[0].map(normalizeHeader);
  const data = values
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || '').trim() !== ''))
    .map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        if (!header) return;
        const target = HEADER_ALIASES[header] || header;
        obj[target] = row[index] ?? null;
      });
      return obj;
    });

  if (data.length === 0) {
    return { success: false, status: 400, message: 'La hoja no tiene filas con datos' };
  }

  if (data.length > MAX_DOCUMENT_IMPORT_ROWS) {
    return {
      success: false,
      status: 400,
      message: `La hoja supera el límite permitido (${MAX_DOCUMENT_IMPORT_ROWS} filas)`
    };
  }

  return { success: true, data };
};

const readWorksheetMatrix = (worksheet) => XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

const readWorkbookBuffer = (buffer, preferredSheetName) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const worksheet = workbook.Sheets[preferredSheetName] || workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) {
    throw new Error('No se encontró ninguna hoja utilizable en el archivo descargado');
  }
  return readWorksheetMatrix(worksheet);
};

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GOOGLE_SHEETS_PUBLIC_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'SGC-Importer/1.0',
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const readPublicGoogleSheet = async ({ sheetId, sheetName, sheetGid }) => {
  const candidates = [
    {
      label: 'csv-sheet',
      url: `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`,
      parse: async (response) => {
        const csvText = await response.text();
        const workbook = XLSX.read(csvText, { type: 'string' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!worksheet) throw new Error('No se pudo interpretar el CSV público de Google Sheets');
        return readWorksheetMatrix(worksheet);
      }
    },
    {
      label: 'xlsx-export',
      url: `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`,
      parse: async (response) => {
        const arrayBuffer = await response.arrayBuffer();
        return readWorkbookBuffer(Buffer.from(arrayBuffer), sheetName);
      }
    }
  ];

  if (sheetGid) {
    candidates.unshift({
      label: 'csv-gid',
      url: `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${encodeURIComponent(sheetGid)}`,
      parse: async (response) => {
        const csvText = await response.text();
        const workbook = XLSX.read(csvText, { type: 'string' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!worksheet) throw new Error('No se pudo interpretar el CSV público de Google Sheets');
        return readWorksheetMatrix(worksheet);
      }
    });
  }

  const errors = [];
  for (const candidate of candidates) {
    try {
      const response = await fetchWithTimeout(candidate.url);
      if (!response.ok) {
        errors.push(`${candidate.label}: HTTP ${response.status}`);
        continue;
      }

      const values = await candidate.parse(response);
      if (Array.isArray(values) && values.length > 0) {
        return { values, source: `public:${candidate.label}` };
      }

      errors.push(`${candidate.label}: sin contenido utilizable`);
    } catch (error) {
      errors.push(`${candidate.label}: ${error.message}`);
    }
  }

  const error = new Error('No fue posible leer la hoja por acceso público');
  error.details = errors;
  throw error;
};

const readGoogleSheetValues = async ({ sheetId, sheetName, sheetGid }) => {
  const credentialsPath = getGoogleCredentialsPath();
  const diagnostics = [];

  if (fs.existsSync(credentialsPath)) {
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly'
      ]
    });

    try {
      const sheets = google.sheets({ version: 'v4', auth });
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A1:Z`
      });

      return {
        values: response?.data?.values || [],
        source: 'service_account',
        credentialsPath
      };
    } catch (sheetError) {
      const apiMessage = sheetError?.response?.data?.error?.message || sheetError?.message || 'Error no identificado';
      const statusCode = Number(sheetError?.response?.status || 0);
      diagnostics.push(`service_account: ${apiMessage}`);

      if (/not supported for this document/i.test(apiMessage)) {
        try {
          const drive = google.drive({ version: 'v3', auth });
          const driveResponse = await drive.files.get(
            { fileId: sheetId, alt: 'media' },
            { responseType: 'arraybuffer' }
          );

          return {
            values: readWorkbookBuffer(Buffer.from(driveResponse.data), sheetName),
            source: 'drive_file',
            credentialsPath
          };
        } catch (driveError) {
          diagnostics.push(`drive_file: ${driveError?.message || 'No se pudo descargar el archivo desde Drive'}`);
        }
      } else if (statusCode === 404 || /unable to parse range|requested entity was not found/i.test(apiMessage)) {
        const error = new Error(`No se encontró la hoja o pestaña configurada (${sheetName})`);
        error.status = 404;
        error.detail = `Verifica GOOGLE_SHEETS_ID y GOOGLE_SHEETS_TAB. Pestaña actual: ${sheetName}`;
        throw error;
      } else if (statusCode === 403 || /permission|not have permission|insufficient/i.test(apiMessage)) {
        diagnostics.push('service_account_permission: comparte la hoja con el client_email de la cuenta de servicio o publícala para acceso público');
      }
    }
  } else {
    diagnostics.push(`service_account: no existe el archivo de credenciales en ${credentialsPath}`);
  }

  try {
    return {
      ...(await readPublicGoogleSheet({ sheetId, sheetName, sheetGid })),
      credentialsPath
    };
  } catch (publicError) {
    diagnostics.push(...(publicError.details || [`public_access: ${publicError.message}`]));
  }

  const error = new Error('No se pudo acceder a Google Sheets con ninguno de los métodos configurados');
  error.status = 500;
  error.detail = diagnostics.join(' | ');
  throw error;
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

    if (data.length > MAX_DOCUMENT_IMPORT_ROWS) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: `El archivo supera el límite permitido (${MAX_DOCUMENT_IMPORT_ROWS} filas)`
      });
    }

    console.log(`📊 Total de filas: ${data.length}`);

    const results = {
      total: data.length,
      importados: 0,
      actualizados: 0,
      errores: []
    };
    const existingDocumentBuckets = await buildExistingDocumentBuckets();
    const occurrenceIndexes = new Map();

    for (let i = 0; i < data.length; i++) {
      const row = mapRowKeys(data[i]);
      const rowNumber = i + 2; // +2 porque Excel empieza en 1 y la primera fila son headers

      try {
        const { tipoDocumentacion, codigo, titulo } = normalizeMappedFields(row);

        // Validar campos requeridos
        if (!codigo && !titulo) {
          results.errores.push({
            fila: rowNumber,
            error: 'Faltan campos requeridos (codigo o titulo)'
          });
          continue;
        }

        const macroNombre = toText(row.macro_proceso, 255) || 'SIN DEFINIR';
        const procesoNombre = toText(row.proceso, 255) || 'SIN DEFINIR';
        const subprocesoNombre = toText(row.subproceso, 255) || 'SIN DEFINIR';
        const tipoNombre = tipoDocumentacion || 'SIN TIPO';
        const codigoFinal = codigo || `SIN-CODIGO-${rowNumber}`;
        const tituloFinal = titulo || codigoFinal;

        // Crear o encontrar Macro Proceso
        const [macroProceso] = await MacroProceso.findOrCreate({
          where: { nombre: macroNombre },
          defaults: { nombre: macroNombre }
        });

        // Crear o encontrar Proceso
        const [proceso] = await Proceso.findOrCreate({
          where: { 
            nombre: procesoNombre,
            macro_proceso_id: macroProceso.id 
          },
          defaults: { 
            nombre: procesoNombre,
            macro_proceso_id: macroProceso.id 
          }
        });

        // Crear o encontrar Subproceso
        const [subproceso] = await SubProceso.findOrCreate({
          where: { 
            nombre: subprocesoNombre,
            proceso_id: proceso.id 
          },
          defaults: { 
            nombre: subprocesoNombre,
            proceso_id: proceso.id 
          }
        });

        // Crear o encontrar Tipo de Documentación
        const [tipoDoc] = await TipoDocumentacion.findOrCreate({
          where: { nombre: tipoNombre },
          defaults: { nombre: tipoNombre }
        });

        // Preparar datos del documento
        const documentoData = {
          subproceso_id: subproceso.id,
          tipo_documentacion_id: tipoDoc.id,
          macroproceso: macroNombre,
          proceso_texto: procesoNombre,
          subproceso_texto: subprocesoNombre,
          tipo_documento: tipoNombre,
          codigo: codigoFinal,
          titulo: tituloFinal,
          version: toText(row.version, 20),
          fecha_creacion: excelDateToISO(row.fecha_creacion),
          revisa: toText(row.revisa, 200),
          aprueba: toText(row.aprueba, 200),
          fecha_aprobacion: excelDateToISO(row.fecha_aprobacion),
          autor: toText(row.autor, 200),
          estado: normalizeEstado(row.estado),
          link_acceso: toText(row.link_acceso),
          observaciones: toText(row.observaciones),
          datos_originales: data[i]
        };

        const documentKey = getDocumentIdentityKey(documentoData.codigo, documentoData.version);
        const occurrenceIndex = nextDocumentOccurrence(occurrenceIndexes, documentKey);
        const existente = existingDocumentBuckets.get(documentKey)?.[occurrenceIndex] || null;

        if (existente) {
          // Actualizar
          await existente.update(documentoData);
          results.actualizados++;
        } else {
          // Crear nuevo
          const nuevoDocumento = await Documento.create(documentoData);
          const bucket = existingDocumentBuckets.get(documentKey) || [];
          bucket.push(nuevoDocumento);
          existingDocumentBuckets.set(documentKey, bucket);
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

    const totalProcesados = Number(results.importados || 0) + Number(results.actualizados || 0);
    const porcentaje = results.total > 0 ? Number(((totalProcesados / results.total) * 100).toFixed(2)) : 0;
    const estadoCarga = porcentaje === 100 ? 'exitoso' : (totalProcesados > 0 ? 'parcial' : 'fallido');

    try {
      await GestionInformacionCarga.create({
        categoria: 'Documentos',
        subcategoria: 'SGC',
        variable: 'Documentos SGC',
        archivo_nombre: req.file?.originalname || null,
        total_plantilla: Number(results.total || 0),
        total_cargados: totalProcesados,
        total_omitidos: Number(results.errores?.length || 0),
        porcentaje_cargado: porcentaje,
        estado: estadoCarga,
        detalle: results.errores?.length ? `Errores: ${results.errores.length}` : null,
        creado_por: req.user?.id || null
      });
    } catch (logError) {
      console.error('Error registrando log de carga de documentos:', logError.message);
    }

    res.json({
      success: true,
      message: `Excel cargado en la base del servidor: ${results.importados} nuevos, ${results.actualizados} actualizados de ${results.total} registros`,
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

const importFromSheet = async (req, res) => {
  try {
    const mode = String(req.body.mode || 'incremental').trim().toLowerCase();
    if (!['reemplazar', 'incremental'].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: 'Modo inválido. Usa "reemplazar" o "incremental".'
      });
    }

    const rawSheetRef = req.body.sheetId || req.body.sheetUrl || process.env.GOOGLE_SHEETS_ID;
    const sheetId = extractSpreadsheetId(rawSheetRef);
    const sheetName = req.body.sheetName || process.env.GOOGLE_SHEETS_TAB;
    if (!sheetId || !sheetName) {
      return res.status(400).json({
        success: false,
        message: 'Falta GOOGLE_SHEETS_ID/URL válido o GOOGLE_SHEETS_TAB en .env'
      });
    }

    const credentialsPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
      ? path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
      : path.join(__dirname, '../../keys/google-service-account.json');

    if (!fs.existsSync(credentialsPath)) {
      return res.status(500).json({
        success: false,
        message: 'No se encontró el JSON de la cuenta de servicio'
      });
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly'
      ]
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const range = `${sheetName}!A1:Z`;
    let values = [];

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range
      });
      values = response?.data?.values || [];
    } catch (sheetError) {
      const apiMessage = sheetError?.response?.data?.error?.message || sheetError?.message || '';
      const statusCode = Number(sheetError?.response?.status || 0);

      if (statusCode === 403 || /permission|not have permission|insufficient/i.test(apiMessage)) {
        return res.status(403).json({
          success: false,
          message: 'La cuenta de servicio no tiene acceso a la hoja de cálculo',
          error: 'Comparte la hoja con el correo de la cuenta de servicio (campo client_email del JSON) y verifica permisos de lector.'
        });
      }

      if (statusCode === 404 || /unable to parse range|requested entity was not found/i.test(apiMessage)) {
        return res.status(404).json({
          success: false,
          message: 'No se encontró la hoja o pestaña configurada',
          error: `Verifica GOOGLE_SHEETS_ID y GOOGLE_SHEETS_TAB. Valor actual de pestaña: ${sheetName}`
        });
      }

      if (/not supported for this document/i.test(apiMessage)) {
        // Fallback: archivo subido (xlsx) en Drive. Descargarlo y leer como Excel.
        const drive = google.drive({ version: 'v3', auth });
        const driveResponse = await drive.files.get(
          { fileId: sheetId, alt: 'media' },
          { responseType: 'arraybuffer' }
        );
        const buffer = Buffer.from(driveResponse.data);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const targetSheet = workbook.Sheets[sheetName] || workbook.Sheets[workbook.SheetNames[0]];
        if (!targetSheet) {
          return res.status(400).json({
            success: false,
            message: 'No se encontró la hoja indicada en el archivo de Drive'
          });
        }
        values = XLSX.utils.sheet_to_json(targetSheet, { header: 1, defval: null });
      } else {
        throw sheetError;
      }
    }

    if (values.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'La hoja no tiene datos suficientes'
      });
    }

    const headers = values[0].map(normalizeHeader);
    const data = values
      .slice(1)
      .filter((row) => row.some((cell) => String(cell || '').trim() !== ''))
      .map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          if (!header) return;
          const target = HEADER_ALIASES[header] || header;
          obj[target] = row[index] ?? null;
        });
        return obj;
      });

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'La hoja no tiene filas con datos'
      });
    }

    if (data.length > MAX_DOCUMENT_IMPORT_ROWS) {
      return res.status(400).json({
        success: false,
        message: `La hoja supera el límite permitido (${MAX_DOCUMENT_IMPORT_ROWS} filas)`
      });
    }

    const results = {
      total: data.length,
      importados: 0,
      actualizados: 0,
      errores: []
    };
    const existingDocumentBuckets = await buildExistingDocumentBuckets();
    const occurrenceIndexes = new Map();

    for (let i = 0; i < data.length; i++) {
      const row = mapRowKeys(data[i]);
      const rowNumber = i + 2;

      try {
        const { tipoDocumentacion, codigo, titulo } = normalizeMappedFields(row);

        if (!codigo && !titulo) {
          results.errores.push({
            fila: rowNumber,
            error: 'Faltan campos requeridos (codigo o titulo)'
          });
          continue;
        }

        const macroNombre = toText(row.macro_proceso, 255) || 'SIN DEFINIR';
        const procesoNombre = toText(row.proceso, 255) || 'SIN DEFINIR';
        const subprocesoNombre = toText(row.subproceso, 255) || 'SIN DEFINIR';
        const tipoNombre = tipoDocumentacion || 'SIN TIPO';
        const codigoFinal = codigo || `SIN-CODIGO-${rowNumber}`;
        const tituloFinal = titulo || codigoFinal;

        const [macroProceso] = await MacroProceso.findOrCreate({
          where: { nombre: macroNombre },
          defaults: { nombre: macroNombre }
        });

        const [proceso] = await Proceso.findOrCreate({
          where: {
            nombre: procesoNombre,
            macro_proceso_id: macroProceso.id
          },
          defaults: {
            nombre: procesoNombre,
            macro_proceso_id: macroProceso.id
          }
        });

        const [subproceso] = await SubProceso.findOrCreate({
          where: {
            nombre: subprocesoNombre,
            proceso_id: proceso.id
          },
          defaults: {
            nombre: subprocesoNombre,
            proceso_id: proceso.id
          }
        });

        const [tipoDoc] = await TipoDocumentacion.findOrCreate({
          where: { nombre: tipoNombre },
          defaults: { nombre: tipoNombre }
        });

        const documentoData = {
          subproceso_id: subproceso.id,
          tipo_documentacion_id: tipoDoc.id,
          macroproceso: macroNombre,
          proceso_texto: procesoNombre,
          subproceso_texto: subprocesoNombre,
          tipo_documento: tipoNombre,
          codigo: codigoFinal,
          titulo: tituloFinal,
          version: toText(row.version, 20),
          fecha_creacion: excelDateToISO(row.fecha_creacion),
          revisa: toText(row.revisa, 200),
          aprueba: toText(row.aprueba, 200),
          fecha_aprobacion: excelDateToISO(row.fecha_aprobacion),
          autor: toText(row.autor, 200),
          estado: normalizeEstado(row.estado),
          link_acceso: toText(row.link_acceso),
          observaciones: toText(row.observaciones),
          datos_originales: data[i]
        };

        const documentKey = getDocumentIdentityKey(documentoData.codigo, documentoData.version);
        const occurrenceIndex = nextDocumentOccurrence(occurrenceIndexes, documentKey);
        const existente = existingDocumentBuckets.get(documentKey)?.[occurrenceIndex] || null;

        if (existente) {
          await existente.update(documentoData);
          results.actualizados++;
        } else {
          const nuevoDocumento = await Documento.create(documentoData);
          const bucket = existingDocumentBuckets.get(documentKey) || [];
          bucket.push(nuevoDocumento);
          existingDocumentBuckets.set(documentKey, bucket);
          results.importados++;
        }
      } catch (error) {
        results.errores.push({
          fila: rowNumber,
          error: error.message
        });
      }
    }

    const totalProcesados = Number(results.importados || 0) + Number(results.actualizados || 0);
    const porcentaje = results.total > 0 ? Number(((totalProcesados / results.total) * 100).toFixed(2)) : 0;
    const estadoCarga = porcentaje === 100 ? 'exitoso' : (totalProcesados > 0 ? 'parcial' : 'fallido');

    try {
      await GestionInformacionCarga.create({
        categoria: 'Documentos',
        subcategoria: 'SGC',
        variable: 'Documentos SGC',
        archivo_nombre: `GoogleSheet:${sheetName}`,
        total_plantilla: Number(results.total || 0),
        total_cargados: totalProcesados,
        total_omitidos: Number(results.errores?.length || 0),
        porcentaje_cargado: porcentaje,
        estado: estadoCarga,
        detalle: results.errores?.length ? `Errores: ${results.errores.length}` : null,
        creado_por: req.user?.id || null
      });
    } catch (logError) {
      console.error('Error registrando log de carga de documentos:', logError.message);
    }

    return res.json({
      success: true,
      message: `Sheets cargado en la base del servidor: ${results.importados} nuevos, ${results.actualizados} actualizados de ${results.total} registros`,
      data: results
    });
  } catch (error) {
    console.error('❌ Error en importación desde Sheets:', error);
    const apiMessage = error?.response?.data?.error?.message;
    return res.status(500).json({
      success: false,
      message: 'Error al importar desde Google Sheets',
      error: apiMessage || error.message
    });
  }
};

const importFromSheetFixed = async (req, res) => {
  try {
    const mode = String(req.body.mode || 'incremental').trim().toLowerCase();
    if (!['reemplazar', 'incremental'].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: 'Modo invalido. Usa "reemplazar" o "incremental".'
      });
    }

    const rawSheetRef = req.body.sheetId || req.body.sheetUrl || process.env.GOOGLE_SHEETS_ID;
    const sheetId = extractSpreadsheetId(rawSheetRef);
    const sheetName = req.body.sheetName || process.env.GOOGLE_SHEETS_TAB;
    const sheetGid = req.body.sheetGid
      || extractSheetGid(req.body.sheetUrl)
      || extractSheetGid(process.env.GOOGLE_SHEETS_URL)
      || process.env.GOOGLE_SHEETS_GID;

    if (!sheetId || !sheetName) {
      return res.status(400).json({
        success: false,
        message: 'Falta GOOGLE_SHEETS_ID/URL valido o GOOGLE_SHEETS_TAB en la configuracion'
      });
    }

    const sheetRead = await readGoogleSheetValues({ sheetId, sheetName, sheetGid });
    const parsedSheet = parseSheetMatrix(sheetRead.values || []);
    if (!parsedSheet.success) {
      return res.status(parsedSheet.status).json({
        success: false,
        message: parsedSheet.message
      });
    }

    const data = parsedSheet.data;

    const results = {
      total: data.length,
      importados: 0,
      actualizados: 0,
      omitidos: 0,
      errores: []
    };

    const existingDocumentBuckets = await buildExistingDocumentBuckets();
    const occurrenceIndexes = new Map();

    for (let i = 0; i < data.length; i++) {
      const row = mapRowKeys(data[i]);
      const rowNumber = i + 2;

      try {
        const { tipoDocumentacion, codigo, titulo } = normalizeMappedFields(row);

        // Saltar solo filas completamente vacías (sin codigo ni titulo)
        if (!codigo && !titulo) {
          results.omitidos++;
          continue;
        }

        // Usar valores por defecto para campos de jerarquía vacíos
        const macroNombre = toText(row.macro_proceso, 255) || 'SIN DEFINIR';
        const procesoNombre = toText(row.proceso, 255) || 'SIN DEFINIR';
        const subprocesoNombre = toText(row.subproceso, 255) || 'SIN DEFINIR';
        const tipoNombre = tipoDocumentacion || 'SIN TIPO';
        const codigoFinal = codigo || `SIN-CODIGO-${rowNumber}`;
        const tituloFinal = titulo || codigoFinal;

        const [macroProceso] = await MacroProceso.findOrCreate({
          where: { nombre: macroNombre },
          defaults: { nombre: macroNombre }
        });

        const [proceso] = await Proceso.findOrCreate({
          where: {
            nombre: procesoNombre,
            macro_proceso_id: macroProceso.id
          },
          defaults: {
            nombre: procesoNombre,
            macro_proceso_id: macroProceso.id
          }
        });

        const [subproceso] = await SubProceso.findOrCreate({
          where: {
            nombre: subprocesoNombre,
            proceso_id: proceso.id
          },
          defaults: {
            nombre: subprocesoNombre,
            proceso_id: proceso.id
          }
        });

        const [tipoDoc] = await TipoDocumentacion.findOrCreate({
          where: { nombre: tipoNombre },
          defaults: { nombre: tipoNombre }
        });

        const documentoData = {
          subproceso_id: subproceso.id,
          tipo_documentacion_id: tipoDoc.id,
          macroproceso: macroNombre,
          proceso_texto: procesoNombre,
          subproceso_texto: subprocesoNombre,
          tipo_documento: tipoNombre,
          codigo: codigoFinal,
          titulo: tituloFinal,
          version: toText(row.version, 20),
          fecha_creacion: excelDateToISO(row.fecha_creacion),
          revisa: toText(row.revisa, 200),
          aprueba: toText(row.aprueba, 200),
          fecha_aprobacion: excelDateToISO(row.fecha_aprobacion),
          autor: toText(row.autor, 200),
          estado: normalizeEstado(row.estado),
          link_acceso: toText(row.link_acceso),
          observaciones: toText(row.observaciones),
          datos_originales: data[i]
        };

        const documentKey = getDocumentIdentityKey(documentoData.codigo, documentoData.version);
        const occurrenceIndex = nextDocumentOccurrence(occurrenceIndexes, documentKey);
        const existente = existingDocumentBuckets.get(documentKey)?.[occurrenceIndex] || null;

        if (existente) {
          if (documentNeedsUpdate(existente, documentoData)) {
            await existente.update(documentoData);
            results.actualizados++;
          } else {
            results.omitidos++;
          }
        } else {
          const nuevoDocumento = await Documento.create(documentoData);
          const bucket = existingDocumentBuckets.get(documentKey) || [];
          bucket.push(nuevoDocumento);
          existingDocumentBuckets.set(documentKey, bucket);
          results.importados++;
        }
      } catch (error) {
        results.errores.push({
          fila: rowNumber,
          error: error.message
        });
      }
    }

    const totalProcesados = Number(results.importados || 0) + Number(results.actualizados || 0);
    const porcentaje = results.total > 0 ? Number(((totalProcesados / results.total) * 100).toFixed(2)) : 0;
    const estadoCarga = porcentaje === 100 ? 'exitoso' : (totalProcesados > 0 ? 'parcial' : 'fallido');

    try {
      await GestionInformacionCarga.create({
        categoria: 'Documentos',
        subcategoria: 'SGC',
        variable: 'Documentos SGC',
        archivo_nombre: `GoogleSheet:${sheetName}`,
        total_plantilla: Number(results.total || 0),
        total_cargados: totalProcesados,
        total_omitidos: Number((results.errores?.length || 0) + (results.omitidos || 0)),
        porcentaje_cargado: porcentaje,
        estado: estadoCarga,
        detalle: results.errores?.length ? `Errores: ${results.errores.length}` : null,
        creado_por: req.user?.id || null
      });
    } catch (logError) {
      console.error('Error registrando log de carga de documentos:', logError.message);
    }

    return res.json({
      success: true,
      message: buildSyncMessage({ mode, results }),
      data: {
        ...results,
        source: sheetRead.source,
        sheetId,
        sheetName
      }
    });
  } catch (error) {
    console.error('Error en importacion desde Sheets:', error);
    const apiMessage = error?.response?.data?.error?.message;
    const status = Number(error?.status || error?.response?.status || 500);
    return res.status(status).json({
      success: false,
      message: 'Error al importar desde Google Sheets',
      error: error?.detail || apiMessage || error.message
    });
  }
};

const downloadTemplate = (req, res) => {
  try {
    const headers = [
      'MACROPROCESO',
      'PROCESO',
      'SUBPROCESO',
      'CODIGO',
      'TITULO_DOCUMENTO',
      'TIPO_DOCUMENTO',
      'VERSIÓN',
      'FECHA_CREACION',
      'REVISA',
      'APRUEBA',
      'FECHA_APROBACION',
      'AUTOR',
      'ESTADO',
      'LINK_ACCESO',
      'OBSERVACIONES'
    ];

    const worksheet = XLSX.utils.json_to_sheet([], { header: headers });
    
    // Ajustar ancho de columnas
    worksheet['!cols'] = [
      { wch: 25 }, // MACROPROCESO
      { wch: 30 }, // PROCESO
      { wch: 30 }, // SUBPROCESO
      { wch: 18 }, // CODIGO
      { wch: 40 }, // TITULO_DOCUMENTO
      { wch: 20 }, // TIPO_DOCUMENTO
      { wch: 10 }, // VERSIÓN
      { wch: 15 }, // FECHA_CREACION
      { wch: 25 }, // REVISA
      { wch: 25 }, // APRUEBA
      { wch: 18 }, // FECHA_APROBACION
      { wch: 30 }, // AUTOR
      { wch: 15 }, // ESTADO
      { wch: 50 }, // LINK_ACCESO
      { wch: 40 }  // OBSERVACIONES
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

const clearDocumentos = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'La limpieza de documentos esta deshabilitada para conservar toda la informacion del servidor'
  });
};

module.exports = { importFromExcel, importFromSheet: importFromSheetFixed, downloadTemplate, clearDocumentos };
