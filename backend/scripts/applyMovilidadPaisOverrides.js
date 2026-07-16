const { sequelize } = require('../src/config/database');
const InternacionalizacionMovilidad = require('../src/models/InternacionalizacionMovilidad');

const normalizeKey = (value = '') => String(value || '')
  .toUpperCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const overrides = {
  NARINO: 'Colombia',
  NO: 'Colombia',
  'UNIVERSIDAD DEL VALLE': 'Colombia',
  'INFOTEC SOLUCIONES S A S': 'Colombia',
  'UNIVERSIDAD CATOLICA': 'Colombia',
  'COLOMBIA PERU': 'Colombia',
  'MEXICO ECUADOR BRASIL': 'México',
  'ECUADOR PERU MEXICO': 'Ecuador',
  ESCUADOR: 'Ecuador',
  SALVADOR: 'El Salvador',
  '32 ARGENTINA': 'Argentina',
  '862 VEN': 'Venezuela',
  '840 ESTADOS UNIDOS': 'Estados Unidos',
  'E E U U': 'Estados Unidos',
  '484 MEX': 'México',
  'CHILE 152': 'Chile',
  CL: 'Chile'
};

async function main() {
  const rows = await InternacionalizacionMovilidad.findAll({ attributes: ['pais_extranjero'], raw: true });
  const distinct = [...new Set(rows.map((row) => row.pais_extranjero).filter(Boolean))];
  let total = 0;

  for (const value of distinct) {
    const normalized = overrides[normalizeKey(value)];
    if (!normalized || String(value).trim() === normalized) continue;
    const [updated] = await InternacionalizacionMovilidad.update(
      { pais_extranjero: normalized },
      { where: { pais_extranjero: value } }
    );
    total += updated;
    console.log(`${value} -> ${normalized}: ${updated}`);
  }

  console.log(`Total actualizados: ${total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
