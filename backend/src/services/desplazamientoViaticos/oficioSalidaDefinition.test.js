const test = require('node:test');
const assert = require('node:assert/strict');
const PdfPrinter = require('pdfmake');
const parsePdf = require('pdf-parse');
const { buildOficioPdfDefinition } = require('../reporteSalidaPdfService');

const fixture = () => ({
  id: 42, consecutivo: 'PRUEBA-OFICIO-001', estado: 'finalizada', created_at: '2026-11-18T13:00:00Z',
  solicitante_snapshot: { nombre: 'COLABORADOR DE PRUEBA', username: '100000', email: 'colaborador@example.invalid' },
  jefe_snapshot: { nombre: 'JEFE DE PRUEBA', cargo: 'Director de dependencia', email: 'jefe@example.invalid' },
  datos_formulario: {
    tx_id: 'prueba-sin-validez', origen_flujo: 'desplazamiento_viaticos',
    laboral: { dependencia: 'Dependencia de Prueba', cargo: 'Docente Tiempo Completo', vicerrectoria: 'Vicerrectoría Académica' },
    salida: { tipo: 'visita_ies', categoria: 'propias_cargo', duracionTipo: '1_2_dias', fecha: '2026-11-20', fechaRegreso: '2026-11-21',
      horaInicio: '06:00', horaFin: '19:00', alcance: 'Nacional', municipio: 'Medellín', entidadDestino: 'Universidad de prueba', motivo: 'Encuentro de cooperación académica' },
    viaticos: { requiereViaticos: true, numeroDiasSolicitados: 10, fechaEvento: '2026-11-20', objetoComision: 'Fortalecer la cooperación y presentar la propuesta académica.',
      transporte: 'Aéreo', alojamiento: 'Hotel', observacionesEspeciales: 'Atender la agenda institucional adjunta.', numeroCuenta: 'NO-DEBE-PUBLICARSE', entidadBancaria: 'BANCO-PRIVADO' },
    plan_aprobacion_normal: [
      { key: 'jefe', label: 'Jefe inmediato', email: 'jefe@example.invalid' },
      { key: 'financiera_previa', label: 'Vicerrectoría Financiera', email: 'financiera@example.invalid' },
      { key: 'sst', label: 'Seguridad y Salud en el Trabajo', email: 'sst@example.invalid' },
      { key: 'gestion_humana', label: 'Gestión del Talento Humano', email: 'gh@example.invalid' }
    ]
  },
  trazabilidad: [
    { event: 'radicada', at: '2026-11-18T13:00:00Z' },
    ...['aprobada_jefe', 'aprobada_vicerrectoria_financiera', 'aprobada_sst', 'aprobada_gestion_humana', 'pago_autorizado_tesoreria'].map((event, i) => ({
      event, at: `2026-11-18T14:0${i}:00Z`, actor: { nombre: `RESPONSABLE ${i}`, cargo: 'Cargo de prueba', email: `responsable${i}@example.invalid` },
      detail: { observacion: `Observación institucional ${i}` }
    }))
  ]
});

test('el oficio de viáticos contiene información completa sin exponer datos bancarios', () => {
  const definition = buildOficioPdfDefinition(fixture());
  const content = JSON.stringify(definition.content);
  for (const expected of ['COLABORADOR DE PRUEBA', '100000', 'Dependencia de Prueba', 'Docente Tiempo Completo', 'colaborador@example.invalid',
    'Fortalecer la cooperación', 'Medellín', 'Universidad de prueba', '20 de noviembre de 2026', '21 de noviembre de 2026',
    '6:00 a. m.', '7:00 p. m.', '10 días solicitados', 'Aéreo', 'Hotel', 'Saludo de Paz y Bien.', 'Fraternalmente,', 'Universidad CESMAG']) {
    assert.ok(content.includes(expected), expected);
  }
  assert.ok(!content.includes('NO-DEBE-PUBLICARSE')); assert.ok(!content.includes('BANCO-PRIVADO'));
});

test('usa el plan real de viáticos y no inventa una firma académica o rectoral pendiente', () => {
  const content = JSON.stringify(buildOficioPdfDefinition(fixture()).content);
  assert.ok(!content.includes('APROBACION de Vicerrectoria Academica'));
  assert.ok(!content.includes('Actuación pendiente'));
  assert.ok(content.includes('Vicerrectoría Financiera'));
  assert.ok(content.includes('RESPONSABLE 4')); assert.ok(content.includes('Salida autorizada'));
  assert.ok(content.includes('Usuario: RESPONSABLE 0')); assert.ok(content.includes('responsable0@example.invalid'));
});

test('una solicitud pendiente o rechazada no se presenta como autorizada', () => {
  const pending = fixture(); pending.estado = 'pendiente_aprobacion_jefe'; pending.trazabilidad = pending.trazabilidad.slice(0, 1);
  const content = JSON.stringify(buildOficioPdfDefinition(pending).content);
  assert.ok(content.includes('Solicitud en trámite')); assert.ok(content.includes('no constituyen autorización definitiva'));
  assert.ok(content.includes('Actuación pendiente')); assert.ok(!content.includes('Salida autorizada'));
  pending.estado = 'no_aprobada';
  assert.ok(JSON.stringify(buildOficioPdfDefinition(pending).content).includes('No constituye autorización de salida'));
});

test('el estado finalizada sin confirmación de Tesorería no acredita la salida aprobada', () => {
  const solicitud = fixture();
  solicitud.trazabilidad = solicitud.trazabilidad.filter(trace => trace.event !== 'pago_autorizado_tesoreria');
  const content = JSON.stringify(buildOficioPdfDefinition(solicitud).content);
  assert.ok(!content.includes('Salida autorizada'));
  assert.ok(content.includes('Solicitud en trámite de aprobación'));
});

test('la fecha de expedición utiliza el día de Colombia incluso al cambiar de día en UTC', () => {
  const solicitud = fixture();
  solicitud.created_at = new Date('2026-11-19T02:00:00Z');
  solicitud.trazabilidad = solicitud.trazabilidad.filter(trace => trace.event !== 'radicada');
  const content = JSON.stringify(buildOficioPdfDefinition(solicitud).content);
  assert.ok(content.includes('San Juan de Pasto, 18 de noviembre de 2026'));
});

test('conserva el texto personalizado y no altera el oficio de solicitudes sin viáticos', () => {
  const custom = fixture(); custom.datos_formulario.salida.oficioCuerpo = 'Texto institucional personalizado que debe conservarse.';
  assert.ok(JSON.stringify(buildOficioPdfDefinition(custom).content).includes(custom.datos_formulario.salida.oficioCuerpo));
  const normal = fixture(); delete normal.datos_formulario.origen_flujo; delete normal.datos_formulario.viaticos;
  const content = JSON.stringify(buildOficioPdfDefinition(normal).content);
  assert.ok(content.includes('DATOS DE CONTROL INSTITUCIONAL DE LA SOLICITUD'));
  assert.ok(!content.includes('Duración solicitada en FR-004'));
});

test('genera un PDF legible con todas las secciones y trazabilidad', async () => {
  const definition = buildOficioPdfDefinition(fixture());
  const printer = new PdfPrinter({ ReportFont: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' } });
  const buffer = await new Promise((resolve, reject) => {
    const doc = printer.createPdfKitDocument(definition), chunks = [];
    doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); doc.end();
  });
  const result = await parsePdf(buffer);
  assert.ok(result.numpages >= 2 && result.numpages <= 5, `Paginación inesperada: ${result.numpages}`);
  for (const part of ['Identificación del solicitante', 'Objeto y alcance', 'Programación y condiciones', 'Actuaciones y firmas', 'Anexos y verificación', '100000', 'responsable4@example.invalid']) assert.ok(result.text.includes(part), part);
});
