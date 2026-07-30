const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA';

const verifyTurnstileToken = async ({ token, remoteIp, expectedAction }) => {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) {
    return { success: false, status: 400, message: 'Complete la verificación de seguridad' };
  }

  const production = process.env.NODE_ENV === 'production';
  const secret = String(process.env.TURNSTILE_SECRET_KEY || (production ? '' : TURNSTILE_TEST_SECRET)).trim();
  if (!secret) {
    return { success: false, status: 503, message: 'La verificación de seguridad no está configurada en el servidor' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const payload = new URLSearchParams({ secret, response: cleanToken });
    if (remoteIp) payload.set('remoteip', String(remoteIp));
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload,
      signal: controller.signal
    });
    if (!verification.ok) throw new Error(`Siteverify respondió ${verification.status}`);
    const result = await verification.json();
    if (!result.success || (expectedAction && result.action !== expectedAction)) {
      return { success: false, status: 403, message: 'La verificación de seguridad expiró o no es válida. Inténtelo nuevamente.' };
    }
    return { success: true, result };
  } catch (_error) {
    return { success: false, status: 503, message: 'No fue posible validar la verificación de seguridad. Inténtelo nuevamente.' };
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = { verifyTurnstileToken };
