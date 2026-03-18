require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { sequelize, testConnection } = require('../../config/database');
const { RefDepartamento, RefMunicipio, RefDivipolaCarga } = require('../../models');

const stripDiacritics = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const repairMojibake = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!/[ÃÂ]/.test(text)) return text;
  try {
    const fixed = Buffer.from(text, 'latin1').toString('utf8');
    return fixed || text;
  } catch (_) {
    return text;
  }
};

const fixCommonSpanishMojibake = (value = '') =>
  String(value || '')
    .replace(/\u00C3\u2018/g, 'Ñ')
    .replace(/\u00C3\u2019/g, 'ñ')
    .replace(/\u00C3\u0081/g, 'Á')
    .replace(/\u00C3\u00A1/g, 'á')
    .replace(/\u00C3\u0089/g, 'É')
    .replace(/\u00C3\u00A9/g, 'é')
    .replace(/\u00C3\u008D/g, 'Í')
    .replace(/\u00C3\u00AD/g, 'í')
    .replace(/\u00C3\u0093/g, 'Ó')
    .replace(/\u00C3\u00B3/g, 'ó')
    .replace(/\u00C3\u009A/g, 'Ú')
    .replace(/\u00C3\u00BA/g, 'ú')
    .replace(/Ã‘|Ã\x91|Ã/g, 'Ñ')
    .replace(/Ã±|Ã\xB1|Ã±/g, 'ñ')
    .replace(/Ã|Ã\x81|ÃÁ|ÃA/g, 'Á')
    .replace(/Ã¡|Ã\xA1|Ãa/g, 'á')
    .replace(/Ã‰|Ã\x89|ÃE/g, 'É')
    .replace(/Ã©|Ã\xA9|Ãe/g, 'é')
    .replace(/Ã|Ã\x8D|ÃI/g, 'Í')
    .replace(/Ãí|Ã\xAD|Ãi/g, 'í')
    .replace(/Ã“|Ã\x93|ÃO/g, 'Ó')
    .replace(/Ã³|Ã\xB3|Ão/g, 'ó')
    .replace(/Ãš|Ã\x9A|ÃU/g, 'Ú')
    .replace(/Ãº|Ã\xBA|Ãu/g, 'ú');

const normalizeOfficialText = (value = '') =>
  fixCommonSpanishMojibake(repairMojibake(String(value || '')))
    .toUpperCase('es-CO')
    .replace(/[^\p{L}\p{N},.\-\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeForMatch = (value = '') =>
  stripDiacritics(normalizeOfficialText(value))
    .replace(/[^A-Z0-9,.\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toCode = (value, len) => String(value ?? '').replace(/[^0-9]/g, '').padStart(len, '0');

const toNumberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const sha256File = (filePath) => {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
};

const resolveInputPath = () => {
  const arg = process.argv[2];
  if (arg) return path.resolve(arg);
  const candidates = [
    path.resolve(process.cwd(), 'data_DIVIPOLA_Municipios.xlsx'),
    path.resolve(process.cwd(), '..', 'data_DIVIPOLA_Municipios.xlsx'),
    path.resolve(__dirname, '../../../../data_DIVIPOLA_Municipios.xlsx')
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
};

const run = async () => {
  const inputPath = resolveInputPath();
  if (!fs.existsSync(inputPath)) {
    throw new Error(`No se encontro archivo DIVIPOLA: ${inputPath}`);
  }

  await testConnection();

  const workbook = XLSX.readFile(inputPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length < 2) throw new Error('Archivo DIVIPOLA sin datos');

  const version = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const fileHash = sha256File(inputPath);
  const tx = await sequelize.transaction();

  try {
    await RefDepartamento.update({ activo: false, vigencia_hasta: new Date().toISOString().slice(0, 10) }, { where: { activo: true }, transaction: tx });
    await RefMunicipio.update({ activo: false, vigencia_hasta: new Date().toISOString().slice(0, 10) }, { where: { activo: true }, transaction: tx });

    const deptMap = new Map();
    const muniRows = [];
    rows.slice(1).forEach((r) => {
      const codigoDepto = toCode(r[0], 2);
      const nombreDepto = normalizeOfficialText(r[1]);
      const codigoMuni = toCode(r[2], 5);
      const nombreMuni = normalizeOfficialText(r[3]);
      const tipo = normalizeOfficialText(r[4]) || null;
      const longitud = toNumberOrNull(r[5]);
      const latitud = toNumberOrNull(r[6]);

      if (!codigoDepto || !codigoMuni || !nombreDepto || !nombreMuni) return;
      if (!deptMap.has(codigoDepto)) deptMap.set(codigoDepto, nombreDepto);
      muniRows.push({
        codigo_dane: codigoMuni,
        codigo_departamento: codigoDepto,
        nombre_oficial: nombreMuni,
        nombre_normalizado: normalizeForMatch(nombreMuni),
        tipo,
        latitud,
        longitud,
        activo: true,
        vigencia_desde: new Date().toISOString().slice(0, 10),
        vigencia_hasta: null,
        version_carga: version
      });
    });

    const deptRows = Array.from(deptMap.entries()).map(([codigo_dane, nombre]) => ({
      codigo_dane,
      nombre_oficial: nombre,
      nombre_normalizado: normalizeForMatch(nombre),
      activo: true,
      vigencia_desde: new Date().toISOString().slice(0, 10),
      vigencia_hasta: null,
      version_carga: version
    }));

    await RefDepartamento.bulkCreate(deptRows, {
      transaction: tx,
      updateOnDuplicate: ['nombre_oficial', 'nombre_normalizado', 'activo', 'vigencia_desde', 'vigencia_hasta', 'version_carga']
    });
    await RefMunicipio.bulkCreate(muniRows, {
      transaction: tx,
      updateOnDuplicate: ['codigo_departamento', 'nombre_oficial', 'nombre_normalizado', 'tipo', 'latitud', 'longitud', 'activo', 'vigencia_desde', 'vigencia_hasta', 'version_carga']
    });

    await RefDivipolaCarga.create({
      version_carga: version,
      fuente_archivo: inputPath,
      hash_archivo: fileHash,
      total_departamentos: deptRows.length,
      total_municipios: muniRows.length,
      estado: 'completado',
      detalle: `Hoja: ${sheetName}`
    }, { transaction: tx });

    await tx.commit();
    console.log(`[divipola:load] Version ${version}`);
    console.log(`[divipola:load] Departamentos: ${deptRows.length}`);
    console.log(`[divipola:load] Municipios: ${muniRows.length}`);
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    await sequelize.close();
  }
};

run().catch((error) => {
  console.error('[divipola:load] Error:', error.message);
  process.exit(1);
});
