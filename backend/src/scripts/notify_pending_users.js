const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const { sequelize, testConnection } = require('../config/database');
const { User } = require('../models');
const { sendWelcomeEmail } = require('../services/emailService');

async function run() {
  try {
    await testConnection();
    
    // Buscar usuarios activos que nunca han iniciado sesión (last_login es null)
    const users = await User.findAll({
      where: {
        estado: 'activo',
        last_login: null
      }
    });

    console.log(`Encontrados ${users.length} usuarios activos que nunca han iniciado sesión.`);
    if (users.length === 0) {
      console.log('No hay usuarios pendientes por notificar.');
      process.exit(0);
    }

    let sentCount = 0;
    let failCount = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`[${i + 1}/${users.length}] Enviando correo de bienvenida a ${user.email} (${user.nombre})...`);
      
      const emailResult = await sendWelcomeEmail(user);
      if (emailResult.success) {
        sentCount++;
      } else {
        failCount++;
        console.error(`❌ Error al enviar a ${user.email}: ${emailResult.error}`);
      }
      
      // Espera de 300ms para evitar saturar el servidor SMTP
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`\n🎉 Proceso completado. Correos enviados: ${sentCount}, Errores: ${failCount}`);
    process.exit(0);
  } catch (error) {
    console.error('Error en el script de notificación:', error);
    process.exit(1);
  }
}

run();
