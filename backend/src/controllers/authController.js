const jwt = require('jsonwebtoken');
const { jwtSecret, signOptions } = require('../config/jwt');
const { User } = require('../models');
const { buildUserPayloadWithPermissions } = require('../utils/modulePermissions');
const { OAuth2Client } = require('google-auth-library');
const UserActivityLog = require('../models/UserActivityLog');

const getInstitutionalDomain = () => (process.env.INSTITUTIONAL_EMAIL_DOMAIN || 'unicesmag.edu.co').trim().toLowerCase();
const frontendUrl = String(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');

const isInstitutionalEmail = (email = '') => {
  const domain = getInstitutionalDomain();
  const normalized = String(email || '').trim().toLowerCase();
  return normalized.endsWith(`@${domain}`);
};

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

const verifyGoogleCredentialAndBuildSession = async (credential = '') => {
  if (!googleClient || !googleClientId) {
    return { error: { status: 500, message: 'Google login no esta configurado en el servidor.' } };
  }

  if (!credential) {
    return { error: { status: 400, message: 'Falta la credencial de Google.' } };
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: googleClientId
  });

  const payload = ticket.getPayload() || {};
  const email = String(payload.email || '').trim().toLowerCase();
  const emailVerified = Boolean(payload.email_verified);
  const hostedDomain = String(payload.hd || '').trim().toLowerCase();

  if (!email || !emailVerified) {
    return { error: { status: 401, message: 'El correo de Google no esta verificado.' } };
  }

  if (!isInstitutionalEmail(email)) {
    return { error: { status: 403, message: 'Solo se permite correo institucional.' } };
  }

  const institutionalDomain = getInstitutionalDomain();
  if (hostedDomain && hostedDomain !== institutionalDomain) {
    return { error: { status: 403, message: 'Dominio institucional no autorizado.' } };
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return {
      error: {
        status: 404,
        message: 'Tu correo institucional no esta registrado. Solicita creacion de usuario al administrador.'
      }
    };
  }

  if (user.estado !== 'activo') {
    return { error: { status: 403, message: 'Tu usuario esta inactivo. Contacta al administrador.' } };
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, signOptions);
  await user.update({ last_login: new Date() });
  const userPayload = await buildUserPayloadWithPermissions(user);

  /* fire-and-forget login event */
  setImmediate(async () => {
    try {
      await UserActivityLog.create({
        user_id:    user.id,
        user_name:  user.nombre || user.name || null,
        user_email: user.email || null,
        user_role:  user.role  || null,
        module:     'Sistema',
        action:     'Inicio de sesión',
        method:     'POST',
        endpoint:   '/api/auth/google',
        ip_address: null,
        user_agent: null,
      });
    } catch (_) { /* silent */ }
  });

  return {
    data: {
      token,
      requiresPasswordChange: false,
      user: userPayload
    }
  };
};


const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    const result = await verifyGoogleCredentialAndBuildSession(credential);
    if (result?.error) {
      return res.status(result.error.status).json({ success: false, message: result.error.message });
    }

    return res.json({
      success: true,
      message: 'Login exitoso',
      data: result.data
    });
  } catch (error) {
    const detail = String(error?.message || '').toLowerCase();
    if (detail.includes('wrong number of segments')) {
      return res.status(400).json({
        success: false,
        message: 'Credencial de Google invalida o incompleta. Verifica configuracion OAuth (origines autorizados).'
      });
    }
    if (detail.includes('audience') || detail.includes('aud')) {
      return res.status(400).json({
        success: false,
        message: 'El token de Google no corresponde al GOOGLE_CLIENT_ID configurado.'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Error al iniciar sesion con Google',
      detail: process.env.NODE_ENV === 'production' ? undefined : (error?.message || null)
    });
  }
};

const googleRedirectLogin = async (req, res) => {
  try {
    const credential = String(req.body?.credential || '').trim();
    const result = await verifyGoogleCredentialAndBuildSession(credential);
    if (result?.error) {
      return res.redirect(`${frontendUrl}/login#google_error=${encodeURIComponent(result.error.message)}`);
    }
    return res.redirect(`${frontendUrl}/login#token=${encodeURIComponent(result.data.token)}`);
  } catch (_error) {
    return res.redirect(`${frontendUrl}/login#google_error=${encodeURIComponent('Error al iniciar sesion con Google')}`);
  }
};


const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user || user.estado !== 'activo') {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    const userPayload = await buildUserPayloadWithPermissions(user);
    return res.json({ success: true, data: { user: userPayload } });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Error al cargar perfil' });
  }
};

module.exports = { googleLogin, googleRedirectLogin, getProfile };
