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
