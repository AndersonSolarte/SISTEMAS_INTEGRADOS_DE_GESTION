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
    
    // Buscar usuarios activos con welcome_email_sent = false
    const users = await User.findAll({
      where: {
        estado: 'activo',
        welcome_email_sent: false
      }
    });

    console.log(`Encontrados ${users.length} usuarios activos con correos de bienvenida pendientes por enviar.`);
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
        await user.update({ welcome_email_sent: true });
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
