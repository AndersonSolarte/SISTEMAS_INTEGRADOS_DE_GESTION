const test = require('node:test');
const assert = require('node:assert/strict');
const { sqlInjectionGuard } = require('./security');
const { corsOptions, uploadsPathGuard, uploadsStaticOptions } = require('./security');
const { corsOptionsForRequest } = require('./security');

test('permite navegar desde el correo solo a las páginas públicas con enlace cifrado', () => {
  const headers = { origin: 'null', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' };
  for (const prefix of ['reporte-salida', 'reportes-salida']) {
    for (const action of ['aprobar', 'rechazar', 'aprobar-grupo', 'rechazar-grupo', 'documento', 'soporte', 'documento-grupo', 'soporte-grupo']) {
      corsOptionsForRequest({ method: 'GET', originalUrl: `/api/${prefix}/${action}/aaa.bbb.ccc`, headers }, (error, options) => {
        assert.equal(error, null); assert.equal(options.origin, true, action);
      });
    }
  }
  corsOptionsForRequest({ method: 'POST', originalUrl: '/api/reporte-salida/aprobar/aaa.bbb.ccc?via=jefe', headers: { ...headers, 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' } }, (_, options) => assert.equal(options.origin, true));
});

test('no abre CORS para API privadas, fetch, tokens mal formados o envíos que no son formularios', () => {
  const base = { method: 'GET', originalUrl: '/api/reporte-salida/aprobar/aaa.bbb.ccc', headers: { origin: 'null', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' } };
  for (const req of [
    { ...base, originalUrl: '/api/users' },
    { ...base, originalUrl: '/api/reporte-salida/solicitudes' },
    { ...base, originalUrl: '/api/reporte-salida/aprobar/no-es-token' },
    { ...base, headers: { ...base.headers, 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' } },
    { ...base, headers: { origin: 'null' } },
    { ...base, method: 'POST', headers: { ...base.headers, 'content-type': 'application/json' } },
    { ...base, method: 'DELETE' },
    { ...base, method: 'POST', originalUrl: '/api/reporte-salida/documento/aaa.bbb.ccc', headers: { ...base.headers, 'content-type': 'application/x-www-form-urlencoded' } }
  ]) corsOptionsForRequest(req, (_, options) => assert.equal(options, corsOptions));
  corsOptions.origin('null', (error) => {
    assert.equal(error.status, 403); assert.equal(error.code, 'CORS_ORIGIN_DENIED');
  });
});

test('impide publicar temporales, restauraciones, claves y respaldos por uploads', () => {
  for (const requestPath of ['/temp/export.xlsx', '/%74emp/export.xlsx', '/tmp/datos.csv', '/.restore-stage-123/database.dump', '/folder/.backup-cache/file.pdf', '/folder/../secret.pdf', '/folder%5ctemp/file.pdf', '/copia.siacbackup', '/kit.enc', '/clave.key', '/archivo.sha256', '/%ZZ']) {
    let continued = false;
    let status;
    const res = { status(code) { status = code; return this; }, json() {} };
    uploadsPathGuard({ path: requestPath }, res, () => { continued = true; });
    assert.equal(continued, false, requestPath);
    assert.ok([400, 404].includes(status), requestPath);
  }
  let continued = false;
  uploadsPathGuard({ path: '/evidencias/documento.pdf' }, {}, () => { continued = true; });
  assert.equal(continued, true);
});

test('los adjuntos no se almacenan en cache y se sirven con sandbox', () => {
  const headers = {};
  uploadsStaticOptions.setHeaders({ setHeader(name, value) { headers[name] = value; } });
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.match(headers['Content-Security-Policy'], /sandbox/);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
});

test('produccion no acepta localhost implicito ni origen opaco; desarrollo permite localhost', () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    for (const origin of ['null', 'http://localhost:43210', 'http://127.0.0.1:43210', 'https://untrusted.invalid']) {
      corsOptions.origin(origin, (error) => { assert.ok(error, origin); });
    }
    corsOptions.origin(undefined, (error, allowed) => { assert.equal(error, null); assert.equal(allowed, true); });
    process.env.NODE_ENV = 'development';
    corsOptions.origin('http://localhost:43210', (error, allowed) => { assert.equal(error, null); assert.equal(allowed, true); });
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
  }
});

const runSalidaGuard = (salida) => {
  let response = null;
  let continued = false;
  const req = {
    originalUrl: '/api/reporte-salida/solicitudes', method: 'POST',
    ip: '127.0.0.1', query: {}, params: {},
    body: { salida: { tipo: 'proyeccion_social', ...salida } }
  };
  const res = { status: (status) => ({ json: (payload) => { response = { status, payload }; } }) };
  sqlInjectionGuard(req, res, () => { continued = true; });
  return { response, continued };
};

test('permite direcciones y referencias con numeral en solicitudes de Proyeccion Social', () => {
  const result = runSalidaGuard({
    motivo: 'Proceso de articulación y capacitación, jornada #1',
    entidadDestino: 'VCV', alcance: 'Regional', municipio: 'Pasto',
    destinatarioDireccionEmail: 'Carrera 20 # 14-35'
  });
  assert.equal(result.continued, true);
  assert.equal(result.response, null);
});

test('mantiene el bloqueo de SQL y comentarios maliciosos en solicitudes de salida', () => {
  for (const motivo of ["' OR 1=1 # comentario", "admin' # comentario", '1=1#', 'UNION SELECT password FROM users', 'DROP TABLE users', 'valor -- comentario', 'valor /* comentario']) {
    const result = runSalidaGuard({ motivo });
    assert.equal(result.continued, false, motivo);
    assert.equal(result.response.status, 400, motivo);
  }
});

const runGuard = (originalUrl, signatureLength) => {
  const req = {
    originalUrl,
    query: {},
    params: { token: 'token-seguro' },
    body: { participant_id: '1', otp: '123456', signature_data: `data:image/png;base64,${'A'.repeat(signatureLength)}` },
    ip: '127.0.0.1',
    method: 'POST'
  };
  let response = null;
  let continued = false;
  const res = { status: (status) => ({ json: (payload) => { response = { status, payload }; return response; } }) };
  sqlInjectionGuard(req, res, () => { continued = true; });
  return { response, continued };
};

test('permite la imagen de firma del acta digital dentro del límite seguro', () => {
  const result = runGuard('/api/meeting-minutes/public/token-seguro/sign', 20000);
  assert.equal(result.continued, true);
  assert.equal(result.response, null);
});

test('mantiene el límite general para campos grandes en otras rutas', () => {
  const result = runGuard('/api/otra-ruta', 20000);
  assert.equal(result.continued, false);
  assert.equal(result.response.status, 413);
});

test('permite campos de texto enriquecido extensos en el borrador del acta de reunión', () => {
  const req = {
    originalUrl: '/api/meeting-minutes',
    query: {},
    params: {},
    body: {
      objetivo: '<p>' + 'A'.repeat(30000) + '</p>',
      desarrollo: '<p>' + 'B'.repeat(80000) + '</p>',
      conclusiones: '<p>' + 'C'.repeat(30000) + '</p>'
    },
    ip: '127.0.0.1',
    method: 'POST'
  };
  let response = null;
  let continued = false;
  const res = { status: (status) => ({ json: (payload) => { response = { status, payload }; return response; } }) };
  sqlInjectionGuard(req, res, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(response, null);
});

test('permite parámetros OAuth de Google Calendar que contienen secuencias aleatorias similares a patrones SQL', () => {
  const req = {
    originalUrl: '/api/meeting-minutes/calendar-connection/callback?code=4/0AY0e-g--testCode&state=crvT--6mxcklPZ9z.Hg8wFDJI7XzC-R3ob0rc-g.L38eP9BKhB4hYhTf-X5C478G3FV4sqUheX6bwobEBWz',
    query: {
      code: '4/0AY0e-g--testCode_random_data',
      state: 'crvT--6mxcklPZ9z.Hg8wFDJI7XzC-R3ob0rc-g.L38eP9BKhB4hYhTf-X5C478G3FV4sqUheX6bwobEBWz',
      scope: 'email openid https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy',
      prompt: 'consent'
    },
    params: {},
    body: {},
    ip: '127.0.0.1',
    method: 'GET'
  };
  let response = null;
  let continued = false;
  const res = { status: (status) => ({ json: (payload) => { response = { status, payload }; return response; } }) };
  sqlInjectionGuard(req, res, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(response, null);
});

test('bloquea parámetros OAuth excesivamente grandes en el callback de Calendar', () => {
  const req = {
    originalUrl: '/api/meeting-minutes/calendar-connection/callback',
    query: {
      code: 'A'.repeat(9000),
      state: 'normal-state'
    },
    params: {},
    body: {},
    ip: '127.0.0.1',
    method: 'GET'
  };
  let response = null;
  let continued = false;
  const res = { status: (status) => ({ json: (payload) => { response = { status, payload }; return response; } }) };
  sqlInjectionGuard(req, res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(response.status, 413);
});


