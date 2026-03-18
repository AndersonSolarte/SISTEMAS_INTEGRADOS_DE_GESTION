const DEFAULT_TIMEOUT_MS = Number(process.env.SABER_PRO_PYTHON_TIMEOUT_MS || 15000);

const getBaseUrl = () => {
  const value = String(process.env.SABER_PRO_PYTHON_URL || '').trim();
  return value ? value.replace(/\/+$/, '') : '';
};

const isEnabled = () => Boolean(getBaseUrl());

const buildUrl = (path) => `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

const withTimeout = async (promise, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await promise(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};

const request = async ({ method = 'GET', path = '/', body = null }) => {
  if (!isEnabled()) return null;

  const url = buildUrl(path);
  try {
    const response = await withTimeout(
      (signal) => fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal
      }),
      DEFAULT_TIMEOUT_MS
    );

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = json?.message || json?.detail || `Python service error ${response.status}`;
      throw new Error(message);
    }
    return json;
  } catch (error) {
    error.message = `Python Saber Pro analytics unavailable: ${error.message}`;
    throw error;
  }
};

module.exports = {
  isEnabled,
  request
};
