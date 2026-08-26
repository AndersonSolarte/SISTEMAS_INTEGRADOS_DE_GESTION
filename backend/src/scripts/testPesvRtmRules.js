const assert = require('assert');
const { evaluateRtmStatus } = require('../services/pesvRtmRules');

const cases = [
  {
    name: 'moto nueva',
    input: { registrationDate: '2025-06-15', vehicleClass: 'MOTOCICLETA', service: 'Particular', asOfDate: '2026-08-26' },
    expected: { status: 'NO_EXIGIBLE', dueDate: '2027-06-15' }
  },
  {
    name: 'carro particular nuevo',
    input: { registrationDate: '2023-08-31', vehicleClass: 'AUTOMOVIL', service: 'Particular', asOfDate: '2026-08-26' },
    expected: { status: 'NO_EXIGIBLE', dueDate: '2028-08-31' }
  },
  {
    name: 'vehículo usado con certificado RUNT vigente',
    input: { registrationDate: '2014-02-28', vehicleClass: 'AUTOMOVIL', service: 'Particular', latestCertificateExpiry: '2027-03-10', asOfDate: '2026-08-26' },
    expected: { status: 'VIGENTE', dueDate: '2027-03-10' }
  },
  {
    name: 'vehículo usado sin certificado en RUNT',
    input: { registrationDate: '2014-02-28', vehicleClass: 'AUTOMOVIL', service: 'Particular', asOfDate: '2026-08-26' },
    expected: { status: 'SIN_REGISTRO_RUNT', dueDate: '2019-02-28' }
  },
  {
    name: 'matrícula en año bisiesto',
    input: { registrationDate: '2024-02-29', vehicleClass: 'MOTOCICLETA', service: 'Particular', asOfDate: '2025-01-01' },
    expected: { status: 'NO_EXIGIBLE', dueDate: '2026-02-28' }
  }
];

cases.forEach(({ name, input, expected }) => {
  const result = evaluateRtmStatus(input);
  assert.deepStrictEqual({ status: result.status, dueDate: result.dueDate }, expected, name);
  console.log(`OK: ${name} -> ${result.status} (${result.dueDate})`);
});
