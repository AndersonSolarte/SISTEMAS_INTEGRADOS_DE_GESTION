const { GoogleGenerativeAI } = require('@google/generative-ai');

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const AI_PROVIDER = String(process.env.AI_PROVIDER || 'auto').trim().toLowerCase();
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OLLAMA_URL = String(process.env.OLLAMA_URL || 'http://host.docker.internal:11434').replace(/\/+$/, '');

let cachedGeminiClient = null;
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!cachedGeminiClient) {
    cachedGeminiClient = new GoogleGenerativeAI(apiKey);
  }
  return cachedGeminiClient;
};

const SYSTEM_PROMPT = `Eres un asesor experto en Sistemas Integrados de Gestion universitarios en Colombia (SST, calidad, autoevaluacion, docencia, investigacion, bienestar, gestion documental, planeacion estrategica).

Tu tarea: a partir de UNA actividad que redacta el usuario, entregar EXACTAMENTE 6 indicadores accionables que orienten su ejecucion.

Reglas obligatorias:
1. Basa todo UNICAMENTE en la actividad enviada; no inventes contexto, no anadas marco conceptual.
2. Cada indicador DEBE empezar con un VERBO en infinitivo concreto (Definir, Elaborar, Formalizar, Suscribir, Publicar, Socializar, Capacitar, Gestionar, Aprobar, Implementar, Verificar, Actualizar, Entregar, Radicar, Afiliar, Integrar, etc.).
3. Cada indicador DEBE apuntar a un ENTREGABLE o accion verificable: un documento, una resolucion, un acto administrativo, un convenio, un informe, una publicacion, una capacitacion realizada, una evaluacion aplicada, una afiliacion tramitada, un sistema implementado, etc.
4. NO uses etiquetas ni categorias al inicio (prohibido "Marco Normativo:", "Diseno:", "Socializacion:", "Validacion:", etc.). Redacta UNA sola frase directa que describa la accion completa.
5. NO uses formulas, porcentajes, numeros de meta, ni metadatos tipo "Medicion", "Unidad", "Frecuencia".
6. Usa vocabulario real del dominio cuando corresponda (COPASST, ARL, EPS, MinTrabajo, microcurriculos, autoevaluacion, PHVA, PQRS, Consejo Academico, acto administrativo, etc.) sin forzarlo.
7. Cada indicador tiene maximo 25 palabras, una sola oracion, en espanol de Colombia, profesional y directo.
8. Responde EXCLUSIVAMENTE con JSON valido siguiendo este esquema (sin markdown, sin explicaciones, sin bloques de codigo):
{
  "titulo_general": "Nombre corto que resume la actividad (3 a 6 palabras)",
  "indicadores": [
    "Verbo + accion + entregable concreto.",
    "Verbo + accion + entregable concreto.",
    "Verbo + accion + entregable concreto.",
    "Verbo + accion + entregable concreto.",
    "Verbo + accion + entregable concreto.",
    "Verbo + accion + entregable concreto."
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
    .replace(/^(?:[A-Z][A-Za-z]+(?:\s+[A-Za-z]+){0,3})\s*:\s*/u, '')
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
  return /429|Too Many Requests|quota|rate limit/i.test(msg);
};

const buildServiceError = ({ status, code, message, cause }) => {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  if (cause) err.cause = cause;
  return err;
};

const classifyGeminiError = (error) => {
  const msg = String(error?.message || '');
  const status = Number(error?.status || error?.response?.status || 0);
  const code = String(error?.code || '');

  if (status === 401 || status === 403 || /API_KEY_INVALID|permission denied|unauthorized|forbidden|invalid api key/i.test(msg)) {
    return { status: 502, code: 'GEMINI_AUTH_ERROR', message: 'La clave de Gemini no es valida o no tiene permisos.' };
  }
  if (status === 404 || /model .*not found|not found for API version|not found/i.test(msg)) {
    return { status: 502, code: 'GEMINI_MODEL_ERROR', message: 'El modelo de Gemini configurado no esta disponible.' };
  }
  if (status === 429 || isRateLimitError(error)) {
    return { status: 429, code: 'GEMINI_QUOTA_ERROR', message: 'Gemini supero la cuota temporal o recibio demasiadas solicitudes.' };
  }
  if (/CERT_|certificate|TLS|SSL|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed/i.test(`${code} ${msg}`)) {
    return { status: 502, code: 'GEMINI_NETWORK_ERROR', message: 'El servidor no pudo conectarse correctamente con Gemini.' };
  }
  return { status: 502, code: 'GEMINI_ERROR', message: 'No fue posible generar indicadores con Gemini.' };
};

const classifyOpenAIError = (error) => {
  const msg = String(error?.message || '');
  const status = Number(error?.status || 0);
  const code = String(error?.code || '');

  if (status === 401 || status === 403 || /invalid api key|incorrect api key|unauthorized|forbidden/i.test(msg)) {
    return { status: 502, code: 'OPENAI_AUTH_ERROR', message: 'La clave de OpenAI no es valida o no tiene permisos.' };
  }
  if (status === 404 || /model.*not found|does not exist|not found/i.test(msg)) {
    return { status: 502, code: 'OPENAI_MODEL_ERROR', message: 'El modelo de OpenAI configurado no esta disponible.' };
  }
  if (status === 429 || /rate limit|quota|too many requests|insufficient_quota/i.test(msg)) {
    return { status: 429, code: 'OPENAI_QUOTA_ERROR', message: 'OpenAI supero la cuota temporal o no tiene saldo disponible.' };
  }
  if (/CERT_|certificate|TLS|SSL|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed/i.test(`${code} ${msg}`)) {
    return { status: 502, code: 'OPENAI_NETWORK_ERROR', message: 'El servidor no pudo conectarse correctamente con OpenAI.' };
  }
  return { status: 502, code: 'OPENAI_ERROR', message: 'No fue posible generar indicadores con OpenAI.' };
};

const classifyOllamaError = (error) => {
  const msg = String(error?.message || '');
  const status = Number(error?.status || 0);
  const code = String(error?.code || '');

  if (status === 404 || /model.*not found|not found|pull model/i.test(msg)) {
    return { status: 502, code: 'OLLAMA_MODEL_ERROR', message: 'El modelo local de Ollama no esta instalado en el servidor.' };
  }
  if (/ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed/i.test(`${code} ${msg}`)) {
    return { status: 502, code: 'OLLAMA_NOT_AVAILABLE', message: 'Ollama no esta disponible en el servidor.' };
  }
  return { status: 502, code: 'OLLAMA_ERROR', message: 'No fue posible generar indicadores con Ollama.' };
};

const extractOpenAIText = (payload) => {
  if (payload?.output_text) return payload.output_text;
  const output = Array.isArray(payload?.output) ? payload.output : [];
  const chunks = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.text) chunks.push(part.text);
    }
  }
  return chunks.join('\n').trim();
};

const callGemini = async (prompt) => {
  const client = getGeminiClient();
  if (!client) {
    throw buildServiceError({
      status: 503,
      code: 'GEMINI_NOT_CONFIGURED',
      message: 'GEMINI_API_KEY no esta configurada en el servidor.'
    });
  }

  const model = client.getGenerativeModel({
    model: DEFAULT_GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json'
    }
  });

  const retryDelays = [0, 3000, 8000];
  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) await sleep(retryDelays[attempt]);
    try {
      const result = await model.generateContent(prompt);
      return result?.response?.text?.() || '';
    } catch (error) {
      if (!isRateLimitError(error) || attempt === retryDelays.length - 1) {
        const classified = classifyGeminiError(error);
        throw buildServiceError({ ...classified, cause: error });
      }
    }
  }
  return '';
};

const callOpenAI = async (prompt) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw buildServiceError({
      status: 503,
      code: 'OPENAI_NOT_CONFIGURED',
      message: 'OPENAI_API_KEY no esta configurada en el servidor.'
    });
  }

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: DEFAULT_OPENAI_MODEL,
        instructions: SYSTEM_PROMPT,
        input: prompt,
        temperature: 0.3,
        max_output_tokens: 2048,
        text: {
          format: {
            type: 'json_schema',
            name: 'indicadores_plan_accion',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['titulo_general', 'indicadores'],
              properties: {
                titulo_general: { type: 'string' },
                indicadores: {
                  type: 'array',
                  minItems: 6,
                  maxItems: 6,
                  items: { type: 'string' }
                }
              }
            }
          }
        }
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(payload?.error?.message || `OpenAI respondio con estado ${response.status}.`);
      err.status = response.status;
      err.code = payload?.error?.code || payload?.error?.type || 'OPENAI_HTTP_ERROR';
      throw err;
    }
    return extractOpenAIText(payload);
  } catch (error) {
    if (error?.code?.startsWith('OPENAI')) throw error;
    const classified = classifyOpenAIError(error);
    throw buildServiceError({ ...classified, cause: error });
  }
};

const callOllama = async (prompt) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_OLLAMA_MODEL,
        prompt: `${SYSTEM_PROMPT}\n\n${prompt}`,
        stream: false,
        format: 'json',
        options: {
          temperature: 0.3,
          num_predict: 1200
        }
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(payload?.error || `Ollama respondio con estado ${response.status}.`);
      err.status = response.status;
      throw err;
    }
    return payload?.response || '';
  } catch (error) {
    const classified = classifyOllamaError(error);
    throw buildServiceError({ ...classified, cause: error });
  }
};

const generateRawSuggestion = async (prompt) => {
  const providers = AI_PROVIDER === 'openai'
    ? ['openai']
    : AI_PROVIDER === 'gemini'
      ? ['gemini']
      : AI_PROVIDER === 'ollama'
        ? ['ollama']
        : ['openai', 'gemini', 'ollama'];
  let lastError = null;

  for (const provider of providers) {
    try {
      if (provider === 'openai') return await callOpenAI(prompt);
      if (provider === 'gemini') return await callGemini(prompt);
      return await callOllama(prompt);
    } catch (error) {
      lastError = error;
      const canFallback = AI_PROVIDER === 'auto'
        && [
          'OPENAI_NOT_CONFIGURED',
          'GEMINI_NOT_CONFIGURED',
          'OPENAI_QUOTA_ERROR',
          'GEMINI_QUOTA_ERROR',
          'OLLAMA_NOT_AVAILABLE',
          'OLLAMA_MODEL_ERROR'
        ].includes(error?.code);
      if (!canFallback) throw error;
    }
  }
  throw lastError;
};

const suggestIndicators = async (actividad) => {
  const cleanActividad = String(actividad || '').trim();
  if (!cleanActividad) {
    throw buildServiceError({
      status: 400,
      code: 'AI_EMPTY_ACTIVITY',
      message: 'La actividad es obligatoria para sugerir indicadores.'
    });
  }

  const raw = await generateRawSuggestion(buildUserPrompt(cleanActividad));
  const parsed = tryParseJson(raw);
  if (!parsed || !Array.isArray(parsed.indicadores) || parsed.indicadores.length === 0) {
    throw buildServiceError({
      status: 502,
      code: 'AI_BAD_RESPONSE',
      message: 'La respuesta de IA no tiene el formato esperado.'
    });
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
