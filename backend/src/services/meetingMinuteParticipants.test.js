const test = require('node:test');
const assert = require('node:assert/strict');
const { _internals } = require('../controllers/meetingMinuteController');

test('ubica al responsable como primer participante sin duplicarlo', () => {
  const responsible = { id: 7, username: '10850001', nombre: 'RESPONSABLE PRINCIPAL', email: 'responsable@unicesmag.edu.co', dependencia: 'Planeación', cargo: 'Profesional' };
  const participants = [
    { user_id: 8, document: '10850002', name: 'OTRA PERSONA', email: 'otra@unicesmag.edu.co' },
    { user_id: 7, document: '10850001', name: 'RESPONSABLE PRINCIPAL', email: 'responsable@unicesmag.edu.co' }
  ];
  const result = _internals.placeResponsibleFirst(participants, responsible);
  assert.equal(result.length, 2);
  assert.equal(result[0].document, '10850001');
  assert.equal(result[0].name, 'RESPONSABLE PRINCIPAL');
  assert.equal(result[1].document, '10850002');
});

test('evita duplicar al responsable cuando solo coincide el correo', () => {
  const responsible = { id: 7, username: '10850001', nombre: 'RESPONSABLE PRINCIPAL', email: 'responsable@unicesmag.edu.co' };
  const result = _internals.placeResponsibleFirst([
    { document: '', name: 'RESPONSABLE PRINCIPAL', email: 'RESPONSABLE@UNICESMAG.EDU.CO' }
  ], responsible);
  assert.equal(result.length, 1);
  assert.equal(result[0].document, '10850001');
});

test('incluye la política de datos solamente en el correo del participante externo', () => {
  const external = _internals.buildPrivacyPolicyEmailSection(true);
  const internal = _internals.buildPrivacyPolicyEmailSection(false);
  assert.match(external.text, /Ley 1581 de 2012/);
  assert.match(external.text, /DATOS-UNICESMAG\.pdf/);
  assert.match(external.html, /marque la casilla de autorización/);
  assert.equal(internal.text, '');
  assert.equal(internal.html, '');
});

test('crea una invitación personal para firmar sin copiar códigos', () => {
  const invitation = _internals.buildSigningInvitationEmail({
    participant: { name: 'PARTICIPANTE INTERNO', user_id: 7 },
    minute: { code: 'ACTA-2026-001', content: { fecha: '2026-09-17' } },
    signingUrl: 'https://siac.example/firmar-acta-reunion/token-personal'
  });
  assert.match(invitation.subject, /ACTA-2026-001/);
  assert.match(invitation.html, /Adjuntamos una copia.*del acta/);
  assert.match(invitation.text, /Para revisar y firmar el acta/i);
  assert.doesNotMatch(invitation.text, /\b\d{6}\b/);
});

test('incluye la autorización de datos en la invitación del externo', () => {
  const invitation = _internals.buildSigningInvitationEmail({
    participant: { name: 'PARTICIPANTE EXTERNO', user_id: null },
    minute: { code: 'ACTA-2026-002', content: {} },
    signingUrl: 'https://siac.example/firmar-acta-reunion/token-externo'
  });
  assert.match(invitation.text, /Ley 1581 de 2012/);
  assert.match(invitation.html, /tratamiento de datos personales/i);
});

test('avisa en el mismo correo que un acta ajustada debe firmarse nuevamente', () => {
  const invitation = _internals.buildSigningInvitationEmail({
    participant: { name: 'PARTICIPANTE', email: 'participante@unicesmag.edu.co', user_id: 8 },
    minute: {
      code: 'ACTA-2026-003',
      content: { _revision: { requires_resignature: true }, fecha: '2026-09-25' }
    },
    signingUrl: 'https://siac.example/firmar-acta-reunion/nuevo-token'
  });
  assert.match(invitation.text, /incorporaron ajustes/i);
  assert.match(invitation.text, /firmas anteriores fueron invalidadas/i);
  assert.match(invitation.text, /firmar nuevamente/i);
});

test('solo reconoce como responsables de revisión al principal y corresponsables', () => {
  const minute = {
    created_by: 99,
    content: {
      responsables_data: [
        { user_id: 7, document: '10850001', email: 'principal@unicesmag.edu.co', is_primary: true },
        { user_id: 8, document: '10850002', email: 'corresponsable@unicesmag.edu.co', is_primary: false }
      ]
    }
  };
  assert.equal(_internals.isMinuteResponsible({ id: 7, username: '10850001' }, minute), true);
  assert.equal(_internals.isMinuteResponsible({ id: 8, email: 'corresponsable@unicesmag.edu.co' }, minute), true);
  assert.equal(_internals.isMinuteResponsible({ id: 99, email: 'creador@unicesmag.edu.co' }, minute), false);
  assert.equal(_internals.isMinuteResponsible({ id: 10, nombre: 'Mismo nombre del responsable' }, minute), false);
});

test('impide cambiar la lista de personas durante una revisión posterior a firmas', () => {
  const current = [
    { user_id: 7, document: '10850001', email: 'principal@unicesmag.edu.co' },
    { user_id: 8, document: '10850002', email: 'participante@unicesmag.edu.co' },
    { document: 'EXT-1', email: 'externo@example.com' }
  ];
  assert.equal(_internals.hasSameParticipantMembership(current, [...current].reverse()), true);
  assert.equal(_internals.hasSameParticipantMembership(current, current.slice(0, 2)), false);
  assert.equal(_internals.hasSameParticipantMembership(current, [...current, { document: 'EXT-2', email: 'otro@example.com' }]), false);
  assert.equal(_internals.hasSameParticipantMembership(current, [current[0], current[2], { user_id: 9, document: '10850003' }]), false);
});

test('muestra entidad y cargo para participantes externos', () => {
  assert.equal(_internals.participantRoleLabel({ user_id: null, organization: 'Fundación Ejemplo', role_title: 'Contratista' }), 'Fundación Ejemplo · Contratista');
  assert.equal(_internals.participantRoleLabel({ user_id: 9, organization: 'Universidad CESMAG', role_title: 'Docente' }), 'Docente');
});

test('conserva completos los espacios de escritura sin límite de caracteres', () => {
  const content = `<p>${'Contenido institucional completo. '.repeat(10000)}</p>`;
  const sanitized = _internals.sanitizeRichText(content);
  assert.equal(sanitized.length, content.length);
  assert.match(sanitized, /Contenido institucional completo/);
});

test('valida la existencia de participantes adicionales aparte del responsable', () => {
  const responsible = { id: 7, username: '10850001', nombre: 'RESPONSABLE PRINCIPAL', email: 'responsable@unicesmag.edu.co' };
  const onlyResponsible = _internals.placeResponsibleFirst([], responsible);
  const withAdditional = _internals.placeResponsibleFirst([
    { document: '10850002', name: 'PARTICIPANTE ADICIONAL', email: 'adicional@unicesmag.edu.co' }
  ], responsible);

  assert.equal(onlyResponsible.filter((_, idx) => idx > 0).length, 0);
  assert.equal(withAdditional.filter((_, idx) => idx > 0).length, 1);
});

test('ubica a múltiples responsables al inicio sin duplicar entre sí ni con participantes', () => {
  const responsibles = [
    { id: 7, username: '10850001', nombre: 'RESPONSABLE 1', email: 'resp1@unicesmag.edu.co', cargo: 'Director' },
    { id: 9, username: '10850003', nombre: 'RESPONSABLE 2', email: 'resp2@unicesmag.edu.co', cargo: 'Decano' }
  ];
  const participants = [
    { user_id: 8, document: '10850002', name: 'INVITADO', email: 'invitado@unicesmag.edu.co' },
    { user_id: 9, document: '10850003', name: 'RESPONSABLE 2', email: 'resp2@unicesmag.edu.co' }
  ];
  const result = _internals.placeResponsibleFirst(participants, responsibles);
  assert.equal(result.length, 3);
  assert.equal(result[0].document, '10850001');
  assert.equal(result[1].document, '10850003');
  assert.equal(result[2].document, '10850002');
});

test('asegura asunto e identificadores de hilo para agrupar correos en una misma conversacion', () => {
  const code = 'ACTA-2026-762045576';
  const email = 'docente@unicesmag.edu.co';
  const subject = _internals.minuteThreadSubject(code);
  const rootId = _internals.minuteRootMessageId(code);
  const participantMsgId = _internals.minuteParticipantMessageId(code, email);

  assert.equal(subject, 'ACTA-2026-762045576 · Acta de reunión');
  assert.match(rootId, /^<minute\.acta-2026-762045576@unicesmag\.edu\.co>$/);
  assert.match(participantMsgId, /^<minute\.acta-2026-762045576\.docenteunicesmageduco@unicesmag\.edu\.co>$/);
});

test('convierte las dependencias en lugares de oficina sin duplicar el prefijo', () => {
  assert.equal(_internals.formatDependencyOfficeLocation('Dirección de Planeación'), 'Oficina de Dirección de Planeación');
  assert.equal(_internals.formatDependencyOfficeLocation('Oficina de Archivo'), 'Oficina de Archivo');
  assert.equal(_internals.formatDependencyOfficeLocation('  Gestión   Humana  '), 'Oficina de Gestión Humana');
  assert.equal(_internals.formatDependencyOfficeLocation(''), '');
});
