const assert = require('node:assert/strict');
const test = require('node:test');
const { isMeetingMinuteDocument } = require('../config/meetingMinuteConfig');
const { generateActaBuffer } = require('./actaExportService');

test('reconoce el formato institucional de asistencia y reunión', () => {
  assert.equal(isMeetingMinuteDocument({ codigo: 'COM-ID-FR-002', titulo: 'REGISTRO DE ASISTENCIA Y REUNIÓN' }), true);
  assert.equal(isMeetingMinuteDocument({ codigo: 'THM-DP-FR-002', titulo: 'REPORTE DE SALIDA' }), false);
});

test('genera el documento Word con encabezado dinámico', async () => {
  const buffer = await generateActaBuffer({
    header: { codigo: 'COM-ID-FR-002', version: '1', fecha: '06/02/2020' },
    responsables: 'Área responsable',
    dependencia: 'Dependencia que cita',
    participantes: [{ nombre: 'Participante', cargo: 'Cargo', firma: 'Pendiente · QR' }],
    objetivo: ['Objetivo'],
    desarrollo: ['Desarrollo'],
    conclusiones: ['Compromiso']
  });
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1000);
});

test('exporta contenido enriquecido y tablas del acta', async () => {
  const buffer = await generateActaBuffer({
    header: { codigo: 'COM-ID-FR-002', version: '1', fecha: '16/09/2026' },
    fecha: '16/09/2026',
    objetivo: ['<h3 style="text-align:center">Objetivo institucional</h3><p><strong>Texto destacado</strong> con <u>subrayado</u> y <a href="https://www.unicesmag.edu.co" target="_blank" rel="noopener noreferrer">enlace institucional</a>.</p>'],
    desarrollo: ['<ul><li>Primer asunto</li><li>Segundo asunto</li></ul><table><tbody><tr><th>Compromiso</th><th>Responsable</th><th>Fecha</th></tr><tr><td>Entregar informe</td><td>Planeación</td><td>30/09/2026</td></tr><tr><td>Revisar resultados</td><td>Calidad</td><td>15/10/2026</td></tr></tbody></table>'],
    conclusiones: ['<ol><li>Primer acuerdo</li><li>Segundo acuerdo</li></ol>']
  });
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1500);
});

test('genera el documento Word con múltiples responsables en cuadros estructurados', async () => {
  const buffer = await generateActaBuffer({
    header: { codigo: 'COM-ID-FR-002', version: '1', fecha: '18/09/2026' },
    responsables_data: [
      { name: 'Dr. Principal', role_title: 'Director de Calidad', organization: 'Vicerrectoría', is_primary: true },
      { name: 'Dra. Adjunta', role_title: 'Coordinadora de Procesos', organization: 'Planeación', is_primary: false }
    ],
    dependencia: 'Vicerrectoría de Aseguramiento',
    participantes: [
      { nombre: 'Dr. Principal', cargo: 'Director de Calidad', firma: 'Firmado' },
      { nombre: 'Dra. Adjunta', cargo: 'Coordinadora de Procesos', firma: 'Firmado' },
      { nombre: 'Invitado Externo', cargo: 'Asesor', firma: 'Pendiente' }
    ],
    objetivo: ['Revisión institucional'],
    desarrollo: ['Desarrollo de puntos'],
    conclusiones: ['Compromisos acordados']
  });
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1500);
});

test('formatea nombres propios a formato formal (Title Case) con partículas en minúscula', () => {
  const { formatPersonName } = require('../utils/formatPersonName');
  assert.strictEqual(formatPersonName('ANDERSON DAVID SOLARTE CAICEDO'), 'Anderson David Solarte Caicedo');
  assert.strictEqual(formatPersonName('GUILLERMO DE CASTELLANA'), 'Guillermo de Castellana');
  assert.strictEqual(formatPersonName('MARIA DEL CARMEN LASSO'), 'Maria del Carmen Lasso');
  assert.strictEqual(formatPersonName('juan sebastian lopez-perez'), 'Juan Sebastian Lopez-Perez');
  assert.strictEqual(formatPersonName('  DAVID   SOLARTE  '), 'David Solarte');
  assert.strictEqual(formatPersonName(''), '');
  assert.strictEqual(formatPersonName(null), '');
});

test('resuelve responsables, cédula y dependencia para el archivo de actas', () => {
  const { _internals } = require('../controllers/meetingMinuteController');
  const { resolveArchiveResponsibleInfo } = _internals;

  const fromStructured = resolveArchiveResponsibleInfo({
    creator: { nombre: 'ADMINISTRADOR SIAC', username: '789545', dependencia: 'Sistemas' },
    content: {
      dependencia: 'Dirección de Planeación',
      responsable_document: '1085327166',
      responsables_data: [
        { name: 'ANDERSON DAVID SOLARTE CAICEDO', document: '1085327166', is_primary: true, organization: 'Planeación' },
        { name: 'SOFIA VALERIA MARTINEZ SALAS', document: '1004555666', is_primary: false, organization: 'Acompañamiento Integral' }
      ]
    }
  });
  assert.equal(fromStructured.responsible_name, 'Anderson David Solarte Caicedo');
  assert.equal(fromStructured.responsible_document, '1085327166');
  assert.equal(fromStructured.creator, 'Anderson David Solarte Caicedo');
  assert.equal(fromStructured.creator_document, '789545');
  assert.equal(fromStructured.responsables.length, 2);
  assert.equal(fromStructured.dependency, 'Dirección de Planeación');

  const fromLegacyText = resolveArchiveResponsibleInfo({
    creator: { nombre: 'SOFIA VALERIA MARTINEZ SALAS', username: '1004555666', dependencia: 'Area de Acompañamiento Integral' },
    content: {
      responsables: '• SOFIA VALERIA MARTINEZ SALAS (Profesional · Area de Acompañamiento Integral)'
    }
  });
  assert.equal(fromLegacyText.responsible_name, 'Sofia Valeria Martinez Salas');
  assert.equal(fromLegacyText.responsible_document, '1004555666');
  assert.equal(fromLegacyText.dependency, 'Area de Acompañamiento Integral');

  const fromCreatorOnly = resolveArchiveResponsibleInfo({
    creator: { nombre: 'LAURA SOFIA GONZALEZ', username: '1085999888', dependencia: 'Bienestar Universitario' },
    content: {}
  });
  assert.equal(fromCreatorOnly.responsible_name, 'Laura Sofia Gonzalez');
  assert.equal(fromCreatorOnly.responsible_document, '1085999888');
  assert.equal(fromCreatorOnly.responsables.length, 1);
  assert.equal(fromCreatorOnly.dependency, 'Bienestar Universitario');
});

test('registra rutas y acciones definitivas de estadísticas de actas antes de /:id', async (t) => {
  const router = require('../routes/meetingMinuteRoutes');
  const controller = require('../controllers/meetingMinuteController');
  const {
    DigitalMeetingMinute,
    DigitalMeetingParticipant,
    DigitalMeetingSchedule,
    DigitalMeetingSignature
  } = require('../models');
  const { sequelize } = require('../config/database');

  const routePaths = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods)
    }));

  const resendIdx = routePaths.findIndex((r) => r.path === '/statistics/:id/resend-pending' && r.methods.includes('post'));
  const deleteStatsIdx = routePaths.findIndex((r) => r.path === '/statistics/:id' && r.methods.includes('delete'));
  const genericDeleteIdx = routePaths.findIndex((r) => r.path === '/:id' && r.methods.includes('delete'));

  assert.ok(resendIdx >= 0);
  assert.ok(deleteStatsIdx >= 0);
  assert.ok(genericDeleteIdx > deleteStatsIdx);

  const mockRes = () => ({
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  });

  t.mock.method(DigitalMeetingMinute, 'findByPk', async (id) => {
    if (id === 'no-pending') {
      return {
        id: 'no-pending',
        code: 'ACTA-2026-1',
        status: 'signed',
        content: {},
        participants: [{ id: 'p-1', status: 'signed' }]
      };
    }
    if (id === 'to-delete') {
      return {
        id: 'to-delete',
        code: 'ACTA-2026-DEL',
        signatures: []
      };
    }
    return null;
  });

  const resConflict = mockRes();
  await controller.resendArchivedPendingInvitations({ params: { id: 'no-pending' }, user: { id: 1 } }, resConflict);
  assert.equal(resConflict.statusCode, 409);
  assert.equal(resConflict.body.success, false);

  const destroyed = [];
  t.mock.method(sequelize, 'transaction', async (callback) => callback({ id: 'tx-1' }));
  t.mock.method(DigitalMeetingSignature, 'destroy', async ({ where }) => { destroyed.push(['signature', where.minute_id]); });
  t.mock.method(DigitalMeetingSchedule, 'destroy', async ({ where }) => { destroyed.push(['schedule', where.minute_id]); });
  t.mock.method(DigitalMeetingParticipant, 'destroy', async ({ where }) => { destroyed.push(['participant', where.minute_id]); });
  t.mock.method(DigitalMeetingMinute, 'destroy', async ({ where }) => { destroyed.push(['minute', where.id]); });

  const resDelete = mockRes();
  await controller.permanentlyDeleteArchivedMinute({ params: { id: 'to-delete' }, user: { id: 1 } }, resDelete);
  assert.equal(resDelete.statusCode, 200);
  assert.equal(resDelete.body.success, true);
  assert.deepEqual(destroyed, [
    ['signature', 'to-delete'],
    ['schedule', 'to-delete'],
    ['participant', 'to-delete'],
    ['minute', 'to-delete']
  ]);
});
