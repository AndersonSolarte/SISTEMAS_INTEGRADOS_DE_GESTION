const { GoogleGenerativeAI } = require('@google/generative-ai');

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const AI_PROVIDER = String(process.env.AI_PROVIDER || 'auto').trim().toLowerCase();
const AI_PROVIDER_TIMEOUT_MS = Number(process.env.AI_PROVIDER_TIMEOUT_MS || 7000);
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OLLAMA_URL = String(process.env.OLLAMA_URL || 'http://host.docker.internal:11434').replace(/\/+$/, '');
const WEB_SEARCH_PROVIDER = String(process.env.WEB_SEARCH_PROVIDER || 'tavily').trim().toLowerCase();
const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';
const SERPER_SEARCH_URL = 'https://google.serper.dev/search';

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

const buildOllamaPrompt = (actividad) => `Devuelve solo JSON valido, sin markdown.
Actividad: "${actividad}".
Genera exactamente este esquema:
{"titulo_general":"3 a 6 palabras","indicadores":["Definir entregable verificable.","Elaborar entregable verificable.","Socializar entregable verificable.","Implementar entregable verificable.","Verificar entregable verificable.","Actualizar entregable verificable."]}
Reglas: cada indicador inicia con verbo en infinitivo, maximo 25 palabras, espanol de Colombia, sin porcentajes ni formulas.`;

const extractActivityFromPrompt = (prompt = '') => {
  const match = String(prompt).match(/^Actividad:\s*"([\s\S]*)"\.\nResponde con el JSON solicitado\.$/);
  return match ? match[1] : String(prompt || '').trim();
};

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

const cleanSourceTitle = (title = '') =>
  String(title || '')
    .replace(/^\s*\[(PDF|DOC|DOCX|PPT|PPTX|XLS|XLSX|HTML|TXT)\]\s*[-:]?\s*/i, '')
    .replace(/\s+\|\s+.+$/, '')
    .replace(/\s*-\s*(Universidad\s+CESMAG|UNICESMAG)\s*$/i, '')
    .trim();

const normalizeForMatching = (text = '') =>
  String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const buildLocalFallbackPayload = (actividad, extraContext = '') => {
  const cleanActividad = String(actividad || '').trim().replace(/\s+/g, ' ');
  const cleanExtra = String(extraContext || '').trim().replace(/\s+/g, ' ');
  const normalizedActivity = normalizeForMatching(cleanActividad);
  const normalizedAll = `${normalizedActivity} ${normalizeForMatching(cleanExtra)}`.trim();
  const hasAny = (terms) => terms.some((term) => normalizedAll.includes(term));
  const trimSentence = (text) => String(text || '').replace(/[.;:\s]+$/g, '').trim();
  const activitySubject = trimSentence(cleanActividad) || 'la actividad institucional';
  const shortSubject = activitySubject.length > 95 ? `${activitySubject.slice(0, 92).trim()}...` : activitySubject;

  const profiles = [
    {
      match: ['manual', 'guia', 'protocolo', 'procedimiento', 'lineamiento', 'instructivo'],
      title: 'Formalizacion documental',
      indicators: [
        `Diagnosticar requisitos y referentes institucionales aplicables a ${shortSubject}.`,
        'Estructurar el documento tecnico con alcance, responsables, actividades, controles y evidencias.',
        'Validar el contenido con las dependencias responsables antes de su formalizacion institucional.',
        'Aprobar la version final mediante el flujo documental definido por la institucion.',
        'Socializar el documento aprobado con usuarios, lideres de proceso y partes interesadas.',
        'Registrar evidencias de aplicacion y actualizar el documento segun resultados de seguimiento.'
      ]
    },
    {
      match: ['capacitar', 'capacitacion', 'formacion', 'taller', 'sensibilizacion', 'socializar'],
      title: 'Fortalecimiento de capacidades',
      indicators: [
        `Identificar necesidades de formacion asociadas a ${shortSubject}.`,
        'Disenar la agenda pedagogica con objetivos, contenidos, metodologia y criterios de evaluacion.',
        'Convocar a los participantes definidos y confirmar asistencia de las dependencias involucradas.',
        'Ejecutar las jornadas de formacion con soportes, materiales y registro de asistencia.',
        'Evaluar la apropiacion de conocimientos mediante instrumento aplicado a los participantes.',
        'Consolidar informe de resultados con evidencias, conclusiones y acciones de mejora.'
      ]
    },
    {
      match: ['sistema', 'plataforma', 'software', 'aplicativo', 'automatizar', 'digital', 'herramienta'],
      title: 'Implementacion tecnologica',
      indicators: [
        `Levantar requerimientos funcionales y tecnicos para ${shortSubject}.`,
        'Disenar el flujo operativo de la solucion con roles, permisos, entradas y salidas.',
        'Configurar o desarrollar los componentes necesarios para soportar el proceso institucional.',
        'Realizar pruebas funcionales con usuarios responsables y registrar hallazgos de ajuste.',
        'Implementar la solucion en ambiente operativo con guia de uso y soporte inicial.',
        'Monitorear uso, incidencias y mejoras requeridas durante el periodo de estabilizacion.'
      ]
    },
    {
      match: ['convenio', 'alianza', 'articulacion', 'cooperacion', 'sector externo', 'empresa'],
      title: 'Gestion de alianzas',
      indicators: [
        `Identificar aliados estrategicos pertinentes para ${shortSubject}.`,
        'Definir compromisos, responsables, beneficios y alcance de la articulacion institucional.',
        'Formalizar el acuerdo mediante documento, acta, convenio o instrumento correspondiente.',
        'Ejecutar las actividades pactadas con seguimiento a cronograma y responsables asignados.',
        'Recopilar evidencias de participacion, productos generados y resultados alcanzados.',
        'Evaluar la continuidad de la alianza con recomendaciones para fortalecimiento institucional.'
      ]
    },
    {
      match: ['evaluar', 'evaluacion', 'autoevaluacion', 'medir', 'seguimiento', 'indicador', 'monitoreo'],
      title: 'Seguimiento y evaluacion',
      indicators: [
        `Definir criterios, fuentes e instrumentos para evaluar ${shortSubject}.`,
        'Recolectar informacion verificable desde las dependencias y sistemas institucionales definidos.',
        'Analizar resultados frente a metas, tendencias, brechas y oportunidades de mejora.',
        'Presentar informe ejecutivo con hallazgos, evidencias y recomendaciones priorizadas.',
        'Concertar acciones de mejora con responsables, plazos y mecanismos de seguimiento.',
        'Verificar el cumplimiento de acciones y documentar avances en los soportes institucionales.'
      ]
    },
    {
      match: ['publicar', 'difundir', 'comunicar', 'campana', 'divulgar', 'visibilizar'],
      title: 'Comunicacion institucional',
      indicators: [
        `Definir mensaje, publico objetivo y canales para comunicar ${shortSubject}.`,
        'Elaborar piezas, contenidos o materiales comunicativos alineados con identidad institucional.',
        'Validar contenidos con las areas responsables antes de su publicacion o divulgacion.',
        'Publicar la campana en los canales institucionales definidos y registrar evidencias.',
        'Medir alcance, participacion o interaccion generada por la estrategia de comunicacion.',
        'Consolidar resultados y recomendaciones para fortalecer proximas acciones comunicativas.'
      ]
    },
    {
      match: ['identidad', 'pertenencia', 'arraigo', 'cultura', 'valores', 'unicesmag'],
      title: 'Identidad institucional',
      indicators: [
        `Caracterizar percepciones y necesidades relacionadas con ${shortSubject}.`,
        'Disenar estrategia de apropiacion institucional con mensajes, actividades y poblacion objetivo.',
        'Implementar acciones participativas que fortalezcan identidad, pertenencia y cultura institucional.',
        'Vincular dependencias academicas y administrativas en el desarrollo de la estrategia.',
        'Recopilar evidencias de participacion, productos comunicativos y resultados de apropiacion.',
        'Evaluar impacto percibido y definir mejoras para la continuidad de la estrategia.'
      ]
    }
  ];

  const selected = profiles.find((profile) => hasAny(profile.match)) || {
    title: 'Gestion actividad institucional',
    indicators: [
      `Precisar objetivo, alcance y entregables esperados para ${shortSubject}.`,
      'Definir responsables, recursos, cronograma y evidencias requeridas para la ejecucion.',
      'Formalizar el plan de trabajo con las dependencias involucradas y criterios de seguimiento.',
      'Ejecutar las acciones programadas garantizando registro documental de los avances.',
      'Verificar cumplimiento de entregables frente a fechas, responsables y resultados previstos.',
      'Consolidar informe de cierre con evidencias, aprendizajes y acciones de mejora.'
    ]
  };

  return {
    titulo_general: selected.title,
    indicadores: selected.indicators
  };
};

const buildSearchQuery = (actividad) =>
  `${String(actividad || '').trim()} indicadores gestion KPI lineamientos ejemplos`;

const normalizeSearchResults = (items = []) =>
  items
    .map((item) => ({
      title: cleanSourceTitle(String(item.title || item.name || '').trim()),
      url: String(item.url || item.link || '').trim(),
      snippet: String(item.content || item.description || item.snippet || item.extra_snippets?.[0] || '').trim()
    }))
    .filter((item) => item.title && item.url)
    .slice(0, 5);

const buildWebSearchPayload = ({ actividad, answer, results }) => {
  const cleanAnswer = String(answer || '').trim();
  const sources = normalizeSearchResults(results);
  const webContext = [cleanAnswer, ...sources.map((s) => `${s.title}. ${s.snippet}`)].join(' ');
  const base = buildLocalFallbackPayload(actividad, webContext);

  const resumenItems = [];
  if (cleanAnswer) {
    resumenItems.push({ title: 'Síntesis de la consulta', summary: cleanAnswer });
  }
  for (const src of sources) {
    if (src.snippet) {
      resumenItems.push({ title: src.title || 'Fuente', summary: src.snippet });
    }
  }

  const sourceLines = sources
    .map((source, index) => `${index + 1}. ${source.title} - ${source.url}`)
    .join('\n');
  const resumenTextoPlano = resumenItems.length
    ? resumenItems.map((it, i) => `${i + 1}. ${it.title}: ${it.summary}`).join('\n')
    : 'La búsqueda web no devolvió hallazgos relevantes.';

  return {
    titulo_general: 'Consulta web aplicada',
    indicadores: base.indicadores,
    resumen: resumenItems,
    fuentes: sources,
    bullets: [
      'Consulta web aplicada',
      '',
      'Resumen encontrado:',
      resumenTextoPlano,
      '',
      'Indicadores sugeridos:',
      ...base.indicadores.map((indicator, index) => `${index + 1}. ${indicator}`),
      '',
      'Fuentes consultadas:',
      sourceLines || 'No se recibieron fuentes web suficientes.'
    ].join('\n')
  };
};

const assertWebSearchHasSources = (payload, provider) => {
  const sources = normalizeSearchResults(payload?.results || []);
  if (sources.length > 0 || String(payload?.answer || '').trim()) return;
  throw buildServiceError({
    status: 502,
    code: 'WEB_SEARCH_EMPTY_RESULTS',
    message: `${provider} no devolvio resultados web suficientes.`
  });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withProviderTimeout = (promise, provider) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(buildServiceError({
          status: 504,
          code: 'AI_PROVIDER_TIMEOUT',
          message: `${provider} tardo mas de lo permitido para generar indicadores.`
        }));
      }, AI_PROVIDER_TIMEOUT_MS);
    })
  ]);

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

const classifyWebSearchError = (error) => {
  const msg = String(error?.message || '');
  const status = Number(error?.status || 0);
  const code = String(error?.code || '');

  if (status === 401 || status === 403 || /unauthorized|forbidden|invalid api key|subscription token/i.test(msg)) {
    return { status: 502, code: 'WEB_SEARCH_AUTH_ERROR', message: 'La clave de busqueda web no es valida o no tiene permisos.' };
  }
  if (status === 429 || /rate limit|quota|too many requests|credits/i.test(msg)) {
    return { status: 429, code: 'WEB_SEARCH_QUOTA_ERROR', message: 'La busqueda web supero la cuota o limite disponible.' };
  }
  if (/CERT_|certificate|TLS|SSL|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed/i.test(`${code} ${msg}`)) {
    return { status: 502, code: 'WEB_SEARCH_NETWORK_ERROR', message: 'El servidor no pudo conectarse con la busqueda web.' };
  }
  return { status: 502, code: 'WEB_SEARCH_ERROR', message: 'No fue posible consultar informacion en internet.' };
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
        prompt,
        stream: false,
        format: 'json',
        options: {
          temperature: 0.3,
          num_ctx: 2048,
          num_predict: 420
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

const callTavilySearch = async (actividad) => {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw buildServiceError({
      status: 503,
      code: 'WEB_SEARCH_NOT_CONFIGURED',
      message: 'TAVILY_API_KEY no esta configurada en el servidor.'
    });
  }

  const response = await fetch(TAVILY_SEARCH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: buildSearchQuery(actividad),
      topic: 'general',
      search_depth: 'basic',
      include_answer: true,
      include_raw_content: false,
      max_results: 5
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload?.error || payload?.message || `Tavily respondio con estado ${response.status}.`);
    err.status = response.status;
    throw err;
  }
  assertWebSearchHasSources(payload, 'Tavily');
  return buildWebSearchPayload({
    actividad,
    answer: payload.answer,
    results: payload.results || []
  });
};

const callBraveSearch = async (actividad) => {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    throw buildServiceError({
      status: 503,
      code: 'WEB_SEARCH_NOT_CONFIGURED',
      message: 'BRAVE_SEARCH_API_KEY no esta configurada en el servidor.'
    });
  }

  const url = new URL(BRAVE_SEARCH_URL);
  url.searchParams.set('q', buildSearchQuery(actividad));
  url.searchParams.set('count', '5');
  url.searchParams.set('country', 'co');
  url.searchParams.set('search_lang', 'es');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload?.error?.detail || payload?.message || `Brave respondio con estado ${response.status}.`);
    err.status = response.status;
    throw err;
  }
  assertWebSearchHasSources({ answer: payload?.summarizer?.summary || '', results: payload?.web?.results || [] }, 'Brave');
  return buildWebSearchPayload({
    actividad,
    answer: payload?.summarizer?.summary || '',
    results: payload?.web?.results || []
  });
};

const callSerperSearch = async (actividad) => {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw buildServiceError({
      status: 503,
      code: 'WEB_SEARCH_NOT_CONFIGURED',
      message: 'SERPER_API_KEY no esta configurada en el servidor.'
    });
  }

  const response = await fetch(SERPER_SEARCH_URL, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: buildSearchQuery(actividad),
      gl: 'co',
      hl: 'es',
      num: 5
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload?.message || payload?.error || `Serper respondio con estado ${response.status}.`);
    err.status = response.status;
    throw err;
  }

  assertWebSearchHasSources({
    answer: payload?.answerBox?.answer || payload?.answerBox?.snippet || payload?.knowledgeGraph?.description || '',
    results: payload?.organic || []
  }, 'Serper');
  return buildWebSearchPayload({
    actividad,
    answer: payload?.answerBox?.answer || payload?.answerBox?.snippet || payload?.knowledgeGraph?.description || '',
    results: payload?.organic || []
  });
};

const callWebSearch = async (actividad) => {
  try {
    const providers = WEB_SEARCH_PROVIDER === 'auto'
      ? ['tavily', 'serper']
      : [WEB_SEARCH_PROVIDER];
    let lastError = null;
    for (const provider of providers) {
      try {
        const payload = provider === 'brave'
          ? await callBraveSearch(actividad)
          : provider === 'serper'
            ? await callSerperSearch(actividad)
            : await callTavilySearch(actividad);
        return JSON.stringify(payload);
      } catch (error) {
        lastError = error;
        if (WEB_SEARCH_PROVIDER !== 'auto') throw error;
      }
    }
    throw lastError;
  } catch (error) {
    if (error?.code?.startsWith('WEB_SEARCH')) throw error;
    const classified = classifyWebSearchError(error);
    throw buildServiceError({ ...classified, cause: error });
  }
};

const generateRawSuggestion = async (prompt) => {
  if (AI_PROVIDER === 'local') {
    return JSON.stringify(buildLocalFallbackPayload(extractActivityFromPrompt(prompt)));
  }
  if (AI_PROVIDER === 'web') {
    return await callWebSearch(extractActivityFromPrompt(prompt));
  }

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
      if (provider === 'openai') return await withProviderTimeout(callOpenAI(prompt), provider);
      if (provider === 'gemini') return await withProviderTimeout(callGemini(prompt), provider);
      return await withProviderTimeout(callOllama(buildOllamaPrompt(extractActivityFromPrompt(prompt))), provider);
    } catch (error) {
      lastError = error;
      const canFallback = AI_PROVIDER === 'auto'
        && [
          'AI_PROVIDER_TIMEOUT',
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

  let raw = '';
  try {
    raw = await generateRawSuggestion(buildUserPrompt(cleanActividad));
  } catch (error) {
    console.warn('[ai] Proveedores IA no disponibles, usando generador local:', error?.code || error?.message);
    raw = JSON.stringify(buildLocalFallbackPayload(cleanActividad));
  }
  let parsed = tryParseJson(raw);
  if (!parsed || !Array.isArray(parsed.indicadores) || parsed.indicadores.length === 0) {
    parsed = buildLocalFallbackPayload(cleanActividad);
  }

  let resumenOut = '';
  if (Array.isArray(parsed.resumen)) {
    resumenOut = parsed.resumen
      .map((item) => ({
        title: String(item?.title || '').trim(),
        summary: String(item?.summary || '').trim()
      }))
      .filter((item) => item.title || item.summary);
  } else if (typeof parsed.resumen === 'string') {
    resumenOut = parsed.resumen;
  }

  return {
    tipo: 'Resultado',
    tituloGeneral: parsed.titulo_general || '',
    indicadores: parsed.indicadores,
    resumen: resumenOut,
    fuentes: Array.isArray(parsed.fuentes)
      ? parsed.fuentes.map((s) => ({
          title: cleanSourceTitle(String(s?.title || '').trim()),
          url: String(s?.url || '').trim(),
          snippet: String(s?.snippet || '').trim()
        })).filter((s) => s.title || s.url)
      : [],
    bullets: parsed.bullets || formatIndicadoresAsBullets(parsed)
  };
};

module.exports = {
  suggestIndicators
};
