const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isMeetingMinuteDocument,
  isAttendanceMeetingMinuteDocument,
  isCouncilMeetingMinuteDocument,
  resolveMeetingMinuteFormatCode,
  getMeetingMinuteFormatMeta,
  getMeetingMinuteFormatStates,
  setMeetingMinuteFormatState,
  isMeetingMinuteFormatEnabled
} = require('../config/meetingMinuteConfig');
const { generateCouncilMinutePdf, _internals: councilPdfInternals } = require('./councilMinutePdfService');
const { generateCouncilActaBuffer } = require('./councilMinuteExportService');
const { _internals: meetingMinuteInternals } = require('../controllers/meetingMinuteController');

test('calcula el consecutivo anual sin reutilizar actas archivadas o eliminadas', () => {
  const minutes = [
    { content: { format_code: 'COM-GD-FR-012', fecha: '2026-01-10', numero_acta: '01' } },
    { content: { format_code: 'COM-GD-FR-012', fecha: '2026-06-15', numero_acta: '09' }, deleted_at: new Date() },
    { content: { format_code: 'COM-GD-FR-012', fecha: '2025-12-20', numero_acta: '25' } },
    { content: { format_code: 'COM-ID-FR-002', fecha: '2026-08-01', numero_acta: '80' } }
  ];

  assert.equal(meetingMinuteInternals.calculateNextCouncilMinuteNumber(minutes, 2026), '10');
  assert.equal(meetingMinuteInternals.calculateNextCouncilMinuteNumber(minutes, 2027), '01');
});

test('separa asistentes de firmantes y solo incluye las personas seleccionadas para firma', () => {
  const groups = councilPdfInternals.resolveCouncilGroups({
    participantes: [
      { name: 'Persona participante', member_kind: 'miembro', attendance_type: 'asistente', requires_signature: false },
      { name: 'Persona firmante', member_kind: 'miembro', attendance_type: 'asistente', requires_signature: true },
      { name: 'Invitada presente', member_kind: 'invitado', attendance_type: 'asistente', requires_signature: false }
    ],
    invitados_sin_firma_data: [
      { name: 'Miembro pendiente', member_kind: 'miembro' },
      { name: 'Invitado registrado', member_kind: 'invitado' }
    ],
    ausentes_data: [{ name: 'Miembro ausente', member_kind: 'miembro' }]
  });

  assert.equal(groups.asistentes.length, 2);
  assert.equal(groups.invitados.length, 2);
  assert.equal(groups.pendientes.length, 1);
  assert.equal(groups.ausentes.length, 1);
  assert.equal(groups.firmantes.length, 1);
  assert.equal(groups.firmantes[0].name, 'Persona firmante');
});

test('impide que una persona ausente sea firmante o reciba invitación de firma', () => {
  const absentParticipant = {
    id: 15,
    document: '10850001',
    name: 'Miembro Ausente',
    email: 'ausente@unicesmag.edu.co'
  };
  const minute = {
    content: {
      format_code: 'COM-GD-FR-012',
      participantes_meta: [{
        document: '10850001',
        email: 'ausente@unicesmag.edu.co',
        name: 'Miembro Ausente',
        requires_signature: true
      }],
      ausentes_data: [{
        document: '10850001',
        email: 'ausente@unicesmag.edu.co',
        name: 'Miembro Ausente',
        member_kind: 'miembro'
      }]
    }
  };

  assert.equal(meetingMinuteInternals.participantIsCouncilAbsent(absentParticipant, minute), true);
  assert.equal(meetingMinuteInternals.participantRequiresSignature(absentParticipant, minute), false);
});

test('reconoce ambos formatos sistematizados (COM-ID-FR-002 y COM-GD-FR-012) de forma independiente', () => {
  assert.equal(isMeetingMinuteDocument({ codigo: 'COM-ID-FR-002', nombre: 'Registro de Asistencia y Reunión' }), true);
  assert.equal(isMeetingMinuteDocument({ codigo: 'COM-GD-FR-012', nombre: 'ACTA DE REUNIÓN CONSEJOS Y COMITÉS' }), true);
  assert.equal(isAttendanceMeetingMinuteDocument({ codigo: 'COM-ID-FR-002' }), true);
  assert.equal(isAttendanceMeetingMinuteDocument({ codigo: 'COM-GD-FR-012' }), false);
  assert.equal(isCouncilMeetingMinuteDocument({ codigo: 'COM-GD-FR-012' }), true);
  assert.equal(isCouncilMeetingMinuteDocument({ codigo: 'COM-ID-FR-002' }), false);

  assert.equal(resolveMeetingMinuteFormatCode({ codigo: 'COM-ID-FR-002' }), 'COM-ID-FR-002');
  assert.equal(resolveMeetingMinuteFormatCode({ codigo: 'COM-GD-FR-012' }), 'COM-GD-FR-012');
  assert.equal(resolveMeetingMinuteFormatCode({ content: { format_code: 'COM-GD-FR-012' } }), 'COM-GD-FR-012');
  assert.equal(getMeetingMinuteFormatMeta('COM-GD-FR-012').version, '2');
});

test('controla la activación independiente por formato (switch de administración)', async () => {
  await setMeetingMinuteFormatState('COM-GD-FR-012', false);
  assert.equal(await isMeetingMinuteFormatEnabled('COM-GD-FR-012'), false);

  await setMeetingMinuteFormatState('COM-GD-FR-012', true);
  assert.equal(await isMeetingMinuteFormatEnabled('COM-GD-FR-012'), true);

  const states = await getMeetingMinuteFormatStates();
  assert.equal(typeof states['COM-ID-FR-002'], 'boolean');
  assert.equal(states['COM-GD-FR-012'], true);
});

test('genera el PDF oficial de COM-GD-FR-012 (Acta de Reunión Consejos y Comités) en modo original y copia', async () => {
  const sampleData = {
    code: 'ACTA-CC-20261021-ABC123',
    header: {
      codigo: 'COM-GD-FR-012',
      version: '2',
      fecha: '15/09/2023'
    },
    numero_acta: '05',
    nombre_consejo: 'CONSEJO ACADÉMICO',
    lugar: 'Sala de Juntas Rectoría',
    fecha: '2026-10-21',
    horario: '08:00 - 10:30',
    objetivo: ['<p>Aprobar las modificaciones curriculares del semestre.</p>'],
    orden_del_dia: ['<ol><li>Verificación del quórum</li><li>Aprobación del acta anterior</li><li>Asuntos varios</li></ol>'],
    desarrollo: ['<p>Se verifica el quórum reglamentario y se aprueban por unanimidad los puntos del orden del día.</p>'],
    conclusiones: ['<p>Remitir acuerdo al Consejo Directivo.</p>'],
    ausentes_data: [
      { titulo_academico: 'Dr.', name: 'Carlos Alberto Pérez', role_title: 'Decano Facultad de Ingeniería' }
    ],
    invitados_sin_firma_data: [
      { titulo_academico: 'Mg.', name: 'Laura Sofía Gómez', role_title: 'Coordinadora de Autoevaluación' }
    ],
    participants: [
      {
        name: 'Adriana Carolina Valdes',
        titulo_academico: 'Mg.',
        role_title: 'Presidente del Consejo',
        cargo_acta: 'Presidente del Consejo',
        attendance_type: 'asistente',
        status: 'signed'
      },
      {
        name: 'Juan Camilo Solarte',
        titulo_academico: 'Esp.',
        role_title: 'Secretario Académico',
        cargo_acta: 'Secretario Académico',
        attendance_type: 'asistente',
        status: 'signed'
      },
      {
        name: 'María Fernanda López',
        titulo_academico: 'Ing.',
        role_title: 'Invitada Especial',
        cargo_acta: 'Invitada Especial',
        attendance_type: 'invitado',
        status: 'invited'
      }
    ]
  };

  const pdfOriginal = await generateCouncilMinutePdf(sampleData, { isCopy: false });
  assert.ok(Buffer.isBuffer(pdfOriginal));
  assert.ok(pdfOriginal.length > 5000);
  assert.equal(pdfOriginal.subarray(0, 4).toString('ascii'), '%PDF');

  const pdfCopy = await generateCouncilMinutePdf(sampleData, { isCopy: true });
  assert.ok(Buffer.isBuffer(pdfCopy));
  assert.ok(pdfCopy.length > 5000);
  assert.equal(pdfCopy.subarray(0, 4).toString('ascii'), '%PDF');
});

test('genera el documento Word (.docx) de COM-GD-FR-012 con encabezados y bloques de firma', async () => {
  const docxBuffer = await generateCouncilActaBuffer({
    code: 'ACTA-CC-20261021-ABC123',
    header: {
      codigo: 'COM-GD-FR-012',
      version: '2',
      fecha: '15/09/2023'
    },
    numero_acta: '05',
    nombre_consejo: 'CONSEJO ACADÉMICO',
    lugar: 'Sala de Juntas Rectoría',
    fecha: '2026-10-21',
    horario: '08:00 - 10:30',
    objetivo: ['<p>Aprobar las modificaciones curriculares del semestre.</p>'],
    orden_del_dia: ['<p>1. Verificación del quórum</p>'],
    desarrollo: ['<p>Desarrollo completo de la sesión.</p>'],
    conclusiones: [],
    ausentes_data: [
      { titulo_academico: 'Dr.', name: 'Carlos Alberto Pérez', role_title: 'Decano' }
    ],
    invitados_sin_firma_data: [],
    participants: [
      {
        name: 'Adriana Carolina Valdes',
        titulo_academico: 'Mg.',
        role_title: 'Presidente del Consejo',
        cargo_acta: 'Presidente del Consejo',
        attendance_type: 'asistente',
        status: 'signed'
      },
      {
        name: 'Juan Camilo Solarte',
        titulo_academico: 'Esp.',
        role_title: 'Secretario Académico',
        cargo_acta: 'Secretario Académico',
        attendance_type: 'asistente',
        status: 'signed'
      }
    ]
  });

  assert.ok(Buffer.isBuffer(docxBuffer));
  assert.ok(docxBuffer.length > 10000);
  assert.equal(docxBuffer.subarray(0, 2).toString('ascii'), 'PK');
});
