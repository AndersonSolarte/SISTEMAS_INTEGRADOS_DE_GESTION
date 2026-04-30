require('dotenv').config();
const { sequelize, testConnection } = require('../config/database');

const roleValues = [
  'planeacion_estrategica',
  'planeacion_efectividad',
  'autoevaluacion',
  'gestion_informacion',
  'gestion_por_procesos',
  'registros_calificados_acreditacion'
];

const run = async () => {
  try {
    await testConnection();
    for (const role of roleValues) {
      await sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'enum_users_role' AND e.enumlabel = '${role}'
          ) THEN
            ALTER TYPE "enum_users_role" ADD VALUE '${role}';
          END IF;
        END
        $$;
      `);
      console.log(`✅ Rol agregado/verificado: ${role}`);
    }

    console.log('✅ Migración de roles de planeación finalizada');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración de roles:', error);
    process.exit(1);
  }
};

run();
