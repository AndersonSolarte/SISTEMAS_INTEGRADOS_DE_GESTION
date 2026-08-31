const { GoogleGenerativeAI } = require('@google/generative-ai');

const DOCUMENT_MODEL = process.env.GEMINI_DOCUMENT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const stripCodeFence = (value = '') => String(value || '')
  .trim()
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/```\s*$/i, '')
  .trim();

const parseExtractionResponse = (rawText = '') => {
  const cleaned = stripCodeFence(rawText);
  let payload;
  try {
    payload = JSON.parse(cleaned);
  } catch (_) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('La respuesta de extraccion no contiene JSON valido.');
    payload = JSON.parse(match[0]);
  }

  const fields = Array.isArray(payload.campos) ? payload.campos : [];
  return {
    tipoDocumento: String(payload.tipo_documento || 'Documento sin clasificar').trim(),
    resumen: String(payload.resumen || '').trim(),
    campos: fields
      .map((item) => ({
        campo: String(item?.campo || '').trim(),
        valor: String(item?.valor ?? '').trim(),
        confianza: Math.max(0, Math.min(100, Number(item?.confianza) || 0)),
        pagina: item?.pagina === null || item?.pagina === undefined ? '' : String(item.pagina).trim()
      }))
      .filter((item) => item.campo && item.valor),
    textoExtraido: String(payload.texto_extraido || '').trim(),
    advertencias: (Array.isArray(payload.advertencias) ? payload.advertencias : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  };
};

const buildPrompt = ({ originalName, instructions }) => `Analiza el documento adjunto y extrae su informacion de forma verificable.

Archivo: ${originalName}
Instruccion adicional del usuario: ${instructions || 'Extraer los datos principales del documento.'}

Reglas:
1. No inventes datos ni completes informacion ausente.
2. Conserva nombres, identificadores, fechas y valores tal como aparecen.
3. Si un dato es dudoso, reduce su confianza y agrega una advertencia.
4. En "pagina" indica el numero de pagina cuando pueda identificarse; para imagenes usa "1".
5. "texto_extraido" debe contener una transcripcion util, no una explicacion.
6. Responde exclusivamente con JSON valido y este esquema:
{
  "tipo_documento": "tipo detectado",
  "resumen": "resumen breve",
  "campos": [
    { "campo": "Nombre del campo", "valor": "Valor encontrado", "confianza": 0, "pagina": "1" }
  ],
  "texto_extraido": "texto legible recuperado",
  "advertencias": ["aspectos que requieren revision humana"]
}`;

const extractDocumentInformation = async ({ buffer, mimeType, originalName, instructions = '', client = null }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const error = new Error('El archivo recibido esta vacio.');
    error.status = 400;
    error.code = 'EMPTY_DOCUMENT';
    throw error;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!client && !apiKey) {
    const error = new Error('La extraccion documental requiere configurar GEMINI_API_KEY en el servidor.');
    error.status = 503;
    error.code = 'DOCUMENT_AI_NOT_CONFIGURED';
    throw error;
  }

  try {
    const geminiClient = client || new GoogleGenerativeAI(apiKey);
    const model = geminiClient.getGenerativeModel({
      model: DOCUMENT_MODEL,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json'
      }
    });
    const result = await model.generateContent([
      buildPrompt({ originalName, instructions }),
      {
        inlineData: {
          mimeType,
          data: buffer.toString('base64')
        }
      }
    ]);
    const rawText = result?.response?.text?.() || '';
    return parseExtractionResponse(rawText);
  } catch (error) {
    if (error?.status && error?.code) throw error;
    const wrapped = new Error('No fue posible extraer la informacion del documento.');
    wrapped.status = /429|quota|rate limit/i.test(String(error?.message || '')) ? 429 : 502;
    wrapped.code = wrapped.status === 429 ? 'DOCUMENT_AI_QUOTA' : 'DOCUMENT_EXTRACTION_FAILED';
    wrapped.cause = error;
    throw wrapped;
  }
};

module.exports = {
  extractDocumentInformation,
  parseExtractionResponse
};
