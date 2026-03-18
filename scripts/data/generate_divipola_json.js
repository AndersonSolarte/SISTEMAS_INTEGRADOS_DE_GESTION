/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const XLSX = require('../../backend/node_modules/xlsx');

const INPUT_FILE = path.resolve(process.cwd(), 'data_DIVIPOLA_Municipios.xlsx');
const OUTPUT_DIR = path.resolve(process.cwd(), 'frontend', 'public', 'geodata');

const asText = (value) => String(value ?? '').trim();
const normalizeCode = (value, size) => asText(value).replace(/[^0-9]/g, '').padStart(size, '0');

const stripDiacritics = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const repairMojibake = (value = '') => {
  const raw = asText(value);
  if (!raw) return '';
  if (!/[ÃÂ]/.test(raw)) return raw;
  try {
    const fixed = Buffer.from(raw, 'latin1').toString('utf8');
    return asText(fixed) || raw;
  } catch (_) {
    return raw;
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

const normalizeDisplayName = (value = '') =>
  fixCommonSpanishMojibake(repairMojibake(value))
    .replace(/[^\p{L}\p{N},.\-\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase('es-CO');

const normalizeMatchName = (value = '') =>
  stripDiacritics(normalizeDisplayName(value))
    .replace(/[^A-Z0-9,.\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toNumberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const run = () => {
  if (!fs.existsSync(INPUT_FILE)) throw new Error(`No se encontró el archivo: ${INPUT_FILE}`);

  const workbook = XLSX.readFile(INPUT_FILE);
  const firstSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows.length) throw new Error('El archivo está vacío');

  const idx = { deptCode: 0, deptName: 1, munCode: 2, munName: 3, type: 4, lng: 5, lat: 6 };
  const departmentsMap = new Map();
  const municipalities = [];

  rows.slice(1).forEach((row) => {
    const departmentCode = normalizeCode(row[idx.deptCode], 2);
    const departmentName = normalizeDisplayName(row[idx.deptName]);
    const municipalityCode = normalizeCode(row[idx.munCode], 5);
    const municipalityName = normalizeDisplayName(row[idx.munName]);
    if (!departmentCode || !municipalityCode || !departmentName || !municipalityName) return;

    if (!departmentsMap.has(departmentCode)) {
      departmentsMap.set(departmentCode, {
        code: departmentCode,
        name: departmentName,
        name_normalized: normalizeMatchName(departmentName),
        municipalities: [],
        _sumLat: 0,
        _sumLng: 0,
        _countGeo: 0
      });
    }

    const municipality = {
      code: municipalityCode,
      name: municipalityName,
      name_normalized: normalizeMatchName(municipalityName),
      department_code: departmentCode,
      department_name: departmentName,
      department_name_normalized: normalizeMatchName(departmentName),
      type: normalizeDisplayName(row[idx.type]) || null,
      longitude: toNumberOrNull(row[idx.lng]),
      latitude: toNumberOrNull(row[idx.lat])
    };
    municipalities.push(municipality);
    const dept = departmentsMap.get(departmentCode);
    dept.municipalities.push(municipality);
    if (municipality.latitude !== null && municipality.longitude !== null) {
      dept._sumLat += municipality.latitude;
      dept._sumLng += municipality.longitude;
      dept._countGeo += 1;
    }
  });

  const departmentsHierarchy = Array.from(departmentsMap.values())
    .map((dept) => ({
      code: dept.code,
      name: dept.name,
      name_normalized: dept.name_normalized,
      municipalities_count: dept.municipalities.length,
      centroid_latitude: dept._countGeo ? Number((dept._sumLat / dept._countGeo).toFixed(6)) : null,
      centroid_longitude: dept._countGeo ? Number((dept._sumLng / dept._countGeo).toFixed(6)) : null,
      municipalities: dept.municipalities
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map((m) => ({
          code: m.code,
          name: m.name,
          name_normalized: m.name_normalized,
          type: m.type,
          latitude: m.latitude,
          longitude: m.longitude
        }))
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const departments = departmentsHierarchy.map((dept) => ({
    code: dept.code,
    name: dept.name,
    name_normalized: dept.name_normalized,
    municipalities_count: dept.municipalities_count,
    centroid_latitude: dept.centroid_latitude,
    centroid_longitude: dept.centroid_longitude
  }));

  const municipalitiesFlat = municipalities
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map((m) => ({
      code: m.code,
      name: m.name,
      name_normalized: m.name_normalized,
      department_code: m.department_code,
      department_name: m.department_name,
      department_name_normalized: m.department_name_normalized,
      type: m.type,
      latitude: m.latitude,
      longitude: m.longitude
    }));

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'divipola_departamentos.json'), JSON.stringify(departments, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'divipola_municipios.json'), JSON.stringify(municipalitiesFlat, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'divipola_departamentos_municipios.json'), JSON.stringify(departmentsHierarchy, null, 2), 'utf8');

  console.log(`Hoja procesada: ${firstSheet}`);
  console.log(`Departamentos: ${departments.length}`);
  console.log(`Municipios: ${municipalitiesFlat.length}`);
  console.log(`Salida: ${OUTPUT_DIR}`);
};

run();
