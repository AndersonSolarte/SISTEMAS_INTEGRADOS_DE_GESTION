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
const INSTITUTIONAL_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@unicesmag\.edu\.co$/i;

const roleLabels = {
  administrador: 'Administrador General',
  consulta: 'Consulta',
  gestion_procesos: 'Gestion por Procesos',
  planeacion_estrategica: 'Planeacion Estrategica',
  planeacion_efectividad: 'Planeacion y Efectividad',
  autoevaluacion: 'Autoevaluacion',
  gestion_informacion: 'Gestion de la Informacion'
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const normalizeRecipient = (value) => {
  const email = String(value || '').trim().toLowerCase();

  // Reject address lists / header injection vectors and non-institutional destinations.
  if (!email || email.length > 254 || /[\r\n,;]/.test(email)) {
    throw new Error('Correo destino inválido');
  }

  if (!INSTITUTIONAL_EMAIL_REGEX.test(email)) {
    throw new Error('El correo destino debe ser institucional (@unicesmag.edu.co)');
  }

  return email;
};

const getSmtpConfigError = () => {
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const host = String(process.env.SMTP_HOST || '').trim().toLowerCase();

  if (!user || !pass) return 'Configuracion SMTP incompleta (SMTP_USER/SMTP_PASS).';
  if (/TU_CUENTA_GMAIL/i.test(user) || /TU_APP_PASSWORD/i.test(pass)) {
    return 'Configuracion SMTP en modo plantilla. Reemplaza SMTP_USER y SMTP_PASS por credenciales reales.';
  }
  if (host.includes('gmail.com')) {
    const compact = pass.replace(/\s+/g, '');
    if (compact.length !== 16) {
      return 'SMTP_PASS invalido para Gmail: debes usar App Password de 16 caracteres generada por Google.';
    }
  }
  return null;
};

const resolveMailFrom = () => {
  const configured = String(process.env.SMTP_FROM || '').trim();
  if (configured) return configured;
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  if (smtpUser) return `Sistema SIG UNICESMAG <${smtpUser}>`;
  return 'noreply@unicesmag.edu.co';
};

const resolveRoleLabel = (role) => roleLabels[String(role || '').trim()] || String(role || 'Sin rol');

const renderInstitutionalTemplate = ({ title, introHtml, bodyHtml }) => `
  <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
    <div style="background: #0b3a6f; color: #fff; padding: 16px 20px; border-radius: 10px 10px 0 0;">
      <h2 style="margin: 0; font-size: 20px;">UNICESMAG</h2>
      <p style="margin: 6px 0 0; font-size: 13px; opacity: .95;">Dirección de Planeación y Aseguramiento de la Calidad - Gestión por Procesos y la Información</p>
      <p style="margin: 8px 0 0; font-size: 13px; opacity: .9;">Notificación institucional automática</p>
    </div>
    <div style="border: 1px solid #dbeafe; border-top: 0; border-radius: 0 0 10px 10px; padding: 20px; background: #ffffff;">
      <h3 style="margin-top: 0; color: #0b3a6f;">${title}</h3>
      ${introHtml}
      ${bodyHtml}
      <div style="margin-top: 26px; text-align: center; border: 1px solid #0b3a6f; color: #0b3a6f; padding: 14px 18px; border-radius: 8px;">
        <p style="color: #0b3a6f; font-size: 12px; margin: 0;">
        Este es un correo institucional automático. Por favor, no responder.
        </p>
      </div>
    </div>
  </div>
`;

const sendWelcomeEmail = async (user) => {
  const safeRecipient = normalizeRecipient(user.email);
  const safeNombre = escapeHtml(user.nombre);
  const safeUser = escapeHtml(user.username || user.email);
  const safeRole = escapeHtml(resolveRoleLabel(user.role));
  const loginUrl = `${frontendUrl}/login`;
  const tempPassword = '';

  const mailOptions = {
    from: resolveMailFrom(),
    to: safeRecipient,
    subject: 'UNICESMAG | ACTIVACION DE USUARIO EN EL SISTEMA GESTION POR PROCESOS',
    text: `Hola ${user.nombre}. Tu usuario fue activado en el Sistema Integrado de Gestion de UNICESMAG. Usuario: ${user.username || user.email}. Rol: ${resolveRoleLabel(user.role)}. Contraseña temporal: ${tempPassword}. Ingresa en ${loginUrl}`,
    html: renderInstitutionalTemplate({
      title: 'Activacion de acceso',
      introHtml: `<p>Hola <strong>${safeNombre}</strong>,</p><p>La Direccion de Planeacion y Aseguramiento de la Calidad, desde el componente de Gestion por Procesos y la Informacion, autoriza tu ingreso al sistema institucional de consulta de informacion documentada.</p>`,
      bodyHtml: `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 8px;"><strong>Usuario:</strong> ${safeUser}</p>
          <p style="margin: 0 0 8px;"><strong>Contraseña temporal:</strong> ${escapeHtml(tempPassword)}</p>
          <p style="margin: 0;"><strong>Rol asignado:</strong> ${safeRole}</p>
        </div>
        <p>Debes iniciar sesion unicamente con el correo institucional registrado en la base de datos del sistema.</p>
        <p>Este acceso esta habilitado para la consulta de documentos en el sistema institucional de informacion documentada, segun los permisos asignados a tu perfil.</p>
        <a href="${loginUrl}" style="display: inline-block; background: #0b3a6f; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; margin-top: 8px;">
          Ingresar al sistema
        </a>
        <p style="margin-top: 14px; color: #334155;">Si no puedes ingresar, comunicate con el equipo administrador de soporte.</p>
      `
    })
  };

  mailOptions.text = `Estimado(a) ${user.nombre}. Se informa que ha sido autorizado su acceso al sistema institucional de consulta de información documentada. Correo institucional registrado: ${user.email}. Rol asignado: ${resolveRoleLabel(user.role)}. Para ingresar al sistema, deberá iniciar sesión exclusivamente mediante la opción Acceder con Google, utilizando el correo institucional previamente registrado en la base de datos. El acceso otorgado le permitirá realizar la consulta de documentos dentro del sistema institucional de información documentada, conforme a los permisos asignados a su perfil. Ingreso: ${loginUrl}. Si requiere apoyo, comuníquese con el equipo administrador al teléfono (602) 7444344 ext. 1386 o al correo sgc@unicesmag.edu.co.`;
  mailOptions.html = renderInstitutionalTemplate({
    title: 'Activación de usuario',
    introHtml: `<p style="margin-bottom: 10px;">Cordial Saludo de Paz y Bien,</p><p>Estimado(a) <strong>${safeNombre}</strong>,</p><p>Se informa que ha sido autorizado su acceso al sistema institucional de consulta de información documentada.</p>`,
    bodyHtml: `
      <div style="margin: 18px 0; border: 1px solid #d6e4f5; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 8px 22px rgba(11, 58, 111, 0.08);">
        <div style="background: linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%); border-bottom: 1px solid #d6e4f5; padding: 12px 18px;">
          <p style="margin: 0; font-weight: 800; color: #0b3a6f; letter-spacing: 0.02em;">Datos de acceso</p>
        </div>
        <div style="padding: 16px 18px;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 0 0 10px; font-weight: 700; color: #334155; width: 240px;">Correo institucional registrado</td>
              <td style="padding: 0 0 10px; color: #0f172a;">
                <a href="mailto:${safeRecipient}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${safeRecipient}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 0; font-weight: 700; color: #334155;">Rol asignado</td>
              <td style="padding: 0; color: #0f172a;">${safeRole}</td>
            </tr>
          </table>
        </div>
      </div>
      <p>Para ingresar al sistema, deberá iniciar sesión exclusivamente mediante la opción <strong>Acceder con Google</strong>, utilizando el correo institucional previamente registrado en la base de datos.</p>
      <p>El acceso otorgado le permitirá realizar la consulta de documentos dentro del sistema institucional de información documentada, conforme a los permisos asignados a su perfil.</p>
      <div style="text-align: center; margin-top: 8px;">
        <a href="${loginUrl}" style="display: inline-block; min-width: 250px; background: #0b3a6f; color: #ffffff; padding: 12px 26px; text-decoration: none; border-radius: 8px; font-weight: 700; text-align: center;">
          Ingresar al sistema
        </a>
      </div>
      <p style="margin: 16px 0 0; color: #334155;">Si no puedes ingresar, comunicate con el equipo administrador.</p>
      <div style="margin: 18px 0 0; border: 1px solid #d6e4f5; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 8px 22px rgba(11, 58, 111, 0.06);">
        <div style="background: linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%); border-bottom: 1px solid #d6e4f5; padding: 12px 18px;">
          <p style="margin: 0; font-weight: 800; color: #0b3a6f; letter-spacing: 0.02em;">Equipo Gestión por Procesos</p>
        </div>
        <div style="padding: 16px 18px; color: #334155;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 0 0 10px; font-weight: 700; color: #334155; width: 120px;">Teléfono</td>
              <td style="padding: 0 0 10px; color: #0f172a;">(602) 7444344 ext. 1386</td>
            </tr>
            <tr>
              <td style="padding: 0; font-weight: 700; color: #334155;">Correo</td>
              <td style="padding: 0; color: #0f172a;">
                <a href="mailto:sgc@unicesmag.edu.co" style="color: #2563eb; text-decoration: none; font-weight: 600;">sgc@unicesmag.edu.co</a>
              </td>
            </tr>
          </table>
        </div>
      </div>
    `
  });
  
  try {
    const smtpConfigError = getSmtpConfigError();
    if (smtpConfigError) {
      return { success: false, error: smtpConfigError };
    }
    await transporter.sendMail(mailOptions);
    console.log('✅ Email enviado a:', safeRecipient);
    return { success: true };
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return { success: false, error: error.message };
  }
};

const sendPasswordResetEmail = async (user, resetToken) => {
  const safeRecipient = normalizeRecipient(user.email);
  const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;
  const safeNombre = escapeHtml(user.nombre);
  
  const mailOptions = {
    from: resolveMailFrom(),
    to: safeRecipient,
    subject: 'Recuperación de Contraseña - Sistema de Gestión',
    text: `Hola ${user.nombre}, usa este enlace para restablecer tu contraseña: ${resetUrl}. El enlace expira en 1 hora.`,
    html: renderInstitutionalTemplate({
      title: 'Recuperacion de contraseña',
      introHtml: `<p>Hola <strong>${safeNombre}</strong>,</p><p>Has solicitado restablecer tu contraseña.</p>`,
      bodyHtml: `
        <a href="${resetUrl}" style="display: inline-block; background: #0b3a6f; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; margin: 8px 0 12px;">
          Restablecer contraseña
        </a>
        <p style="color: #475569;">Este enlace expirara en 1 hora. Si no solicitaste este cambio, ignora este correo.</p>
      `
    })
  };
  
  try {
    const smtpConfigError = getSmtpConfigError();
    if (smtpConfigError) {
      return { success: false, error: smtpConfigError };
    }
    await transporter.sendMail(mailOptions);
    console.log('✅ Email de recuperación enviado a:', safeRecipient);
    return { success: true };
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return { success: false, error: error.message };
  }
};

const sendTemporaryPasswordEmail = async (user, tempPassword) => {
  const safeRecipient = normalizeRecipient(user.email);
  const loginUrl = `${frontendUrl}/login`;
  const safeNombre = escapeHtml(user.nombre);
  const safeUser = escapeHtml(user.username || user.email);

  const mailOptions = {
    from: resolveMailFrom(),
    to: safeRecipient,
    subject: 'Nueva contraseña temporal - Sistema de Gestión',
    text: `Hola ${user.nombre}, tu usuario es ${user.username || user.email} y tu nueva contraseña temporal es ${tempPassword}. Inicia sesión en ${loginUrl} y cámbiala al entrar.`,
    html: renderInstitutionalTemplate({
      title: 'Restablecimiento por administrador',
      introHtml: `<p>Hola <strong>${safeNombre}</strong>,</p><p>Un administrador restablecio tu acceso. Usa estas credenciales temporales:</p>`,
      bodyHtml: `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 8px;"><strong>Usuario:</strong> ${safeUser}</p>
          <p style="margin: 0;"><strong>Contraseña temporal:</strong> ${escapeHtml(tempPassword)}</p>
        </div>
        <a href="${loginUrl}" style="display: inline-block; background: #0b3a6f; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px;">
          Ir al sistema
        </a>
      `
    })
  };

  try {
    const smtpConfigError = getSmtpConfigError();
    if (smtpConfigError) {
      return { success: false, error: smtpConfigError };
    }
    await transporter.sendMail(mailOptions);
    console.log('✅ Email de contraseña temporal enviado a:', safeRecipient);
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
