const test = require('node:test');
const assert = require('node:assert/strict');
const { generateMeetingMinutePdf, _internals } = require('./meetingMinutePdfService');

test('genera el acta completa en formato PDF', async () => {
  const buffer = await generateMeetingMinutePdf({
    header: { codigo: 'COM-ID-FR-002', version: '1', fecha: '17/09/2026' },
    responsables: 'RESPONSABLE PRINCIPAL',
    dependencia: 'Dirección de Planeación y Aseguramiento de la Calidad',
    lugar: 'Sala de Rectoría',
    fecha: '17/09/2026',
    horario: '08:00 - 10:00',
    participantes: [
      { nombre: 'PARTICIPANTE INTERNO', cargo: 'Docente Tiempo Completo', firma: 'Firmado electrónicamente' },
      { nombre: 'PARTICIPANTE EXTERNO', cargo: 'Entidad Externa · Contratista', firma: 'Pendiente' }
    ],
    objetivo: ['<p>Objetivo institucional de la reunión.</p>'],
    desarrollo: ['<p>Desarrollo completo.</p><table><tr><th>Actividad</th><th>Fecha</th></tr><tr><td>Prueba</td><td>17/09/2026</td></tr></table>'],
    conclusiones: ['<p>Conclusiones y compromisos.</p>']
  });
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  assert.ok(buffer.length > 5000);
});

test('no recorta actas extensas y genera todas sus páginas', async () => {
  const paragraphs = Array.from({ length: 90 }, (_, index) => `<p>Párrafo institucional ${index + 1}: contenido completo del desarrollo y sus compromisos.</p>`).join('');
  const buffer = await generateMeetingMinutePdf({
    header: { codigo: 'COM-ID-FR-002', version: '1', fecha: '17/09/2026' },
    responsables: 'RESPONSABLE PRINCIPAL',
    dependencia: 'Dirección de Planeación y Aseguramiento de la Calidad',
    fecha: '17/09/2026',
    horario: '08:00 - 10:00',
    participantes: [{ nombre: 'PARTICIPANTE', cargo: 'Responsable', firma: 'Pendiente' }],
    objetivo: ['<p>Objetivo completo.</p>'],
    desarrollo: [paragraphs],
    conclusiones: [paragraphs]
  });
  const pageObjects = (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
  assert.ok(pageObjects >= 3, `Se esperaban al menos 3 páginas y se generaron ${pageObjects}.`);
  assert.ok(buffer.length > 15000);
});

test('conserva el contenido textual y las tablas enriquecidas', () => {
  assert.equal(_internals.plainHtml('<p>Texto <strong>completo</strong></p>'), 'Texto completo');
  const table = _internals.richTable('<table><tr><th>Compromiso</th><th>Fecha</th></tr><tr><td>Entregar informe</td><td>30/09/2026</td></tr></table>');
  assert.equal(table.table.body.length, 2);
  assert.equal(table.table.body[1][0].text, 'Entregar informe');
});
