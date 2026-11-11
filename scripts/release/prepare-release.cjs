const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const evidence = path.join(root, 'tmp/release-validation');
const readText = (filename) => {
  const bytes = fs.readFileSync(filename);
  return (bytes[0] === 255 && bytes[1] === 254 ? bytes.subarray(2).toString('utf16le') : bytes.toString('utf8')).replace(/^\uFEFF/, '');
};
const readJson = (name) => JSON.parse(readText(path.join(evidence, name)));
const hash = (filename) => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
const nodeTests = (name) => {
  const text = readText(path.join(evidence, name));
  const total = Number(text.match(/\btests\s+(\d+)\s*(?:\r?\n|$)/i)?.[1]);
  assert.ok(total > 0 && /\bfail\s+0\s*(?:\r?\n|$)/i.test(text), `Pruebas pendientes o fallidas: ${name}`);
  return total;
};

const backendTests = nodeTests('backend-node24-tests.log');
const regressions = nodeTests('release-regressions.log');
assert.ok(regressions >= 12);
const frontLog = readText(path.join(evidence, 'frontend-node24-tests.log'));
const frontCounts = frontLog.match(/Tests:\s+(\d+) passed,\s+(\d+) total/);
assert.ok(frontCounts && frontCounts[1] === frontCounts[2], 'Faltan pruebas frontend aprobadas.');
const pythonLog = readText(path.join(evidence, 'python-tests.log'));
assert.match(pythonLog, /Ran 4 tests/); assert.match(pythonLog, /\bOK\b/);
const recovery = readJson('summary.json');
assert.equal(recovery.passed, true); assert.equal(recovery.temporaryDataRemoved, true);
const browser = readJson('browser-csp.json'); assert.equal(browser.passed, true);
const kit = readJson('recovery-kit.json'); assert.equal(kit.Passed, true); assert.equal(kit.TemporaryPlaintextRemoved, true);
for (const project of ['backend', 'frontend']) {
  const audit = readJson(`${project}-production-audit.json`);
  assert.ok(!audit.error && audit.metadata?.vulnerabilities?.total === 0, `Auditoria de produccion pendiente: ${project}`);
}

const baseCommit = git('rev-parse', 'HEAD');
const id = `siac-candidate-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-${baseCommit.slice(0, 8)}`;
const output = path.join(root, 'tmp/production-release', id);
const stage = path.join(output, 'source');
const directories = ['backend/src/', 'backend/templates/', 'backend/migrations/', 'backend/sql/', 'frontend/src/', 'frontend/public/', 'frontend/scripts/', 'python-service/app/', 'scripts/backup/', 'scripts/security/'];
const exact = new Set(['.gitignore', '.dockerignore', '.env.server.example', '.env.docker.example', 'docker-compose.yml', 'deploy.sh', 'package.json', 'package-lock.json',
  'backend/Dockerfile', 'backend/.dockerignore', 'backend/package.json', 'backend/package-lock.json', 'backend/.env.example',
  'frontend/Dockerfile', 'frontend/.dockerignore', 'frontend/package.json', 'frontend/package-lock.json', 'frontend/.env.example', 'frontend/.env.production', 'frontend/nginx.conf', 'frontend/security-headers.conf',
  'python-service/Dockerfile', 'python-service/.dockerignore', 'python-service/requirements.txt', 'data_DIVIPOLA_Municipios.xlsx', 'plantilla_PLAN_DE_ACCION.xlsx', 'docs/ENTREGA_PRODUCCION.md']);
const candidates = execFileSync('git', ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8', windowsHide: true }).split('\0').filter(Boolean);
const selected = [...new Set(candidates)].filter((name) => exact.has(name) || directories.some((directory) => name.startsWith(directory)))
  .filter((name) => !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name)).sort();
assert.ok(selected.length > 100, 'Inventario de entrega incompleto.');
fs.mkdirSync(stage, { recursive: true });
const files = [];
for (const name of selected) {
  assert.ok(!name.startsWith('/') && !name.split('/').includes('..') && !name.includes('\\'), 'Ruta no permitida.');
  const filename = path.join(root, name);
  if (!fs.existsSync(filename)) continue;
  assert.ok(fs.lstatSync(filename).isFile(), 'La entrega no admite enlaces de archivo.');
  assert.ok(!/\.(pem|key|p12|pfx|dump|siacbackup|enc|log|bak|old|map)$/i.test(name), 'Archivo privado no publicable.');
  assert.ok(!/(^|\/)(uploads|uploads_private|node_modules|\.git|\.deployment-state)(\/|$)/.test(name), 'Directorio privado no publicable.');
  assert.ok(!/(^|\/)\.env(?:\.|$)/.test(name) || exact.has(name), 'Configuracion privada no permitida.');
  const destination = path.join(stage, name);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(filename, destination);
  const sha256 = hash(destination);
  assert.equal(hash(filename), sha256, 'El origen cambio durante la preparacion.');
  files.push({ path: name, sha256, bytes: fs.statSync(destination).size });
}
assert.equal(git('rev-parse', 'HEAD'), baseCommit, 'Main cambio durante la preparacion. Repita las comprobaciones.');
const manifest = {
  id, createdAt: new Date().toISOString(), baseCommit, includesUncommittedChanges: true,
  status: 'candidate-tested-locally', productionApproved: false, productionTouched: false,
  tests: { backend: backendTests, frontend: Number(frontCounts[1]), python: 4, deploymentSimulation: 4 },
  runtimeDependencyAudits: 'zero-known-advisories', functionalRecoveryReference: recovery.finishedAt,
  recoveryReferenceScope: 'Ensayo funcional anterior; no sustituye pruebas de las imagenes Linux de esta entrega.',
  pending: ['Construccion y ejecucion de imagenes Linux', 'Google/Turnstile y SMTP reales en preproduccion', '19 avisos de herramientas de desarrollo (6 altos)'],
  sourceTreeSha256: crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex'), files
};
fs.writeFileSync(path.join(stage, 'RELEASE-MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const archive = path.join(output, `${id}.tar.gz`);
execFileSync('tar', ['-czf', archive, '-C', stage, '.'], { windowsHide: true });
const archiveEntries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8', windowsHide: true }).split(/\r?\n/).filter(Boolean);
assert.ok(archiveEntries.includes('./RELEASE-MANIFEST.json'));
assert.ok(!archiveEntries.some((name) => /\.(pem|key|dump|siacbackup|enc|map)$/.test(name)));
const checksum = hash(archive);
fs.writeFileSync(`${archive}.sha256`, `${checksum}  ${path.basename(archive)}\n`);
fs.writeFileSync(path.join(output, 'RELEASE-MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(root, 'tmp/production-release/LATEST.json'), `${JSON.stringify({ id, archive: path.relative(root, archive).replaceAll('\\', '/'), manifest: path.relative(root, path.join(output, 'RELEASE-MANIFEST.json')).replaceAll('\\', '/'), sha256: checksum, productionApproved: false }, null, 2)}\n`);
console.log(`Entrega preparada: ${path.relative(root, archive)}`);
console.log(`Archivos: ${files.length}. SHA-256: ${checksum}`);
console.log('Estado: candidato validado localmente; sin push ni despliegue.');
