const test = require('node:test');
const assert = require('node:assert/strict');
const { addColombiaBusinessDays } = require('../../utils/colombiaBusinessDays');
const { buildLegalizacionDefinition, buildLegalizacionPdfBuffer } = require('./legalizacionPdfService');

const fixture = () => ({
  legalizacion: {
    codigo_verificacion: '6f9bd0ae-7155-4b6a-9dab-88548df6811d',
    detalles: [
      { id: 'concepto-1', detalle: 'Manutención', valorAnticipo: 320000, valorLegalizado: 300000, diferencia: 20000 },
      { id: 'concepto-2', detalle: 'Alojamiento', valorAnticipo: 240000, valorLegalizado: 240000, diferencia: 0 }
    ],
    observaciones: 'Soportes revisados.',
    adjuntos: [
      { detalle: 'Manutención', originalName: 'factura-manuntencion.pdf' },
      { detalle: 'Alojamiento', originalName: 'factura-hotel.pdf' }
    ],
    trazabilidad: [
      { event: 'pago_autorizado', actor: { nombre: 'SIAC UNICESMAG' }, at: '2026-08-12T13:00:00.000Z' },
      { event: 'legalizacion_presentada', actor: { nombre: 'Colaborador', email: 'colaborador@unicesmag.edu.co' }, at: '2026-08-18T13:00:00.000Z' },
      { event: 'legalizacion_validada', actor: { nombre: 'Técnico Contable', email: 'tecnico.viceadfin@unicesmag.edu.co' }, at: '2026-08-18T15:00:00.000Z' }
    ]
  },
  solicitud: {
    consecutivo: 'ADF-PP-FR-004-2026-0001',
    solicitante_snapshot: { nombre: 'Colaborador', documento: '12345678' },
    datos_laborales: { dependencia: 'Dependencia de prueba', cargo: 'Profesional' },
    datos_salida: { fecha: '2026-08-10', fechaRegreso: '2026-08-12' },
    datos_viaticos: { lugarVisitar: 'Bogotá' }
  }
});

test('calcula tres días hábiles incluyendo festivos colombianos', () => {
  assert.equal(addColombiaBusinessDays('2026-08-12', 3), '2026-08-18');
});

test('el FR-005 contiene firmas, trazabilidad y verificación', () => {
  const { legalizacion, solicitud } = fixture();
  const definition = buildLegalizacionDefinition(legalizacion, solicitud);
  const serialized = JSON.stringify(definition);
  assert.match(serialized, /FIRMAS ELECTRÓNICAS/);
  assert.match(serialized, /Colaborador/);
  assert.match(serialized, /Técnico Contable/);
  assert.match(serialized, /TRAZABILIDAD DE LA LEGALIZACIÓN/);
  assert.match(serialized, /VERIFICACIÓN DE AUTENTICIDAD/);
  assert.match(serialized, /6f9bd0ae-7155-4b6a-9dab-88548df6811d/);
});

test('genera un PDF FR-005 válido y no vacío', async () => {
  const { legalizacion, solicitud } = fixture();
  const pdf = await buildLegalizacionPdfBuffer(legalizacion, solicitud);
  assert.ok(Buffer.isBuffer(pdf));
  assert.ok(pdf.length > 10000);
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
});
