const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractDocumentInformation,
  parseExtractionResponse
} = require('./documentExtractionService');

test('normaliza una respuesta JSON de extraccion y limita la confianza', () => {
  const result = parseExtractionResponse(`\`\`\`json
  {
    "tipo_documento": "Resolucion",
    "resumen": "Acto administrativo",
    "campos": [
      { "campo": "Numero", "valor": "123", "confianza": 140, "pagina": 1 },
      { "campo": "", "valor": "se descarta", "confianza": 50 }
    ],
    "texto_extraido": "RESOLUCION 123",
    "advertencias": ["Revisar la firma"]
  }
  \`\`\``);

  assert.equal(result.tipoDocumento, 'Resolucion');
  assert.equal(result.campos.length, 1);
  assert.equal(result.campos[0].confianza, 100);
  assert.equal(result.campos[0].pagina, '1');
  assert.deepEqual(result.advertencias, ['Revisar la firma']);
});

test('envia el PDF en memoria al cliente multimodal sin persistirlo', async () => {
  let receivedParts = null;
  const client = {
    getGenerativeModel: () => ({
      generateContent: async (parts) => {
        receivedParts = parts;
        return {
          response: {
            text: () => JSON.stringify({
              tipo_documento: 'Certificado',
              resumen: 'Documento de prueba',
              campos: [{ campo: 'Nombre', valor: 'Ana', confianza: 95, pagina: '1' }],
              texto_extraido: 'Ana',
              advertencias: []
            })
          }
        };
      }
    })
  };

  const result = await extractDocumentInformation({
    buffer: Buffer.from('pdf de prueba'),
    mimeType: 'application/pdf',
    originalName: 'certificado.pdf',
    client
  });

  assert.equal(result.campos[0].valor, 'Ana');
  assert.equal(receivedParts[1].inlineData.mimeType, 'application/pdf');
  assert.equal(receivedParts[1].inlineData.data, Buffer.from('pdf de prueba').toString('base64'));
});

