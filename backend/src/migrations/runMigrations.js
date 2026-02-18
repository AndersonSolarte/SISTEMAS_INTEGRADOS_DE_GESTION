require('dotenv').config();
const { sequelize, testConnection } = require('../config/database');
const models = require('../models');

const runMigrations = async () => {
  try {
    console.log('🔄 Ejecutando migraciones...');
    await testConnection();
    await models.User.sync();
    await models.MacroProceso.sync();
    await models.Proceso.sync();
    await models.SubProceso.sync();
    await models.TipoDocumentacion.sync();
    await models.Documento.sync();
    console.log('✅ Migraciones completadas');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

runMigrations();