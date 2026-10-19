const test = require('node:test');
const assert = require('node:assert/strict');

const { getReposicionGlobalViewerEmails } = require('./reporteSalidaConfig');

test('usa exclusivamente las dos cuentas institucionales por defecto', () => {
  const previous = process.env.REPOSICION_GLOBAL_VIEWER_EMAILS;
  delete process.env.REPOSICION_GLOBAL_VIEWER_EMAILS;

  try {
    assert.deepEqual(getReposicionGlobalViewerEmails(), [
      'talentohumano.reportes@unicesmag.edu.co',
      'sgc@unicesmag.edu.co'
    ]);
  } finally {
    if (previous === undefined) delete process.env.REPOSICION_GLOBAL_VIEWER_EMAILS;
    else process.env.REPOSICION_GLOBAL_VIEWER_EMAILS = previous;
  }
});

test('normaliza, separa y elimina duplicados de la lista configurada', () => {
  const previous = process.env.REPOSICION_GLOBAL_VIEWER_EMAILS;
  process.env.REPOSICION_GLOBAL_VIEWER_EMAILS = ' UNO@UNICESMAG.EDU.CO ;dos@unicesmag.edu.co,uno@unicesmag.edu.co ';

  try {
    assert.deepEqual(getReposicionGlobalViewerEmails(), [
      'uno@unicesmag.edu.co',
      'dos@unicesmag.edu.co'
    ]);
  } finally {
    if (previous === undefined) delete process.env.REPOSICION_GLOBAL_VIEWER_EMAILS;
    else process.env.REPOSICION_GLOBAL_VIEWER_EMAILS = previous;
  }
});
