const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidRegistrationNumber, parseEvaluatedData, toIsoDate } = require('./saberProDocumentParser');

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

test('exige un codigo EK de exactamente 14 caracteres', () => {
  assert.equal(isValidRegistrationNumber('EK202531202662'), true);
  assert.equal(isValidRegistrationNumber('EK20253120266'), false);
  assert.equal(isValidRegistrationNumber('EKA202531202662'), false);

  const parsed = parseEvaluatedData(`
NUMERO DE DOCUMENTO 1004235273
NUMERO DE REGISTRO EK20253120266
FECHA DE PRESENTACION DEL EXAMEN 30/09/2025
`, {
    identification: '1004235273',
    registrationNumber: 'EK20253120266',
    examDate: '2025-09-30'
  });
  assert.equal(parsed.readComplete, false);
  assert.match(parsed.missingFields.join(' '), /exactamente 14 caracteres/i);
});

test('prioriza la fecha del examen y recupera el separador perdido por OCR', () => {
  assert.equal(toIsoDate('3110/2021'), '2021-10-31');

  const parsed = parseEvaluatedData(`
Nombre Completo: Identificación: Número de registro: Aplicación del examen: Publicación de resultados:
Yurany Nayiby Villa Torres C.C. 1085318009 EK202122401362 3110/2021 19/02/2022
`, {
    identification: '1085318009',
    registrationNumber: 'EK202122401362'
  });

  assert.equal(parsed.registrationNumber, 'EK202122401362');
  assert.equal(parsed.examDate, '2021-10-31');
  assert.equal(parsed.dateYearMismatch, false);
});
