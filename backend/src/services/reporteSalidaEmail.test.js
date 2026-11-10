const test = require('node:test');
const assert = require('node:assert/strict');
const { routeSalidaRecipients, sendInstitutionalEmail } = require('./reporteSalidaEmail');

test('las cuentas histórica e individual de Investigación convergen en Javier sin duplicados', () => {
  assert.deepEqual(routeSalidaRecipients([
    ' VICEINVESTIGA@unicesmag.edu.co ', 'jajimenez@unicesmag.edu.co',
    'gestionhumana@unicesmag.edu.co', 'seguridadysalud@unicesmag.edu.co'
  ]), ['jajimenez@unicesmag.edu.co', 'gestionhumana@unicesmag.edu.co', 'seguridadysalud@unicesmag.edu.co']);
});

test('protege el envío real conservando adjuntos, tokens, hilos y destinatarios ajenos', async (t) => {
  const calls = [];
  t.mock.method(require('./emailService'), 'sendInstitutionalEmail', async (options) => {
    calls.push(options);
    return { success: true };
  });
  const options = {
    to: 'viceinvestiga@unicesmag.edu.co;viceacad@unicesmag.edu.co',
    subject: 'Aprobación', html: '<a href="/aprobar?token=prueba">Aprobar</a>',
    attachments: [{ filename: 'salida.pdf', content: 'test' }],
    headers: { 'In-Reply-To': 'hilo-test' }
  };
  await sendInstitutionalEmail(options);
  assert.deepEqual(calls[0], { ...options, to: ['jajimenez@unicesmag.edu.co', 'viceacad@unicesmag.edu.co'] });
  assert.equal(options.to, 'viceinvestiga@unicesmag.edu.co;viceacad@unicesmag.edu.co');
});
