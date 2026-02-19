const nodemailer = require('nodemailer');

// Configurar transportador de email
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const sendWelcomeEmail = async (user, tempPassword) => {
  const safeNombre = escapeHtml(user.nombre);
  const safeUser = escapeHtml(user.username || user.email);
  const safeRole = escapeHtml(user.role);

  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@unicesmag.edu.co',
    to: user.email,
    subject: 'Bienvenido al Sistema de Gestión - UNICESMAG',
    text: `Hola ${user.nombre}, tu usuario es ${user.username || user.email} y tu contraseña temporal es ${tempPassword}. Inicia sesión en ${frontendUrl}/login`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Bienvenido al Sistema de Gestión de Calidad</h2>
        <p>Hola <strong>${safeNombre}</strong>,</p>
        <p>Tu cuenta ha sido creada exitosamente en el Sistema Integrado de Gestión.</p>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Tus credenciales de acceso:</h3>
          <p><strong>Usuario:</strong> ${safeUser}</p>
          <p><strong>Contraseña temporal:</strong> ${escapeHtml(tempPassword)}</p>
          <p><strong>Rol:</strong> ${safeRole}</p>
        </div>
        
        <p>Por favor, cambia tu contraseña al iniciar sesión por primera vez.</p>
        
        <a href="${frontendUrl}/login" 
           style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Acceder al sistema
        </a>
        
        <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
          Este es un correo automático, por favor no responder.
        </p>
      </div>
    `
  };
  
  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Email enviado a:', user.email);
    return { success: true };
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return { success: false, error: error.message };
  }
};

const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;
  const safeNombre = escapeHtml(user.nombre);
  
  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@unicesmag.edu.co',
    to: user.email,
    subject: 'Recuperación de Contraseña - Sistema de Gestión',
    text: `Hola ${user.nombre}, usa este enlace para restablecer tu contraseña: ${resetUrl}. El enlace expira en 1 hora.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Recuperación de Contraseña</h2>
        <p>Hola <strong>${safeNombre}</strong>,</p>
        <p>Has solicitado restablecer tu contraseña.</p>
        
        <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
        
        <a href="${resetUrl}" 
           style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Restablecer Contraseña
        </a>
        
        <p style="color: #64748b;">Este enlace expirará en 1 hora.</p>
        
        <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
          Si no solicitaste este cambio, ignora este correo.
        </p>
      </div>
    `
  };
  
  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Email de recuperación enviado a:', user.email);
    return { success: true };
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return { success: false, error: error.message };
  }
};

const sendTemporaryPasswordEmail = async (user, tempPassword) => {
  const loginUrl = `${frontendUrl}/login`;
  const safeNombre = escapeHtml(user.nombre);
  const safeUser = escapeHtml(user.username || user.email);

  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@unicesmag.edu.co',
    to: user.email,
    subject: 'Nueva contraseña temporal - Sistema de Gestión',
    text: `Hola ${user.nombre}, tu usuario es ${user.username || user.email} y tu nueva contraseña temporal es ${tempPassword}. Inicia sesión en ${loginUrl} y cámbiala al entrar.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Restablecimiento por Administrador</h2>
        <p>Hola <strong>${safeNombre}</strong>,</p>
        <p>Un administrador restableció tu acceso. Usa estas credenciales temporales:</p>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Usuario:</strong> ${safeUser}</p>
          <p><strong>Contraseña temporal:</strong> ${escapeHtml(tempPassword)}</p>
        </div>
        
        <p>Al iniciar sesión se te pedirá cambiar la contraseña obligatoriamente.</p>
        
        <a href="${loginUrl}" 
           style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Ir al sistema
        </a>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Email de contraseña temporal enviado a:', user.email);
    return { success: true };
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendTemporaryPasswordEmail
};
