require('dotenv').config();
const { sequelize } = require('../config/database');

const addUserManagement = async () => {
  try {
    console.log('🔄 Agregando campos de gestión de usuarios...');
    
    await sequelize.query(`
      -- Agregar campos faltantes a users
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
      
      -- Crear tabla de auditoría de usuarios
      CREATE TABLE IF NOT EXISTS user_audit (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(50) NOT NULL,
        description TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Agregar campos de auditoría a documentos
      ALTER TABLE documentos ADD COLUMN IF NOT EXISTS creado_por INTEGER REFERENCES users(id);
      ALTER TABLE documentos ADD COLUMN IF NOT EXISTS actualizado_por INTEGER REFERENCES users(id);
      ALTER TABLE documentos ADD COLUMN IF NOT EXISTS eliminado BOOLEAN DEFAULT FALSE;
      ALTER TABLE documentos ADD COLUMN IF NOT EXISTS eliminado_por INTEGER REFERENCES users(id);
      ALTER TABLE documentos ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMP;
      
      -- Crear índices
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_documentos_eliminado ON documentos(eliminado);
    `);
    
    console.log('✅ Campos agregados correctamente');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
};

if (require.main === module) {
  addUserManagement()
    .then(() => {
      console.log('✅ Migración completada');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error en migración:', error);
      process.exit(1);
    });
}

module.exports = addUserManagement;
