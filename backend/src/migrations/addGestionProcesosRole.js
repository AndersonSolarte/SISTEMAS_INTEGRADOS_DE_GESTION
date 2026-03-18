require('dotenv').config();
const { sequelize, testConnection } = require('../config/database');

const roleValue = 'gestion_por_procesos';

const run = async () => {
  try {
    await testConnection();
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'enum_users_role' AND e.enumlabel = '${roleValue}'
        ) THEN
          ALTER TYPE "enum_users_role" ADD VALUE '${roleValue}';
        END IF;
      END
      $$;
    `);
    console.log('✅ Rol agregado/verificado: gestion_por_procesos');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración de rol gestion_por_procesos:', error);
    process.exit(1);
  }
};

run();
