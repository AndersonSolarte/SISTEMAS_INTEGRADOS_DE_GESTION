const test = require('node:test');
const assert = require('node:assert/strict');
const { parseEvaluatedData } = require('./saberProDocumentParser');

const hints = {
  identification: '1004235273',
  registrationNumber: 'EK202430144249',
  examDate: null
};

test('lee la cedula del certificado de asistencia distribuido en columnas', () => {
  const text = `
CERTIFICADO DE ASISTENCIA
NÚMERO DE DOCUMENTO NUMERO DE REGISTT
1004235273 |EK202430144249
FECHA DE PRESENTACIÓN DEL EXAMEN FECHA DE IMPRESIÓN DEL CERTIFICADO
30/09/2024 |30/09/2024
`;
  const parsed = parseEvaluatedData(text, hints);
  assert.equal(parsed.identification, '1004235273');
  assert.equal(parsed.registrationNumber, 'EK202430144249');
  assert.equal(parsed.examDate, '2024-09-30');
  assert.equal(parsed.expectedIdentificationRead, true);
});

test('tolera confusiones OCR comunes cerca de numero de documento', () => {
  const text = `
CERTIFICADO DE ASISTENCIA
NUMERO DE DOCUMENTO       NUMERO DE REGISTRO
I OO423S273               EK202430144249
FECHA DE PRESENTACION DEL EXAMEN
30/09/2024
`;
  const parsed = parseEvaluatedData(text, hints);
  assert.equal(parsed.identification, '1004235273');
  assert.equal(parsed.expectedIdentificationRead, true);
});
