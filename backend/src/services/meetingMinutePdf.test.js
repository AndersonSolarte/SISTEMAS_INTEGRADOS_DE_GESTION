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
  assert.equal(
    _internals.plainHtml('<div>Definir,</div><div>coordinar y hacer seguimiento al plan de trabajo</div><div>interinstitucional para la gestión institucional.</div>'),
    'Definir, coordinar y hacer seguimiento al plan de trabajo interinstitucional para la gestión institucional.'
  );
  assert.equal(
    _internals.plainHtml('<p>Primer párrafo completo.</p><p>Segundo párrafo completo.</p>'),
    'Primer párrafo completo.\n\nSegundo párrafo completo.'
  );
  const table = _internals.richTable('<table><tr><th>Compromiso</th><th>Fecha</th></tr><tr><td>Entregar informe</td><td>30/09/2026</td></tr></table>');
  assert.equal(table.table.body.length, 2);
  assert.equal(table.table.body[1][0].text, 'Entregar informe');
});

test('dibuja código, versión y fecha en tres celdas independientes', () => {
  const metadata = _internals.buildHeaderMetadata({
    codigo: 'COM-ID-FR-002',
    version: '2',
    fecha: '18/09/2026'
  });
  assert.equal(metadata.table.body.length, 3);
  assert.equal(metadata.table.body[0][0].text, 'CÓDIGO: COM-ID-FR-002');
  assert.equal(metadata.table.body[1][0].text, 'VERSIÓN: 2');
  assert.equal(metadata.table.body[2][0].text, 'FECHA: 18/09/2026');
  assert.equal(metadata.layout.hLineWidth(1, metadata), 0.7);
  assert.equal(metadata.layout.hLineWidth(2, metadata), 0.7);
});

test('soporta modo copia con texto Firmado y modo original con firma gráfica', async () => {
  // 1x1 transparent png base64
  const sampleSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const payload = {
    header: { codigo: 'COM-ID-FR-002', version: '1', fecha: '21/09/2026' },
    responsables: 'RESPONSABLE PRINCIPAL',
    dependencia: 'Dirección de Planeación y Aseguramiento de la Calidad',
    fecha: '21/09/2026',
    horario: '08:00 - 10:00',
    participantes: [
      { nombre: 'LUISA ORTEGA', cargo: 'Analista', status: 'signed', firma: 'Firmado', firma_data_url: sampleSignature },
      { nombre: 'DIEGO JOJOA', cargo: 'Secretario', status: 'signed', firma: 'Firmado', firma_data_url: sampleSignature },
      { nombre: 'ANDERSON SOLARTE', cargo: 'Coordinador', status: 'signed', firma: 'Firmado', firma_data_url: sampleSignature }
    ],
    objetivo: ['<p>Objetivo institucional.</p>'],
    desarrollo: ['<p>Desarrollo institucional.</p>'],
    conclusiones: ['<p>Conclusiones.</p>']
  };

  const originalBuffer = await generateMeetingMinutePdf(payload, { hideSignatures: false });
  assert.ok(Buffer.isBuffer(originalBuffer));
  assert.equal(originalBuffer.subarray(0, 4).toString(), '%PDF');

  const copyBuffer = await generateMeetingMinutePdf(payload, { hideSignatures: true });
  assert.ok(Buffer.isBuffer(copyBuffer));
  assert.equal(copyBuffer.subarray(0, 4).toString(), '%PDF');
});
