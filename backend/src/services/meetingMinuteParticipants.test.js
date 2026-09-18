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
  assert.match(invitation.html, />Revisar y firmar acta</);
  assert.match(invitation.html, /Adjuntamos una copia del acta/);
  assert.match(invitation.text, /no necesita copiar ningún código/i);
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

