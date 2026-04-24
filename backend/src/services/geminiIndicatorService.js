const { GoogleGenerativeAI } = require('@google/generative-ai');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

let cachedClient = null;
const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) {
    cachedClient = new GoogleGenerativeAI(apiKey);
  }
  return cachedClient;
};

const SYSTEM_PROMPT = `Eres un asesor experto en Sistemas Integrados de Gestión universitarios en Colombia (SST, calidad, autoevaluación, docencia, investigación, bienestar, gestión documental, planeación estratégica).

Tu tarea: a partir de UNA actividad que redacta el usuario, entregar EXACTAMENTE 6 indicadores accionables que orienten su ejecución.

Reglas obligatorias:
1. Basa todo ÚNICAMENTE en la actividad enviada; no inventes contexto, no añadas marco conceptual.
2. Cada indicador DEBE empezar con un VERBO en infinitivo concreto (Definir, Elaborar, Formalizar, Suscribir, Publicar, Socializar, Capacitar, Gestionar, Aprobar, Implementar, Verificar, Actualizar, Entregar, Radicar, Afiliar, Integrar, etc.).
3. Cada indicador DEBE apuntar a un ENTREGABLE o acción verificable: un documento, una resolución, un acto administrativo, un convenio, un informe, una publicación, una capacitación realizada, una evaluación aplicada, una afiliación tramitada, un sistema implementado, etc.
4. NO uses etiquetas ni categorías al inicio (prohibido "Marco Normativo:", "Diseño:", "Socialización:", "Validación:", etc.). Redacta UNA sola frase directa que describa la acción completa.
5. NO uses fórmulas, porcentajes, números de meta, ni metadatos tipo "Medición", "Unidad", "Frecuencia".
6. Usa vocabulario real del dominio cuando corresponda (COPASST, ARL, EPS, MinTrabajo, microcurrículos, autoevaluación, PHVA, PQRS, Consejo Académico, acto administrativo, etc.) sin forzarlo.
7. Cada indicador tiene máximo 25 palabras, una sola oración, en español de Colombia, profesional y directo.
8. Responde EXCLUSIVAMENTE con JSON válido siguiendo este esquema (sin markdown, sin explicaciones, sin bloques de código):
{
  "titulo_general": "Nombre corto que resume la actividad (3 a 6 palabras)",
  "indicadores": [
    "Verbo + acción + entregable concreto.",
    "Verbo + acción + entregable concreto.",
    "Verbo + acción + entregable concreto.",
    "Verbo + acción + entregable concreto.",
    "Verbo + acción + entregable concreto.",
    "Verbo + acción + entregable concreto."
  ]
}`;

const buildUserPrompt = (actividad) =>
  `Actividad: "${actividad}".\nResponde con el JSON solicitado.`;

const stripCodeFences = (text = '') => {
  const trimmed = String(text || '').trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  return trimmed;
};

const tryParseJson = (text) => {
  const cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (__) { /* fall through */ }
    }
    return null;
  }
};

const stripLeadingLabel = (text = '') =>
  String(text || '')
    .trim()
    .replace(/^(?:[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+){0,3})\s*:\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();

const formatIndicadoresAsBullets = (payload) => {
  if (!payload) return '';
  const items = Array.isArray(payload.indicadores) ? payload.indicadores : [];
  const lines = items
    .map((raw) => stripLeadingLabel(raw))
    .filter(Boolean)
    .map((line, index) => `${index + 1}. ${line}`);

  const header = payload.titulo_general ? `${String(payload.titulo_general).trim()}\n\n` : '';
  return `${header}${lines.join('\n')}`.trim();
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimitError = (error) => {
  const msg = String(error?.message || '');
  return /429|Too Many Requests|quota/i.test(msg);
};

const callGemini = async (model, prompt) => {
  const result = await model.generateContent(prompt);
  return result?.response?.text?.() || '';
};

const classifyGeminiError = (error) => {
  const msg = String(error?.message || '');
  const status = Number(error?.status || error?.response?.status || 0);
  const code = String(error?.code || '');

  if (status === 401 || status === 403 || /API_KEY_INVALID|permission denied|unauthorized|forbidden|invalid api key/i.test(msg)) {
    return { status: 502, code: 'GEMINI_AUTH_ERROR', message: 'La clave de Gemini no es válida o no tiene permisos.' };
  }
  if (status === 404 || /model .*not found|not found for API version|not found/i.test(msg)) {
    return { status: 502, code: 'GEMINI_MODEL_ERROR', message: 'El modelo de Gemini configurado no está disponible.' };
  }
  if (status === 429 || isRateLimitError(error)) {
    return { status: 429, code: 'GEMINI_QUOTA_ERROR', message: 'Gemini superó la cuota temporal o recibió demasiadas solicitudes.' };
  }
  if (/CERT_|certificate|TLS|SSL|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed/i.test(`${code} ${msg}`)) {
    return { status: 502, code: 'GEMINI_NETWORK_ERROR', message: 'El servidor no pudo conectarse correctamente con Gemini.' };
  }
  return { status: 502, code: 'GEMINI_ERROR', message: 'No fue posible generar indicadores con Gemini.' };
};

const suggestIndicators = async (actividad) => {
  const cleanActividad = String(actividad || '').trim();
  if (!cleanActividad) {
    const err = new Error('La actividad es obligatoria para sugerir indicadores.');
    err.status = 400;
    throw err;
  }

  const client = getClient();
  if (!client) {
    const err = new Error('GEMINI_API_KEY no está configurada en el servidor.');
    err.status = 503;
    err.code = 'GEMINI_NOT_CONFIGURED';
    throw err;
  }

  const model = client.getGenerativeModel({
    model: DEFAULT_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json'
    }
  });

  const prompt = buildUserPrompt(cleanActividad);
  const retryDelays = [0, 3000, 8000];
  let lastError = null;
  let raw = '';
  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) await sleep(retryDelays[attempt]);
    try {
      raw = await callGemini(model, prompt);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === retryDelays.length - 1) {
        const classified = classifyGeminiError(error);
        const err = new Error(classified.message);
        err.status = classified.status;
        err.code = classified.code;
        err.cause = error;
        throw err;
      }
    }
  }
  if (lastError) throw lastError;

  const parsed = tryParseJson(raw);
  if (!parsed || !Array.isArray(parsed.indicadores) || parsed.indicadores.length === 0) {
    const err = new Error('La respuesta de Gemini no tiene el formato esperado.');
    err.status = 502;
    err.code = 'GEMINI_BAD_RESPONSE';
    err.raw = raw;
    throw err;
  }

  return {
    tipo: 'Resultado',
    tituloGeneral: parsed.titulo_general || '',
    indicadores: parsed.indicadores,
    bullets: formatIndicadoresAsBullets(parsed)
  };
};

module.exports = {
  suggestIndicators
};
