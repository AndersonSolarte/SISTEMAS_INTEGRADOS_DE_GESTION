const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const GENERAL_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const HEADER_IMAGE_PATH = path.join(__dirname, '..', 'assets', 'Encabezado_correos.png');

let cachedTransporter = null;
let cachedTransporterKey = '';

const normalizeRecipient = (value) => {
  const email = String(value || '').trim().toLowerCase();
  if (!GENERAL_EMAIL_REGEX.test(email)) throw new Error('Correo destino inválido.');
  return email;
};

const getSandboxRecipient = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && String(process.env.ALLOW_PRODUCTION_SANDBOX || 'false').toLowerCase() !== 'true') return null;
  const recipient = String(process.env.EMAIL_SANDBOX_RECIPIENT || '').trim();
  return recipient ? normalizeRecipient(recipient) : null;
};

const resolveConfig = () => {
  const host = String(process.env.PLAN_ACTION_SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.PLAN_ACTION_SMTP_PORT || 587);
  const secure = String(process.env.PLAN_ACTION_SMTP_SECURE || 'false').toLowerCase() === 'true';
  const legacyAuthRequired = String(process.env.PLAN_ACTION_SMTP_AUTH || 'true').toLowerCase() !== 'false';
  const authMethod = String(process.env.PLAN_ACTION_EMAIL_AUTH_METHOD || (legacyAuthRequired ? 'password' : 'relay')).trim().toLowerCase();
  const requireTLS = String(process.env.PLAN_ACTION_SMTP_REQUIRE_TLS || 'true').toLowerCase() !== 'false';
  const user = String(process.env.PLAN_ACTION_SMTP_USER || '').trim();
  const pass = String(process.env.PLAN_ACTION_SMTP_PASS || '').replace(/\s+/g, '');
  const from = String(process.env.PLAN_ACTION_SMTP_FROM || '').trim()
    || `Planeación Estratégica UNICESMAG <${user}>`;
  const replyTo = String(process.env.PLAN_ACTION_REPLY_TO || user).trim();
  const oauthClientId = String(process.env.PLAN_ACTION_GOOGLE_CLIENT_ID || '').trim();
  const oauthClientSecret = String(process.env.PLAN_ACTION_GOOGLE_CLIENT_SECRET || '').trim();
  const oauthRefreshToken = String(process.env.PLAN_ACTION_GOOGLE_REFRESH_TOKEN || '').trim();

  if (!['password', 'relay', 'oauth2'].includes(authMethod)) {
    throw new Error('PLAN_ACTION_EMAIL_AUTH_METHOD debe ser password, relay u oauth2.');
  }
  if (!user) throw new Error('Falta PLAN_ACTION_SMTP_USER.');
  if (authMethod !== 'oauth2' && (!host || !Number.isFinite(port) || port <= 0)) {
    throw new Error('Configuración SMTP de Planes de Acción inválida.');
  }
  if (authMethod === 'password' && !pass) throw new Error('Falta PLAN_ACTION_SMTP_PASS para el modo autenticado.');
  if (authMethod === 'oauth2' && (!oauthClientId || !oauthClientSecret || !oauthRefreshToken)) {
    throw new Error('Faltan las credenciales OAuth 2.0 exclusivas de Planes de Acción.');
  }
  if (/CAMBIAR/i.test(user) || (authMethod === 'password' && /CAMBIAR|TU_APP_PASSWORD/i.test(pass))) {
    throw new Error('Las credenciales SMTP de Planes de Acción todavía son valores de ejemplo.');
  }
  return {
    host, port, secure, authMethod, authRequired: authMethod === 'password', requireTLS,
    user, pass, from, replyTo, oauthClientId, oauthClientSecret, oauthRefreshToken
  };
};

const getTransporter = (config) => {
  const key = `${config.host}:${config.port}:${config.secure}:${config.authRequired}:${config.requireTLS}:${config.user}:${config.pass}`;
  if (!cachedTransporter || key !== cachedTransporterKey) {
    const transportOptions = {
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTLS
    };
    if (config.authRequired) transportOptions.auth = { user: config.user, pass: config.pass };
    cachedTransporter = nodemailer.createTransport(transportOptions);
    cachedTransporterKey = key;
  }
  return cachedTransporter;
};

const prepareAttachments = (html, attachments) => {
  const prepared = Array.isArray(attachments) ? [...attachments] : [];
  if (String(html || '').includes('cid:encabezadocorreos') && fs.existsSync(HEADER_IMAGE_PATH)
    && !prepared.some((attachment) => attachment.cid === 'encabezadocorreos')) {
    prepared.push({
      filename: 'Encabezado_correos.png',
      path: HEADER_IMAGE_PATH,
      cid: 'encabezadocorreos',
      disposition: 'inline'
    });
  }
  return prepared;
};

const buildMailOptions = ({ config, recipients, subject, text, html, attachments, replyTo, headers }) => ({
  from: config.from,
  to: recipients.join(', '),
  replyTo: replyTo ? normalizeRecipient(replyTo) : config.replyTo,
  subject,
  text: String(text || ''),
  html: html || undefined,
  attachments: prepareAttachments(html, attachments),
  headers
});

const sendWithGoogleOAuth = async (config, mailOptions) => {
  const oauthClient = new google.auth.OAuth2(config.oauthClientId, config.oauthClientSecret);
  oauthClient.setCredentials({ refresh_token: config.oauthRefreshToken });
  const mimeTransport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  const compiled = await mimeTransport.sendMail(mailOptions);
  const gmail = google.gmail({ version: 'v1', auth: oauthClient });
  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: compiled.message.toString('base64url') }
  });
  return { messageId: response.data?.id };
};

// Transporte exclusivo de Gestión de Planes de Acción.
// No reutiliza ni modifica SMTP_USER/SMTP_PASS del resto de SIAC.
const sendStrategicPlanningEmail = async ({
  to, subject, text, html, attachments = [], replyTo = '', headers = {}
}) => {
  try {
    const recipients = (Array.isArray(to) ? to : [to]).map(normalizeRecipient);
    const originalTargets = recipients.join(', ');
    const sandboxRecipient = getSandboxRecipient();
    const targetRecipients = sandboxRecipient ? [sandboxRecipient] : recipients;
    const targetSubject = sandboxRecipient
      ? `[PRUEBA SANDBOX · Para: ${originalTargets}] ${String(subject || '')}`
      : String(subject || '');
    const config = resolveConfig();
    const mailOptions = buildMailOptions({
      config, recipients: targetRecipients, subject: targetSubject, text, html, attachments, replyTo, headers
    });
    const info = config.authMethod === 'oauth2'
      ? await sendWithGoogleOAuth(config, mailOptions)
      : await getTransporter(config).sendMail(mailOptions);
    return { success: true, messageId: info?.messageId };
  } catch (error) {
    console.error('Error enviando correo exclusivo de Planes de Acción:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendStrategicPlanningEmail,
  _internals: { normalizeRecipient, resolveConfig, prepareAttachments, buildMailOptions }
};
