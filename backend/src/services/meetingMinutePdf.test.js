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

test('conserva el contenido textual y las tablas enriquecidas', () => {
  assert.equal(_internals.plainHtml('<p>Texto <strong>completo</strong></p>'), 'Texto completo');
  const table = _internals.richTable('<table><tr><th>Compromiso</th><th>Fecha</th></tr><tr><td>Entregar informe</td><td>30/09/2026</td></tr></table>');
  assert.equal(table.table.body.length, 2);
  assert.equal(table.table.body[1][0].text, 'Entregar informe');
});
