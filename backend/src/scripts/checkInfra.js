const { sequelize } = require('../config/database');
const PoblacionalInfraestructuraFisica = require('../models/PoblacionalInfraestructuraFisica');

async function check() {
  try {
    const count = await PoblacionalInfraestructuraFisica.count();
    console.log(`[CHECK] Total de registros en poblacional_infraestructura_fisicas: ${count}`);
    const samples = await PoblacionalInfraestructuraFisica.findAll({ limit: 3, raw: true });
    console.log('[CHECK] Muestras de registros:', JSON.stringify(samples, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('[CHECK] Error:', error);
    process.exit(1);
  }
}

check();
