const nodemailer = require('nodemailer');

// Configurar transportador de email
const transporter = nodemailer.createTransport({
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const isLocal = frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1');
const INSTITUTIONAL_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@unicesmag\.edu\.co$/i;


const roleLabels = {
  administrador: 'Administrador General',
  consulta: 'Consulta',
  gestion_por_procesos: 'Gestion por Procesos',
  planeacion_estrategica: 'Planeacion Estrategica',
  planeacion_efectividad: 'Planeacion y Efectividad',
  autoevaluacion: 'Autoevaluacion',
  gestion_informacion: 'Gestion de la Informacion',
  registros_calificados_acreditacion: 'Registros Calificados y Acreditacion'
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const stripAccents = (value) =>
  String(value || '')
    .replace(/ñ/g, '__enie_min__')
    .replace(/Ñ/g, '__enie_may__')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/__enie_min__/g, 'ñ')
    .replace(/__enie_may__/g, 'Ñ');

const sanitizeEmailTextLegacy = (value) => {
  if (value === undefined || value === null) return value;
  let text = String(value);
  const repairCommonWords = (input) => String(input)
    .replace(/\bInvestigacin\b/g, 'Investigacion')
    .replace(/\binvestigacin\b/g, 'investigacion')
    .replace(/\bMedelln\b/g, 'Medellin')
    .replace(/\bInformacin\b/g, 'Informacion')
    .replace(/\binformacin\b/g, 'informacion')
    .replace(/\bGestin\b/g, 'Gestion')
    .replace(/\bgestin\b/g, 'gestion')
    .replace(/\bRadicacin\b/g, 'Radicacion')
    .replace(/\bradicacin\b/g, 'radicacion')
    .replace(/\bAprobacin\b/g, 'Aprobacion')
    .replace(/\baprobacin\b/g, 'aprobacion')
    .replace(/\bRevisin\b/g, 'Revision')
    .replace(/\brevisin\b/g, 'revision')
    .replace(/\bAutorizacin\b/g, 'Autorizacion')
    .replace(/\bautorizacin\b/g, 'autorizacion')
    .replace(/\bAtencin\b/g, 'Atencion')
    .replace(/\batencin\b/g, 'atencion')
    .replace(/\bTrmite\b/g, 'Tramite')
    .replace(/\btrmite\b/g, 'tramite')
    .replace(/\bTransaccin\b/g, 'Transaccion')
    .replace(/\btransaccin\b/g, 'transaccion')
    .replace(/\bVerificacin\b/g, 'Verificacion')
    .replace(/\bverificacin\b/g, 'verificacion');

  for (let i = 0; i < 2 && /[ÃÂâï¿½�]/.test(text); i += 1) {
    try {
      const repaired = Buffer.from(text, 'latin1').toString('utf8');
      if (!repaired || repaired === text) break;
      text = repaired;
    } catch (_) {
      break;
    }
  }

  text = text
    .replace(/Ã¡/g, 'a').replace(/Ã©/g, 'e').replace(/Ã­/g, 'i').replace(/Ã³/g, 'o').replace(/Ãº/g, 'u')
    .replace(/Ã/g, 'A').replace(/Ã‰/g, 'E').replace(/Ã/g, 'I').replace(/Ã“/g, 'O').replace(/Ãš/g, 'U')
    .replace(/Ã±/g, 'n').replace(/Ã‘/g, 'N')
    .replace(/Â¿/g, '').replace(/Â¡/g, '').replace(/Â°/g, 'No.')
    .replace(/â€¢/g, '&bull;')
    .replace(/âœ“/g, '')
    .replace(/â€“|â€”/g, '-')
    .replace(/â€œ|â€/g, '"')
    .replace(/â€˜|â€™/g, "'")
    .replace(/ï¿½|�/g, '')
    .replace(/Ã|Â|â/g, '');

  text = text
    .replace(/\$\s*FLUJO DE FIRMAS COMPLETADO/g, 'FLUJO DE FIRMAS COMPLETADO')
    .replace(/"\s*Solicitado por/g, '&bull; Solicitado por')
    .replace(/"\s*Aprobado por/g, '&bull; Aprobado por')
    .replace(/\bGestin\b/g, 'Gestion')
    .replace(/\bDireccin\b/g, 'Direccion')
    .replace(/\bPlaneacin\b/g, 'Planeacion')
    .replace(/\bAtencin\b/g, 'Atencion')
    .replace(/\bRevisin\b/g, 'Revision')
    .replace(/\bAprobacin\b/g, 'Aprobacion')
    .replace(/\bIncorporacin\b/g, 'Incorporacion')
    .replace(/\bInformacin\b/g, 'Informacion')
    .replace(/\bNotificacin\b/g, 'Notificacion')
    .replace(/\bValidacin\b/g, 'Validacion')
    .replace(/\bAutorizacin\b/g, 'Autorizacion')
    .replace(/\bFinalizacin\b/g, 'Finalizacion')
    .replace(/\bComunicacin\b/g, 'Comunicacion')
    .replace(/\bProgramacin\b/g, 'Programacion')
    .replace(/\bRelacin\b/g, 'Relacion')
    .replace(/\bSituacin\b/g, 'Situacion')
    .replace(/\bObservacin\b/g, 'Observacion')
    .replace(/\bReposicin\b/g, 'Reposicion')
    .replace(/\bTransaccin\b/g, 'Transaccion')
    .replace(/\bVerificacin\b/g, 'Verificacion')
    .replace(/\bDecisin\b/g, 'Decision')
    .replace(/\bRadicacin\b/g, 'Radicacion')
    .replace(/\bTrmite\b/g, 'Tramite')
    .replace(/\bAutomtico\b/g, 'Automatico')
    .replace(/\bDireccin\b/g, 'Direccion')
    .replace(/\bPlaneacin\b/g, 'Planeacion')
    .replace(/\batencin\b/g, 'atencion')
    .replace(/\brevisin\b/g, 'revision')
    .replace(/\baprobacin\b/g, 'aprobacion')
    .replace(/\bincorporacin\b/g, 'incorporacion')
    .replace(/\binformacin\b/g, 'informacion')
    .replace(/\bnotificacin\b/g, 'notificacion')
    .replace(/\bvalidacin\b/g, 'validacion')
    .replace(/\bautorizacin\b/g, 'autorizacion')
    .replace(/\bfinalizacin\b/g, 'finalizacion')
    .replace(/\bcomunicacin\b/g, 'comunicacion')
    .replace(/\bprogramacin\b/g, 'programacion')
    .replace(/\brelacin\b/g, 'relacion')
    .replace(/\bsituacin\b/g, 'situacion')
    .replace(/\bobservacin\b/g, 'observacion')
    .replace(/\breposicin\b/g, 'reposicion')
    .replace(/\btransaccin\b/g, 'transaccion')
    .replace(/\bverificacin\b/g, 'verificacion')
    .replace(/\bdecisin\b/g, 'decision')
    .replace(/\bdireccin\b/g, 'direccion')
    .replace(/\bradicacin\b/g, 'radicacion')
    .replace(/\bgestin\b/g, 'gestion')
    .replace(/\btrmite\b/g, 'tramite')
    .replace(/\bautomtico\b/g, 'automatico');

  return repairCommonWords(stripAccents(text));
};

// Preserve valid UTF-8 (including Spanish accents) and only repair text that
// actually contains the characteristic markers of UTF-8 decoded as Latin-1.
// The former sanitizer stripped accents from every outgoing message and could
// turn words such as "Técnico" and "viáticos" into corrupted text.
const mojibakeScore = (value) => {
  const matches = String(value || '').match(/(?:Ã.|Â.|â(?:€|€™|€œ|€|€“|€”|€¢)|ï¿½|�)/g);
  return matches ? matches.length : 0;
};

const repairMojibake = (value) => {
  let text = String(value);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const currentScore = mojibakeScore(text);
    if (currentScore === 0) break;

    const candidate = Buffer.from(text, 'latin1').toString('utf8');
    const candidateScore = mojibakeScore(candidate);

    // A replacement character means the conversion lost information. In that
    // case retain the original value instead of making the corruption worse.
    if (!candidate || candidate.includes('\uFFFD') || candidateScore >= currentScore) break;
    text = candidate;
  }

  return text;
};

const sanitizeEmailText = (value) => {
  if (value === undefined || value === null) return value;
  return repairMojibake(value);
};

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
  if (smtpUser) return `SIAC UNICESMAG <${smtpUser}>`;
  return 'noreply@unicesmag.edu.co';
};

const resolveRoleLabel = (role) => roleLabels[String(role || '').trim()] || String(role || 'Sin rol');

const renderInstitutionalTemplate = ({ title, introHtml, bodyHtml, senderHtml }) => {
  const finalSenderHtml = senderHtml || `
    <p style="margin: 0; font-weight: bold; color: #0b3a6f;">SIAC UNICESMAG</p>
    <p style="margin: 2px 0 0 0; font-size: 11.5px; color: #64748b;">Hombres nuevos para tiempos nuevos</p>
  `;
  const imageSrc = isLocal ? 'cid:encabezadocorreos' : `${frontendUrl}/Encabezado_correos.png`;
  return `
  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a; border: 1px solid #dbeafe; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(11, 58, 111, 0.05); background-color: #ffffff;">
    <!-- Encabezado Institucional -->
    <div style="background-color: #ffffff; border-bottom: 1px solid #f1f5f9; text-align: center;">
      <img src="${imageSrc}" alt="Universidad CESMAG" width="640" style="display: block; width: 640px; max-width: 100%; height: auto; margin: 0 auto; border: 0;" />
    </div>
    
    <!-- Barra Azul -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0b3a6f; color: #ffffff;">
      <tr>
        <td style="padding: 12px 20px;">
          <div style="font-size: 14px; font-weight: bold; margin: 0; letter-spacing: 0.5px;">SIAC UNICESMAG</div>
          <div style="font-size: 11px; opacity: 0.95; margin-top: 2px;">Sistema Interno de Aseguramiento de la Calidad</div>
        </td>
      </tr>
    </table>
    
    <!-- Cuerpo del Mensaje -->
    <div style="padding: 24px 20px; background-color: #ffffff;">
      <h3 style="margin-top: 0; color: #0b3a6f; font-size: 17px; border-bottom: 2px solid #eff6ff; padding-bottom: 8px; margin-bottom: 16px;">${title}</h3>
      <div style="font-size: 14.5px; line-height: 1.5; color: #334155;">
        ${introHtml}
        ${bodyHtml}
      </div>
      
      <!-- Cierre Fraternal -->
      <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px; color: #475569; font-size: 13.5px;">
        <p style="margin: 0 0 6px 0; font-style: italic; color: #475569;">Fraternalmente,</p>
        ${finalSenderHtml}
      </div>
      
      <!-- Nota de no responder -->
      <div style="margin-top: 24px; text-align: center; background-color: #f8fafc; border: 1px dashed #cbd5e1; padding: 12px; border-radius: 8px;">
        <p style="color: #64748b; font-size: 11px; margin: 0;">
          Este es un correo institucional automático. Por favor, no responder a esta dirección.
        </p>
      </div>
    </div>
  </div>
`;
};

const getSandboxRecipient = () => {
  const raw = process.env.EMAIL_SANDBOX_RECIPIENT;
  if (!raw || !String(raw).trim()) return null;
  return String(raw).trim().toLowerCase();
};

const prepareMailOptions = (options) => {
  const path = require('path');
  const fs = require('fs');
  const headerImagePath = path.join(__dirname, '..', 'assets', 'Encabezado_correos.png');
  
  const finalOptions = { ...options };
  const sandboxRecipient = getSandboxRecipient();

  if (sandboxRecipient) {
    const originalTo = Array.isArray(finalOptions.to) ? finalOptions.to.join(', ') : finalOptions.to;
    finalOptions.to = sandboxRecipient;
    if (!String(finalOptions.subject || '').includes('[PRUEBA SANDBOX')) {
      finalOptions.subject = `[PRUEBA SANDBOX · Para: ${originalTo}] ${finalOptions.subject || ''}`;
    }
  }

  if (!finalOptions.attachments) finalOptions.attachments = [];
  
  if (finalOptions.html && finalOptions.html.includes('cid:encabezadocorreos') && fs.existsSync(headerImagePath)) {
    const hasCid = finalOptions.attachments.some(att => att.cid === 'encabezadocorreos');
    if (!hasCid) {
      finalOptions.attachments.push({
        filename: 'Encabezado_correos.png',
        path: headerImagePath,
        cid: 'encabezadocorreos',
        disposition: 'inline'
      });
    }
  }
  return finalOptions;
};

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
    subject: 'UNICESMAG | ACTIVACION DE USUARIO EN SIAC',
    text: `Hola ${user.nombre}. Tu usuario fue activado en SIAC UNICESMAG. Usuario: ${user.username || user.email}. Rol: ${resolveRoleLabel(user.role)}. Contraseña temporal: ${tempPassword}. Ingresa en ${loginUrl}`,
    html: renderInstitutionalTemplate({
      title: 'Activacion de acceso',
      introHtml: `<p>Hola <strong>${safeNombre}</strong>,</p><p>La Direccion de Planeacion y Aseguramiento de la Calidad autoriza tu ingreso a SIAC UNICESMAG, sistema interno de aseguramiento de la calidad.</p>`,
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
        <p style="margin-top: 14px; color: #334155;">Si no puedes ingresar, comunicate con Soporte del sistema.</p>
      `
    })
  };

  mailOptions.text = `Estimado(a) ${user.nombre}. Se informa que ha sido autorizado su acceso al sistema institucional de consulta de información documentada. Correo institucional registrado: ${user.email}. Rol asignado: ${resolveRoleLabel(user.role)}. Para ingresar al sistema, deberá iniciar sesión exclusivamente mediante la opción Acceder con Google, utilizando el correo institucional previamente registrado en la base de datos. El acceso otorgado le permitirá realizar la consulta de documentos dentro del sistema institucional de información documentada, conforme a los permisos asignados a su perfil. Ingreso: ${loginUrl}. Si requiere apoyo, comuníquese con Soporte del sistema al teléfono (602) 7444344 ext. 1386 o al correo sgc@unicesmag.edu.co.`;
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
      <p style="margin: 16px 0 0; color: #334155;">Si no puedes ingresar, comunicate con Soporte del sistema.</p>
      <div style="margin: 18px 0 0; border: 1px solid #d6e4f5; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 8px 22px rgba(11, 58, 111, 0.06);">
        <div style="background: linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%); border-bottom: 1px solid #d6e4f5; padding: 12px 18px;">
          <p style="margin: 0; font-weight: 800; color: #0b3a6f; letter-spacing: 0.02em;">Soporte del sistema</p>
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
  mailOptions.text = `Estimado(a) ${user.nombre}. Se informa que ha sido autorizado su acceso al Sistema Interno de Aseguramiento de la Calidad - SIAC UNICESMAG, donde podra consultar informacion institucional de acuerdo con los permisos asignados a su perfil. Correo institucional registrado: ${user.email}. Rol asignado: ${resolveRoleLabel(user.role)}. Para ingresar al sistema, debera iniciar sesion exclusivamente mediante la opcion Acceder con Google, utilizando el correo institucional. Ingreso: ${loginUrl}. Si requiere apoyo, comuniquese con Soporte del sistema al telefono (602) 7444344 ext. 1386 o al correo sgc@unicesmag.edu.co.`;
  mailOptions.html = renderInstitutionalTemplate({
    title: 'Activacion de usuario',
    introHtml: `<p style="margin-bottom: 10px;">Cordial Saludo de Paz y Bien,</p><p>Estimado(a) <strong>${safeNombre}</strong>,</p><p>Se informa que ha sido autorizado su acceso al <strong>Sistema Interno de Aseguramiento de la Calidad - SIAC UNICESMAG</strong>, donde podra consultar informacion institucional de acuerdo con los permisos asignados a su perfil.</p>`,
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
      <p>Para ingresar al sistema, debera iniciar sesion exclusivamente mediante la opcion <strong>Acceder con Google</strong>, utilizando el correo institucional.</p>
      <div style="text-align: center; margin-top: 8px;">
        <a href="${loginUrl}" style="display: inline-block; min-width: 250px; background: #0b3a6f; color: #ffffff; padding: 12px 26px; text-decoration: none; border-radius: 8px; font-weight: 700; text-align: center;">
          Ingresar al sistema
        </a>
      </div>
      <p style="margin: 16px 0 0; color: #334155;">Si requiere apoyo para el ingreso o uso del sistema, comuniquese con Soporte del sistema.</p>
      <div style="margin: 18px 0 0; border: 1px solid #d6e4f5; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 8px 22px rgba(11, 58, 111, 0.06);">
        <div style="background: linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%); border-bottom: 1px solid #d6e4f5; padding: 12px 18px;">
          <p style="margin: 0; font-weight: 800; color: #0b3a6f; letter-spacing: 0.02em;">Soporte del sistema</p>
        </div>
        <div style="padding: 16px 18px; color: #334155;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 0 0 10px; font-weight: 700; color: #334155; width: 120px;">Telefono</td>
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
    await transporter.sendMail(prepareMailOptions(mailOptions));
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
    subject: 'Recuperación de Contraseña - SIAC UNICESMAG',
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
    await transporter.sendMail(prepareMailOptions(mailOptions));
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
    subject: 'Nueva contraseña temporal - SIAC UNICESMAG',
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
    await transporter.sendMail(prepareMailOptions(mailOptions));
    console.log('✅ Email de contraseña temporal enviado a:', safeRecipient);
    return { success: true };
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return { success: false, error: error.message };
  }
};

const sendInstitutionalEmail = async ({ to, subject, text, html, attachments = [], replyTo = '', headers = {}, messageId = '', inReplyTo = '', references = '' }) => {
  const recipients = Array.isArray(to) ? to : [to];
  const safeRecipients = recipients.map(normalizeRecipient);

  const smtpConfigError = getSmtpConfigError();
  if (smtpConfigError) {
    return { success: false, error: smtpConfigError };
  }

  const originalTargets = safeRecipients.join(', ');
  const sandboxRecipient = getSandboxRecipient();
  const targetRecipients = sandboxRecipient ? [sandboxRecipient] : safeRecipients;
  const targetSubject = sandboxRecipient && !String(subject || '').includes('[PRUEBA SANDBOX')
    ? `[PRUEBA SANDBOX · Para: ${originalTargets}] ${sanitizeEmailText(subject)}`
    : sanitizeEmailText(subject);

  const mailOptions = {
    from: resolveMailFrom(),
    to: targetRecipients.join(', '),
    subject: targetSubject,
    text: sanitizeEmailText(text),
    html: sanitizeEmailText(html),
    attachments,
    headers
  };

  if (messageId) mailOptions.messageId = messageId;
  if (inReplyTo) mailOptions.inReplyTo = inReplyTo;
  if (references) mailOptions.references = references;

  if (!inReplyTo && headers['In-Reply-To']) {
    mailOptions.inReplyTo = headers['In-Reply-To'];
  }
  if (!references && headers['References']) {
    mailOptions.references = headers['References'];
  }

  if (replyTo) {
    mailOptions.replyTo = normalizeRecipient(replyTo);
  }

  try {
    const info = await transporter.sendMail(prepareMailOptions(mailOptions));
    return { success: true, messageId: info?.messageId };
  } catch (error) {
    console.error('Error enviando correo institucional:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendTemporaryPasswordEmail,
  sendInstitutionalEmail,
  sendMailDirect: sendInstitutionalEmail,
  renderInstitutionalTemplate,
  escapeHtml,
  _internals: {
    sanitizeEmailText,
    repairMojibake
  }
};
