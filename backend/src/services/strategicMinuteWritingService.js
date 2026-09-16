const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = process.env.OPENAI_TEXT_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const REQUEST_TIMEOUT_MS = Number(process.env.OPENAI_TEXT_TIMEOUT_MS || 30000);

const extractResponseText = (payload) => {
  if (payload?.output_text) return String(payload.output_text).trim();
  return (Array.isArray(payload?.output) ? payload.output : [])
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .map((part) => part?.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
};

const improveStrategicMinuteText = async ({ field, text, context = {} }) => {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw Object.assign(new Error('La integración de OpenAI no está configurada en el servidor.'), { statusCode: 503 });

  const cleanText = String(text || '').trim();
  if (!cleanText) throw Object.assign(new Error('Escriba primero el texto que desea mejorar.'), { statusCode: 422 });
  if (cleanText.length > 8000) throw Object.assign(new Error('El texto no puede superar 8.000 caracteres.'), { statusCode: 422 });

  const fieldLabels = {
    objective: 'Objetivo de la reunión',
    development: 'Desarrollo de la reunión',
    conclusions: 'Conclusiones y compromisos'
  };
  if (!fieldLabels[field]) throw Object.assign(new Error('El campo solicitado no admite mejora de redacción.'), { statusCode: 422 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        store: false,
        instructions: [
          'Actúa como redactor institucional de la Universidad CESMAG.',
          'Mejora únicamente claridad, coherencia, ortografía y tono formal del texto suministrado.',
          'Conserva exactamente el sentido, los hechos, nombres, responsables, fechas, cifras y compromisos.',
          'No inventes información, no agregues saludos, títulos, explicaciones ni recomendaciones.',
          'Devuelve un texto listo para pegar en un acta institucional.'
        ].join(' '),
        input: JSON.stringify({
          campo: fieldLabels[field],
          contexto: {
            plan_de_accion: String(context.action_plan || '').slice(0, 400),
            dependencia_responsable: String(context.responsible_area || '').slice(0, 300),
            objetivo: String(context.objective || '').slice(0, 2000),
            desarrollo: String(context.development || '').slice(0, 4000),
            conclusiones: String(context.conclusions || '').slice(0, 3000)
          },
          texto_a_mejorar: cleanText
        }),
        temperature: 0.2,
        max_output_tokens: 1600,
        text: {
          format: {
            type: 'json_schema',
            name: 'redaccion_acta_institucional',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['improved_text'],
              properties: { improved_text: { type: 'string' } }
            }
          }
        }
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const statusCode = response.status === 429 ? 429 : 502;
      const message = response.status === 429
        ? 'OpenAI alcanzó temporalmente su límite de uso. Intente nuevamente en unos minutos.'
        : 'No fue posible mejorar la redacción con OpenAI.';
      throw Object.assign(new Error(message), { statusCode, cause: payload?.error?.message });
    }
    const raw = extractResponseText(payload);
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) { parsed = null; }
    const improvedText = String(parsed?.improved_text || '').trim();
    if (!improvedText) throw Object.assign(new Error('OpenAI no devolvió una redacción válida.'), { statusCode: 502 });
    return { improved_text: improvedText, model: DEFAULT_MODEL };
  } catch (error) {
    if (error?.name === 'AbortError') throw Object.assign(new Error('OpenAI tardó demasiado en responder. Intente nuevamente.'), { statusCode: 504 });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const generateStrategicMinuteSummary = async ({ context = {}, activities = [] }) => {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw Object.assign(new Error('La integración de OpenAI no está configurada en el servidor.'), { statusCode: 503 });
  if (!Array.isArray(activities) || !activities.length) {
    throw Object.assign(new Error('El Plan de Acción todavía no tiene actividades para analizar.'), { statusCode: 422 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        store: false,
        instructions: [
          'Actúa como secretario técnico institucional de la Universidad CESMAG.',
          'A partir exclusivamente de las actividades suministradas, redacta dos textos para un acta de concertación de un Plan de Acción.',
          'El desarrollo debe ser un resumen analítico, claro y profesional de lo revisado: propósito común, líneas de trabajo, indicadores, metas, responsables y temporalidad cuando esos datos existan.',
          'No afirmes que una actividad ya se ejecutó, aprobó o cumplió si los datos no lo indican.',
          'Las conclusiones y compromisos deben derivarse de las actividades y expresar acciones verificables. Incluye responsables, fechas o metas solo cuando estén informados.',
          'No inventes nombres, acuerdos, cifras, fechas, resultados ni decisiones. No uses títulos, saludos ni explicaciones externas.'
        ].join(' '),
        input: JSON.stringify({
          contexto_del_acta: {
            plan_de_accion: String(context.action_plan || '').slice(0, 400),
            dependencia_responsable: String(context.responsible_area || '').slice(0, 300),
            vigencia: String(context.term || '').slice(0, 20),
            objetivo_reunion: String(context.objective || '').slice(0, 2000)
          },
          actividades: activities.slice(0, 100)
        }),
        temperature: 0.2,
        max_output_tokens: 2400,
        text: {
          format: {
            type: 'json_schema',
            name: 'resumen_analitico_acta_plan_accion',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['development', 'conclusions'],
              properties: {
                development: { type: 'string' },
                conclusions: { type: 'string' }
              }
            }
          }
        }
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const statusCode = response.status === 429 ? 429 : 502;
      const message = response.status === 429
        ? 'OpenAI alcanzó temporalmente su límite de uso. Intente nuevamente en unos minutos.'
        : 'No fue posible generar el resumen analítico del acta.';
      throw Object.assign(new Error(message), { statusCode, cause: payload?.error?.message });
    }
    const raw = extractResponseText(payload);
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) { parsed = null; }
    const development = String(parsed?.development || '').trim();
    const conclusions = String(parsed?.conclusions || '').trim();
    if (!development || !conclusions) {
      throw Object.assign(new Error('OpenAI no devolvió un resumen completo del acta.'), { statusCode: 502 });
    }
    return { development, conclusions, model: DEFAULT_MODEL, activities_analyzed: Math.min(activities.length, 100) };
  } catch (error) {
    if (error?.name === 'AbortError') throw Object.assign(new Error('OpenAI tardó demasiado en responder. Intente nuevamente.'), { statusCode: 504 });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = { improveStrategicMinuteText, generateStrategicMinuteSummary };
