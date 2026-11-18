const test = require('node:test');
const assert = require('node:assert/strict');
const { getObservationHistory, formatObservationDate } = require('./observationHistory');
const { buildDefinition, buildLiquidationDefinition, buildLiquidationPdfBuffer } = require('./pdfService');
const { buildWorkbook } = require('./formatService');
const { _internals } = require('../../controllers/desplazamientoViaticosController');

const fixture = () => ({
  consecutivo: 'PRUEBA-OBSERVACIONES-001',
  solicitante_snapshot: {}, datos_laborales: {}, datos_salida: {}, datos_viaticos: {},
  plan_aprobacion: [
    { key: 'jefe', label: 'Jefe inmediato' }, { key: 'financiera_previa', label: 'Vicerrectoría Financiera' },
    { key: 'tecnico_contable', label: 'Técnico Contable' }, { key: 'tesoreria', label: 'Tesorería' }
  ],
  liquidacion: { detalles: [{ detalle: 'Alimentación', valorDiario: 20000, dias: 5, valorTotal: 100000 }],
    totalAnticipo: 100000, observaciones: 'Ajuste registrado por Tesorería' },
  trazabilidad: [
    { event: 'completado_tesoreria', at: '2026-11-18T15:00:00Z', actor: { nombre: 'TESORERA PRUEBA', email: 'tesoreria@example.invalid' },
      detail: { observacion: 'Pago revisado', observacionesLiquidacion: 'Ajuste registrado por Tesorería', observacionesLiquidacionAnterior: 'Se agrega almuerzos' } },
    { event: 'completado_tecnico_contable', at: '2026-11-18T14:00:00Z', actor: { nombre: 'TECNICO PRUEBA', cargo: 'Técnico Contable', email: 'tecnico@example.invalid' }, detail: { observaciones: 'Se agrega almuerzos' } },
    { event: 'aprobado_jefe', at: '2026-11-18T13:00:00Z', actor: { nombre: 'JEFE PRUEBA', email: 'jefe@example.invalid' }, detail: { observacion: 'Conforme con la misión' } },
    { event: 'aprobado_financiera_previa', at: '2026-11-18T13:30:00Z', actor: { nombre: 'VICERRECTOR PRUEBA', email: 'vice@example.invalid' }, detail: { observacion: 'Conforme con la misión' } },
    { event: 'correo_aprobacion_enviado', at: '2026-11-18T12:00:00Z', detail: { observacion: 'AVISO TÉCNICO: no es una observación del aprobador' } }
  ]
});

test('ordena cronológicamente y conserva autor, correo y etapa de cada observación', () => {
  const solicitud = fixture();
  const original = JSON.stringify(solicitud);
  const history = getObservationHistory(solicitud);
  assert.deepEqual(history.map(obs => obs.actorName), ['JEFE PRUEBA', 'VICERRECTOR PRUEBA', 'TECNICO PRUEBA', 'TESORERA PRUEBA', 'TESORERA PRUEBA']);
  assert.equal(history[2].text, 'Se agrega almuerzos');
  assert.equal(history[2].actorEmail, 'tecnico@example.invalid');
  assert.equal(history[2].stepLabel, 'Técnico Contable');
  assert.equal(history.filter(obs => obs.text === 'Conforme con la misión').length, 2, 'Igual texto de dos responsables no se elimina.');
  assert.equal(JSON.stringify(solicitud), original, 'Consultar no modifica la trazabilidad.');
  assert.match(formatObservationDate(history[2].date), /9:00:00/);
});

test('no repite una misma actuación y conserva observaciones posteriores del mismo responsable', () => {
  const solicitud = fixture();
  solicitud.trazabilidad.push({ ...solicitud.trazabilidad[1] });
  solicitud.trazabilidad.push({ ...solicitud.trazabilidad[1], at: '2026-11-18T14:20:00Z', detail: { observaciones: 'Se ajusta transporte' } });
  const history = getObservationHistory(solicitud);
  assert.equal(history.filter(obs => obs.text === 'Se agrega almuerzos').length, 1);
  assert.ok(history.some(obs => obs.text === 'Se ajusta transporte'));
});

test('no inventa autor ni fecha de notas antiguas sin trazabilidad y mantiene la privacidad financiera', () => {
  const solicitud = fixture();
  solicitud.liquidacion.observaciones = 'Nota antigua sin autor';
  const legacy = getObservationHistory(solicitud).at(-1);
  assert.equal(legacy.actorName, 'Responsable no registrado'); assert.equal(legacy.date, null);
  const history = getObservationHistory(solicitud, { includeFinancial: false });
  assert.deepEqual(history.map(obs => obs.stepKey), ['jefe', 'financiera_previa']);
});

test('una nota antigua se conserva al ajustar Tesorería aunque no exista su traza original', () => {
  const solicitud = fixture();
  solicitud.trazabilidad = solicitud.trazabilidad.filter(trace => trace.event !== 'completado_tecnico_contable');
  const original = getObservationHistory(solicitud).find(obs => obs.text === 'Se agrega almuerzos');
  assert.ok(original);
  assert.equal(original.actorName, 'Responsable no registrado');
});

test('el formato HTML muestra las observaciones atribuidas y numeradas sin duplicar al Técnico', () => {
  const html = _internals.liquidationRequestDocumentHtml(fixture(), { currentStepKey: 'tesoreria', isTreasury: true });
  const section = html.split('Observaciones y Anotaciones Registradas en el Flujo')[1].split('</section>')[0];
  assert.ok(section.indexOf('JEFE PRUEBA') < section.indexOf('VICERRECTOR PRUEBA'));
  assert.ok(section.indexOf('VICERRECTOR PRUEBA') < section.indexOf('TECNICO PRUEBA'));
  assert.ok(section.indexOf('TECNICO PRUEBA') < section.indexOf('TESORERA PRUEBA'));
  assert.equal((section.match(/Se agrega almuerzos/g) || []).length, 1);
  assert.match(section, /tecnico@example.invalid/);
  assert.match(section, /3\. Técnico Contable/);
  const technician = section.slice(section.indexOf('3. Técnico Contable'));
  assert.ok(technician.indexOf('Usuario responsable:') < technician.indexOf('Cargo:'));
  assert.ok(technician.indexOf('Cargo:') < technician.indexOf('Correo:'));
  assert.ok(technician.indexOf('Correo:') < technician.indexOf('Observación:'));
  assert.ok(technician.indexOf('Observación:') < technician.indexOf('Se agrega almuerzos'));
});

test('los PDF incluyen el historial completo en orden y conservan la nota original aunque Tesorería la cambie', async () => {
  for (const definition of [buildDefinition(fixture()), buildLiquidationDefinition(fixture())]) {
    const start = definition.content.findIndex(item => item.text === 'OBSERVACIONES DEL FLUJO EN ORDEN CRONOLÓGICO');
    assert.ok(start >= 0, 'El historial debe ser parte del documento PDF.');
    const blocks = definition.content.slice(start + 1, start + 6);
    assert.equal(blocks.length, 5);
    const content = JSON.stringify(blocks);
    for (const text of ['JEFE PRUEBA', 'VICERRECTOR PRUEBA', 'TECNICO PRUEBA', 'TESORERA PRUEBA', 'Se agrega almuerzos', 'Ajuste registrado por Tesorería', 'tecnico@example.invalid']) assert.ok(content.includes(text), text);
    const technician = blocks[2].table.body;
    const metadata = JSON.stringify(technician[0]);
    assert.match(metadata, /Usuario responsable:/); assert.match(metadata, /Cargo:/); assert.match(metadata, /Técnico Contable/); assert.match(metadata, /Correo:/);
    assert.ok(!metadata.includes('Se agrega almuerzos'));
    assert.match(JSON.stringify(technician[1]), /Se agrega almuerzos/);
  }
  const pdf = await buildLiquidationPdfBuffer(fixture());
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
});

test('Excel conserva cada observación dentro del FR-004 y las incluye en su área de impresión', async () => {
  const workbook = await buildWorkbook(fixture());
  const sheet = workbook.getWorksheet('FR-004');
  const values = [];
  sheet.eachRow(row => values.push(String(row.getCell(1).value || '')));
  const content = values.join('\n');
  assert.ok(content.includes('OBSERVACIONES DEL FLUJO EN ORDEN CRONOLÓGICO'));
  assert.ok(content.includes('Se agrega almuerzos')); assert.ok(content.includes('Ajuste registrado por Tesorería'));
  assert.ok(content.indexOf('JEFE PRUEBA') < content.indexOf('TECNICO PRUEBA'));
  assert.ok(content.indexOf('TECNICO PRUEBA') < content.indexOf('TESORERA PRUEBA'));
  assert.ok(content.includes('tecnico@example.invalid'));
  assert.match(sheet.pageSetup.printArea, new RegExp(`R${sheet.rowCount}$`));
  assert.ok((await workbook.xlsx.writeBuffer()).byteLength > 0);
});
