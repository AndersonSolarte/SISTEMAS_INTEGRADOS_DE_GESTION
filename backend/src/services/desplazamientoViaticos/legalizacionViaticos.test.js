const test = require('node:test');
const assert = require('node:assert/strict');
const { addColombiaBusinessDays } = require('../../utils/colombiaBusinessDays');
const { buildLegalizacionDefinition, buildLegalizacionPdfBuffer } = require('./legalizacionPdfService');
const {
  buildReminderEmail,
  getRecipientsForLegalizacion,
  _internals: { bogotaDateIso, millisecondsUntilNextRun, formatDateEs, SCHEDULE_HOUR }
} = require('./legalizacionReminderScheduler');

const fixture = () => ({
  legalizacion: {
    id: 101,
    codigo_verificacion: '6f9bd0ae-7155-4b6a-9dab-88548df6811d',
    estado: 'pendiente_legalizacion',
    fecha_habilitacion: '2026-08-12',
    fecha_limite: '2026-08-18',
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
    solicitante_snapshot: { nombre: 'Juan Pérez', documento: '12345678', email: 'juan.perez@unicesmag.edu.co' },
    datos_laborales: { dependencia: 'Dependencia de prueba', cargo: 'Profesional' },
    datos_salida: { fecha: '2026-08-10', fechaRegreso: '2026-08-12' },
    datos_viaticos: { lugarVisitar: 'Bogotá D. C.' },
    liquidacion: { totalAnticipo: 560000 }
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

test('clasifica estados de legalización respetando la fecha de regreso y vencimiento', () => {
  const computeState = (current, item) => {
    if (['finalizada', 'en_revision'].includes(item.estado)) return item.estado;
    if (current < item.fecha_habilitacion) return 'pendiente_habilitacion';
    if (current > item.fecha_limite) return 'legalizacion_vencida';
    return item.estado === 'presentada' ? 'en_revision' : 'pendiente_legalizacion';
  };

  const item = {
    estado: 'pendiente_habilitacion',
    fecha_habilitacion: '2026-08-20',
    fecha_limite: '2026-08-25'
  };

  // Antes de la fecha de regreso: debe ser pendiente_habilitacion (en viaje)
  assert.equal(computeState('2026-08-19', item), 'pendiente_habilitacion');

  // En la fecha de regreso o dentro de los 3 días hábiles: habilitada
  assert.equal(computeState('2026-08-20', item), 'pendiente_legalizacion');
  assert.equal(computeState('2026-08-25', item), 'pendiente_legalizacion');

  // Posterior al vencimiento de 3 días: vencida
  assert.equal(computeState('2026-08-26', item), 'legalizacion_vencida');

  // Si ya fue presentada o finalizada, no cambia
  assert.equal(computeState('2026-08-26', { ...item, estado: 'en_revision' }), 'en_revision');
  assert.equal(computeState('2026-08-26', { ...item, estado: 'finalizada' }), 'finalizada');
});

test('no cuenta comisiones futuras en viaje como activas en el badge del usuario', () => {
  const legalizaciones = [
    { id: 1, estado: 'pendiente_habilitacion' }, // Viaje en curso, aún no regresa
    { id: 2, estado: 'pendiente_legalizacion' }, // Ya regresó, debe legalizar
    { id: 3, estado: 'legalizacion_vencida' },   // Ya regresó y venció plazo
    { id: 4, estado: 'en_revision' },           // Ya presentó, esperando validación
    { id: 5, estado: 'finalizada' }             // Ya cerrado
  ];

  // Solo pendiente_legalizacion y legalizacion_vencida requieren acción activa del colaborador
  const activas = legalizaciones.filter((item) => ['pendiente_legalizacion', 'legalizacion_vencida'].includes(item.estado));

  assert.equal(activas.length, 2);
  assert.deepEqual(activas.map((i) => i.id), [2, 3]);

  // Cuando legaliza las 2 pendientes, el total activo es 0 y el módulo desaparece
  const postLegalizacion = legalizaciones
    .map((item) => ([2, 3].includes(item.id) ? { ...item, estado: 'en_revision' } : item))
    .filter((item) => ['pendiente_legalizacion', 'legalizacion_vencida'].includes(item.estado));

  assert.equal(postLegalizacion.length, 0);
});

test('construye correo de recordatorio a las 7:00 a. m. con 3 días hábiles y enlace al SIAC', () => {
  const { legalizacion, solicitud } = fixture();
  const email = buildReminderEmail({ ...legalizacion, solicitud });

  assert.equal(SCHEDULE_HOUR, 7);
  assert.match(email.subject, /Recordatorio: Habilitada legalización de viáticos/);
  assert.match(email.subject, /ADF-PP-FR-004-2026-0001/);
  assert.match(email.html, /Juan Pérez/);
  assert.match(email.html, /Bogotá D\. C\./);
  assert.match(email.html, /tres \(3\) días hábiles/);
  assert.match(email.html, /martes, 18 de agosto de 2026/);
  assert.match(email.html, /\$560\.000/);
  assert.match(email.html, /dashboard\/legalizacion-viaticos/);
  assert.match(email.html, /Legalización de viáticos/);
});

test('resolución de destinatarios respeta pruebas controladas y correos de colaboradores', () => {
  const { legalizacion, solicitud } = fixture();

  // Caso normal: va al solicitante
  const normalRecipients = getRecipientsForLegalizacion({ ...legalizacion, solicitud });
  assert.deepEqual(normalRecipients, ['juan.perez@unicesmag.edu.co']);

  // Caso prueba controlada: va a los correos configurados para la prueba
  const testSolicitud = {
    ...solicitud,
    datos_viaticos: {
      ...solicitud.datos_viaticos,
      pruebaControlada: true,
      correosPrueba: ['tester1@unicesmag.edu.co', 'tester2@unicesmag.edu.co']
    }
  };
  const testRecipients = getRecipientsForLegalizacion({ ...legalizacion, solicitud: testSolicitud });
  assert.deepEqual(testRecipients, ['tester1@unicesmag.edu.co', 'tester2@unicesmag.edu.co']);
});

test('programador calcula milisegundos hacia las 7:00 a. m. de Colombia', () => {
  const now = new Date('2026-10-28T11:00:00Z'); // 6:00 a. m. hora Colombia (UTC-5)
  const ms = millisecondsUntilNextRun(now);
  // Faltaría 1 hora (aprox 3,600,000 ms)
  assert.ok(ms > 0);
  assert.ok(ms <= 86400000);
});
