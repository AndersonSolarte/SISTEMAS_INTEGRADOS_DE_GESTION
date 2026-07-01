const { sequelize } = require('../src/config/database');
const InternacionalizacionMovilidad = require('../src/models/InternacionalizacionMovilidad');

async function listCountries() {
  try {
    await sequelize.authenticate();
    const records = await InternacionalizacionMovilidad.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('pais_extranjero')), 'pais']],
      raw: true,
    });
    console.log('Unique countries in DB:');
    records.forEach(r => console.log(`"${r.pais}"`));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}
listCountries();
