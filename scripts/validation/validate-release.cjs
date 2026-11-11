const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const assert = require('assert/strict');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '../..');
const temporaryRoot = path.join(root, 'tmp');
const evidence = path.join(temporaryRoot, 'release-validation');
fs.mkdirSync(evidence, { recursive: true });
const work = fs.mkdtempSync(path.join(temporaryRoot, 'release-isolated-'));
const pgBin = process.env.VALIDATION_PG_BIN || 'C:/Program Files/PostgreSQL/18/bin';
const backup = process.argv[2];
if (!backup || !fs.existsSync(backup)) throw new Error('Indique un respaldo local existente; no se descarga del servidor.');
const summary = { startedAt: new Date().toISOString(), node: process.version, postgres: null, checks: [], externalProviders: 'simulated', productionTouched: false, disposableFastCluster: process.env.VALIDATION_FAST_CLUSTER === 'true' };
let application;
let pgStarted = false;
let db;
let currentStep = '';
const check = (name, details = {}) => { summary.checks.push({ name, passed: true, completedAt: new Date().toISOString(), ...details }); console.log(`OK: ${name}`); };
const run = (executable, args, options = {}) => new Promise((resolve, reject) => {
  const { resolveOnExit = false, ...spawnOptions } = options;
  const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...spawnOptions });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject);
  child.on(resolveOnExit ? 'exit' : 'close', (code) => code === 0 ? resolve(stdout) : reject(Object.assign(new Error('Fallo de herramienta local.'), { privateDetail: stderr, code })));
});
const port = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.on('error', reject);
  server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => resolve(value)); });
});
const waitFor = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const safeRemoveWork = () => {
  const target = path.resolve(work);
  if (!target.startsWith(`${path.resolve(temporaryRoot)}${path.sep}`) || !path.basename(target).startsWith('release-isolated-')) throw new Error('Destino temporal no permitido.');
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
};
const request = async (base, url, { token, timeoutMs = 20000, ...options } = {}) => {
  const response = await fetch(`${base}${url}`, { ...options, signal: AbortSignal.timeout(timeoutMs), headers: {
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers
  } });
  const content = await response.text();
  let json; try { json = JSON.parse(content); } catch (_) {}
  return { response, content, json };
};
// http.request evita el limite de cabeceras de cinco minutos de fetch/undici
// y transmite desde disco, sin cargar un respaldo grande completo en memoria.
const restoreOverHttp = (base, token, filename) => new Promise((resolve, reject) => {
  const boundary = `validation-${crypto.randomBytes(16).toString('hex')}`;
  const prefix = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="googleCredential"\r\n\r\nfixture-admin\r\n--${boundary}\r\nContent-Disposition: form-data; name="turnstileToken"\r\n\r\nfixture-challenge\r\n--${boundary}\r\nContent-Disposition: form-data; name="backup"; filename="fixture.siacbackup"\r\nContent-Type: application/octet-stream\r\n\r\n`);
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  const url = new URL('/api/planeacion/gestion-informacion/database/restore-dump', base);
  const call = http.request(url, { method: 'POST', headers: {
    Authorization: `Bearer ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': prefix.length + fs.statSync(filename).size + suffix.length
  } }, (response) => {
    let content = '';
    response.setEncoding('utf8'); response.on('data', (chunk) => { content += chunk; });
    response.on('end', () => {
      try { resolve({ status: response.statusCode, json: JSON.parse(content) }); }
      catch (_) { reject(new Error('La restauracion no devolvio una respuesta JSON valida.')); }
    });
    response.on('error', reject);
  });
  call.setTimeout(20 * 60 * 1000, () => call.destroy(new Error('La restauracion excedio el tiempo de la prueba.')));
  call.on('error', reject);
  call.write(prefix);
  const input = fs.createReadStream(filename, { highWaterMark: 1024 * 1024 });
  input.on('error', (error) => call.destroy(error));
  input.on('end', () => call.end(suffix));
  input.pipe(call, { end: false });
});

(async () => {
  try {
    currentStep = 'crear cluster PostgreSQL aislado';
    const databasePort = await port();
    const applicationPort = await port();
    const data = path.join(work, 'database');
    await run(path.join(pgBin, 'initdb.exe'), ['-D', data, '-U', 'validation_admin', '-A', 'trust', '--locale=C', '--encoding=UTF8']);
    const fastOptions = summary.disposableFastCluster ? ' -c fsync=off -c synchronous_commit=off -c full_page_writes=off -c wal_level=minimal -c max_wal_senders=0' : '';
    await run(path.join(pgBin, 'pg_ctl.exe'), ['-D', data, '-l', path.join(work, 'postgres.log'), '-o', `-p ${databasePort} -h 127.0.0.1${fastOptions}`, '-w', 'start'], { resolveOnExit: true });
    pgStarted = true;
    const psql = (sql) => run(path.join(pgBin, 'psql.exe'), ['-h', '127.0.0.1', '-p', String(databasePort), '-U', 'validation_admin', '-d', 'validation_db', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql]);
    await run(path.join(pgBin, 'psql.exe'), ['-h', '127.0.0.1', '-p', String(databasePort), '-U', 'validation_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', 'CREATE DATABASE validation_db']);
    // Los roles globales no forman parte de pg_dump. El kit reconstruye el rol
    // de PostgreSQL; aqui solo se reproduce su identidad, sin acceso ni clave.
    await psql('CREATE ROLE postgres NOLOGIN');
    summary.postgres = (await psql('SHOW server_version')).trim();
    check('PostgreSQL temporal en loopback');

    // Se anulan las claves del entorno privado antes de importar codigo del aplicativo.
    const dotenv = require(path.join(root, 'backend/node_modules/dotenv'));
    for (const relative of ['.env', '.env.local', 'backend/.env', 'backend/.env.local']) {
      const filename = path.join(root, relative);
      if (fs.existsSync(filename)) for (const key of Object.keys(dotenv.parse(fs.readFileSync(filename)))) process.env[key] = '';
    }
    const uploads = path.join(work, 'uploads');
    fs.mkdirSync(uploads);
    Object.assign(process.env, {
      NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: String(databasePort), DB_USER: 'validation_admin', DB_PASSWORD: '', DB_NAME: 'validation_db',
      JWT_SECRET: crypto.randomBytes(48).toString('hex'), JWT_EXPIRE: '15m', URL_TOKEN_SECRET: crypto.randomBytes(48).toString('hex'),
      PORT: String(applicationPort), PORT_RETRY_ATTEMPTS: '0', FRONTEND_URL: 'https://validation.invalid', PUBLIC_APP_URL: 'https://validation.invalid',
      GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com', GOOGLE_SERVICE_ACCOUNT_JSON: path.join(work, 'missing-service-account.json'),
      INSTITUTIONAL_EMAIL_DOMAIN: 'example.invalid', AUTH_GOOGLE_ONLY: 'true', EMAIL_DELIVERY_ENABLED: 'false',
      SIAC_AUTOMATIC_BACKUP_ENABLED: 'false', SIAC_PEI_SYNC_WORKER_ENABLED: 'false', PESV_AUTOMATIC_NOTIFICATIONS_ENABLED: 'false',
      LEGALIZACION_AUTOMATIC_NOTIFICATIONS_ENABLED: 'false', SIAC_UPLOADS_DIR: uploads, PRIVATE_UPLOADS_ROOT: path.join(uploads, '.private'),
      SIAC_BACKUP_STORAGE_DIR: path.join(work, 'generated-backups'), DATABASE_RESTORE_TMP_DIR: path.join(uploads, 'temp'), SABER_PRO_PYTHON_URL: 'http://127.0.0.1:1', CONTEXTO_EXTERNO_PYTHON_URL: 'http://127.0.0.1:1',
      PG_DUMP_PATH: path.join(pgBin, 'pg_dump.exe'), PG_RESTORE_PATH: path.join(pgBin, 'pg_restore.exe'),
      SIAC_ISOLATED_VALIDATION: 'true', VALIDATION_ADMIN_EMAIL: 'validation-admin@example.invalid', VALIDATION_READER_EMAIL: 'validation-reader@example.invalid'
    });
    currentStep = 'validar y restaurar copia real local';
    const integral = require(path.join(root, 'backend/src/services/integralBackupService'));
    const extracted = await integral.extractIntegralBundle(path.resolve(backup), path.join(work, 'extracted'), { pgRestorePath: path.join(pgBin, 'pg_restore.exe') });
    await run(path.join(pgBin, 'pg_restore.exe'), ['--no-owner', '--no-privileges', '--exit-on-error', '--single-transaction', '-h', '127.0.0.1', '-p', String(databasePort), '-U', 'validation_admin', '-d', 'validation_db', extracted.dumpPath]);
    const tableCount = Number((await psql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).trim());
    assert.ok(tableCount > 0);
    await run('tar', ['-xzf', extracted.uploadsArchive, '-C', uploads]);
    let restoredFiles = 0;
    const countFiles = (directory) => { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) countFiles(filename); else { assert.ok(entry.isFile()); fs.accessSync(filename, fs.constants.R_OK); restoredFiles++; }
    } };
    countFiles(uploads);
    check('Restauracion real de base y adjuntos', { tables: tableCount, files: restoredFiles, backupCreatedAt: extracted.manifest.createdAt });

    currentStep = 'preparar usuarios ficticios e iniciar backend Node 24';
    const models = require(path.join(root, 'backend/src/models'));
    db = require(path.join(root, 'backend/src/config/database')).sequelize;
    fs.mkdirSync(process.env.DATABASE_RESTORE_TMP_DIR, { recursive: true });
    for (const [email, role] of [[process.env.VALIDATION_ADMIN_EMAIL, 'administrador'], [process.env.VALIDATION_READER_EMAIL, 'consulta']]) {
      await models.User.create({ nombre: 'Validacion aislada', email, username: `fixture-${role}-${crypto.randomUUID()}`, password: crypto.randomBytes(32).toString('hex'), role, estado: 'activo' });
    }
    const appLog = fs.openSync(path.join(evidence, 'isolated-backend.log'), 'w');
    application = spawn(process.execPath, [path.join(__dirname, 'isolated-server-preload.cjs')], { cwd: path.join(root, 'backend'), env: process.env, windowsHide: true, stdio: ['ignore', appLog, appLog] });
    fs.closeSync(appLog);
    const base = `http://127.0.0.1:${applicationPort}`;
    let healthy = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      if (application.exitCode !== null) break;
      try { healthy = (await request(base, '/api/health')).response.status === 200; } catch (_) {}
      if (healthy) break;
      await waitFor(1000);
    }
    assert.ok(healthy, 'El backend aislado no alcanzo estado saludable.');
    check('Inicio real del backend con Node 24 y base restaurada');

    currentStep = 'validar Nginx y HTTPS contra backend real';
    await require('./nginx-validation.cjs')({ root, work, backendPort: applicationPort, port, run, check });

    currentStep = 'validar autenticacion y permisos HTTP';
    const login = async (credential, challenge = 'fixture-challenge') => request(base, '/api/auth/google', { method: 'POST', body: JSON.stringify({ credential, turnstileToken: challenge }) });
    assert.equal((await request(base, '/api/auth/profile')).response.status, 401);
    assert.equal((await login('fixture-admin', 'wrong-challenge')).response.status, 403);
    assert.equal((await login('fixture-external')).response.status, 403);
    const adminLogin = await login('fixture-admin');
    assert.equal(adminLogin.response.status, 200);
    const adminToken = adminLogin.json.data.token;
    assert.equal((await request(base, '/api/auth/profile', { token: adminToken })).response.status, 200);
    assert.equal((await request(base, '/api/auth/profile', { token: `${adminToken}invalid` })).response.status, 401);
    const readerLogin = await login('fixture-reader');
    assert.equal(readerLogin.response.status, 200);
    const forbidden = await request(base, '/api/planeacion/gestion-informacion/database/backup-monitor/run', { token: readerLogin.json.data.token, method: 'POST', body: '{}' });
    assert.equal(forbidden.response.status, 403);
    check('Login, JWT, rechazo de dominio ajeno y permisos con proveedores simulados');

    currentStep = 'validar documentos y rutas sensibles';
    assert.equal((await request(base, '/api/documentos')).response.status, 401);
    const documents = await request(base, '/api/documentos', { token: adminToken });
    assert.equal(documents.response.status, 200);
    const findPdf = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || ['temp', 'tmp'].includes(entry.name)) continue;
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) { const found = findPdf(filename); if (found) return found; }
        else if (/\.pdf$/i.test(entry.name)) return filename;
      }
      return null;
    };
    const pdf = findPdf(uploads);
    assert.ok(pdf, 'El respaldo no contiene un PDF ordinario para la prueba de descarga.');
    const pdfUrl = `/uploads/${path.relative(uploads, pdf).split(path.sep).map(encodeURIComponent).join('/')}`;
    const pdfResponse = await fetch(`${base}${pdfUrl}`, { headers: { Authorization: `Bearer ${adminToken}` }, signal: AbortSignal.timeout(30000) });
    assert.equal(pdfResponse.status, 200);
    const pdfBytes = Buffer.from(await pdfResponse.arrayBuffer());
    assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF');
    assert.equal(crypto.createHash('sha256').update(pdfBytes).digest('hex'), await integral.sha256File(pdf));
    check('Descarga HTTP de PDF restaurado con contenido y SHA-256 coincidentes');
    for (const url of ['/uploads/temp/fixture.csv', '/api/uploads/temp/fixture.csv', '/uploads/.private/fixture.pdf', '/uploads/fixture.siacbackup', '/api/.env']) {
      assert.ok([403, 404].includes((await request(base, url)).response.status), url);
    }
    check('Consulta autenticada de documentos y bloqueo de temporales/archivos privados');

    currentStep = 'validar importacion y exportacion XLSX';
    const XLSX = require(path.join(root, 'backend/node_modules/xlsx'));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ codigo: 'fixture-1', cantidad: 7 }]), 'Validacion');
    const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const reread = XLSX.read(bytes, { type: 'buffer' });
    assert.deepEqual(XLSX.utils.sheet_to_json(reread.Sheets.Validacion), [{ codigo: 'fixture-1', cantidad: 7 }]);
    const ExcelJS = require(path.join(root, 'backend/node_modules/exceljs'));
    const excelWorkbook = new ExcelJS.Workbook();
    await excelWorkbook.xlsx.load(bytes);
    assert.equal(excelWorkbook.getWorksheet('Validacion').getCell('B2').value, 7);
    check('Lectura/escritura interoperable XLSX con SheetJS y ExcelJS');
    const templateResponse = await fetch(`${base}/api/planeacion/gestion-informacion/template?categoria=${encodeURIComponent('Infraestructura Física')}`, {
      headers: { Authorization: `Bearer ${adminToken}` }, signal: AbortSignal.timeout(30000)
    });
    assert.equal(templateResponse.status, 200);
    const template = XLSX.read(Buffer.from(await templateResponse.arrayBuffer()), { type: 'buffer' });
    assert.ok(template.SheetNames.length > 0);
    const rejectedImport = new FormData();
    rejectedImport.append('categoria', 'Infraestructura Física');
    rejectedImport.append('file', new Blob(['invalid-file']), 'fixture.exe');
    const rejection = await request(base, '/api/planeacion/gestion-informacion/import', { token: adminToken, method: 'POST', body: rejectedImport });
    assert.ok([400, 415].includes(rejection.response.status));
    check('Plantilla XLSX por API y rechazo de archivo no permitido al importar');

    currentStep = 'validar correo sin envio externo';
    const nodemailer = require(path.join(root, 'backend/node_modules/nodemailer'));
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix', disableFileAccess: true, disableUrlAccess: true });
    const mail = await transport.sendMail({ from: 'sender@example.invalid', to: 'recipient@example.invalid', subject: 'Validacion aislada', text: 'Contenido de prueba', attachments: [{ filename: 'fixture.xlsx', content: bytes }] });
    assert.ok(Buffer.isBuffer(mail.message));
    assert.match(mail.message.toString(), /multipart\/mixed/);
    assert.match(mail.message.toString(), /fixture.xlsx/);
    check('Generacion MIME real con Nodemailer 10 y adjunto; sin entrega externa');

    currentStep = 'generar copia de nuevas tablas, datos y archivos';
    const marker = crypto.randomUUID();
    await db.query('CREATE TABLE public.validation_new_table (id integer PRIMARY KEY, marker text NOT NULL)');
    await db.query('INSERT INTO public.validation_new_table (id, marker) VALUES (1, :marker)', { replacements: { marker } });
    fs.writeFileSync(path.join(uploads, 'validation-fixture.txt'), marker);
    const scheduler = require(path.join(root, 'backend/src/services/databaseBackupScheduler'));
    const generated = await scheduler.executeBackup({ trigger: 'manual' });
    assert.equal(generated.status, 'completed');
    const generatedPath = scheduler.getBackupFilePath(generated.file_name);
    assert.ok(fs.existsSync(`${generatedPath}.sha256`));
    check('Generacion real de copia integral con tabla, datos y archivo nuevos');

    currentStep = 'restaurar por API y comprobar recuperacion de cambios';
    await db.query("UPDATE public.validation_new_table SET marker = 'modified' WHERE id = 1");
    fs.writeFileSync(path.join(uploads, 'validation-fixture.txt'), 'modified');
    const restored = await restoreOverHttp(base, adminToken, generatedPath);
    if (restored.status !== 200) fs.writeFileSync(path.join(evidence, 'restore-response.json'), JSON.stringify(restored));
    assert.equal(restored.status, 200, 'La API no completo la restauracion.');
    assert.equal(restored.json.success, true);
    const [rows] = await db.query('SELECT marker FROM public.validation_new_table WHERE id = 1');
    assert.equal(rows[0].marker, marker);
    assert.equal(fs.readFileSync(path.join(uploads, 'validation-fixture.txt'), 'utf8'), marker);
    check('Restauracion integral por API y recuperacion de tabla, dato y archivo nuevos');
    summary.passed = true;
  } catch (error) {
    summary.passed = false;
    summary.failedStep = currentStep;
    summary.failure = error.message;
    summary.failureCode = error.cause?.code || error.code || null;
    if (error.privateDetail) fs.writeFileSync(path.join(evidence, 'private-tool-error.log'), error.privateDetail);
    console.error(`FALLO: ${currentStep}. Detalle privado conservado localmente.`);
    process.exitCode = 1;
  } finally {
    if (application && application.exitCode === null) { application.kill(); await Promise.race([new Promise((resolve) => application.once('close', resolve)), waitFor(10000)]); }
    if (db) await db.close().catch(() => {});
    let stopped = !pgStarted;
    if (pgStarted) {
      try { await run(path.join(pgBin, 'pg_ctl.exe'), ['-D', path.join(work, 'database'), '-w', '-m', 'fast', 'stop'], { resolveOnExit: true }); stopped = true; }
      catch (_) { summary.cleanupWarning = 'No se pudo detener el cluster temporal; se conserva su directorio.'; }
    }
    if (stopped) { safeRemoveWork(); summary.temporaryDataRemoved = true; }
    summary.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(evidence, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`Resultado: ${summary.passed ? 'APROBADO' : 'REQUIERE CORRECCION'}`);
  }
})();
