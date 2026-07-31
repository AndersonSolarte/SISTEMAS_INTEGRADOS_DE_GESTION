const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const FORMAT = 'siac-integral-backup';
const FORMAT_VERSION = 1;
const BUNDLE_FILES = ['manifest.json', 'database.dump', 'uploads.tar.gz'];
const UPLOADS_ROOT = path.resolve(process.env.SIAC_UPLOADS_DIR || path.join(process.cwd(), 'uploads'));

const runCommand = (executable, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(executable, args, {
    windowsHide: true,
    ...options,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) resolve({ stdout, stderr });
    else reject(new Error(stderr || `${executable} finalizo con codigo ${code}`));
  });
});

const sha256File = (filePath) => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const input = fs.createReadStream(filePath);
  input.on('error', reject);
  input.on('data', (chunk) => hash.update(chunk));
  input.on('end', () => resolve(hash.digest('hex')));
});

const normalizeArchiveEntry = (entry) => String(entry || '').replace(/^\.\//, '').replace(/\/$/, '');

const assertSafeArchiveEntries = (entries, { outer = false } = {}) => {
  const normalized = entries.map(normalizeArchiveEntry).filter(Boolean);
  normalized.forEach((entry) => {
    if (
      path.posix.isAbsolute(entry)
      || entry.includes('\\')
      || entry.split('/').some((segment) => segment === '..')
      || entry.includes('\0')
    ) {
      throw new Error('El paquete contiene una ruta no permitida.');
    }
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('El paquete contiene rutas duplicadas.');
  }
  if (outer) {
    const unexpected = normalized.filter((entry) => !BUNDLE_FILES.includes(entry));
    const missing = BUNDLE_FILES.filter((entry) => !normalized.includes(entry));
    if (unexpected.length || missing.length || normalized.length !== BUNDLE_FILES.length) {
      throw new Error('La estructura del paquete integral no es valida.');
    }
  }
  return normalized;
};

const assertSafeArchiveTypes = async (archivePath, compressed = false) => {
  const result = await runCommand('tar', [compressed ? '-tvzf' : '-tvf', archivePath]);
  const invalid = result.stdout.split(/\r?\n/).filter(Boolean).find((line) => !['-', 'd'].includes(line[0]));
  if (invalid) throw new Error('El paquete contiene enlaces o tipos de archivo no permitidos.');
};

const listArchive = async (archivePath, compressed = false) => {
  const result = await runCommand('tar', [compressed ? '-tzf' : '-tf', archivePath]);
  return result.stdout.split(/\r?\n/).filter(Boolean);
};

const verifyDumpSignature = (dumpPath) => {
  const signature = Buffer.alloc(5);
  const handle = fs.openSync(dumpPath, 'r');
  try { fs.readSync(handle, signature, 0, 5, 0); } finally { fs.closeSync(handle); }
  if (signature.toString('ascii') !== 'PGDMP') {
    throw new Error('La base incluida no tiene una firma PostgreSQL valida.');
  }
};

const createIntegralBundle = async ({ dumpPath, bundlePath, workDirectory, createdAt, databaseName, pgRestorePath }) => {
  fs.mkdirSync(workDirectory, { recursive: true, mode: 0o700 });
  const bundledDump = path.join(workDirectory, 'database.dump');
  const uploadsArchive = path.join(workDirectory, 'uploads.tar.gz');
  const manifestPath = path.join(workDirectory, 'manifest.json');

  try {
    try { fs.linkSync(dumpPath, bundledDump); } catch (_error) { fs.copyFileSync(dumpPath, bundledDump); }
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true, mode: 0o700 });
    await runCommand('tar', [
      '-czf', uploadsArchive,
      '--exclude=./temp', '--exclude=./.restore-*', '--exclude=./.backup-*',
      '-C', UPLOADS_ROOT, '.'
    ]);

    const uploadEntries = assertSafeArchiveEntries(await listArchive(uploadsArchive, true));
    const [databaseSha256, uploadsSha256] = await Promise.all([
      sha256File(bundledDump),
      sha256File(uploadsArchive)
    ]);
    const databaseStats = fs.statSync(bundledDump);
    const uploadStats = fs.statSync(uploadsArchive);
    const manifest = {
      format: FORMAT,
      version: FORMAT_VERSION,
      createdAt: new Date(createdAt || Date.now()).toISOString(),
      database: {
        name: String(databaseName || ''),
        file: 'database.dump',
        sizeBytes: databaseStats.size,
        sha256: databaseSha256
      },
      uploads: {
        file: 'uploads.tar.gz',
        sizeBytes: uploadStats.size,
        sha256: uploadsSha256,
        entries: uploadEntries.length,
        excluded: ['temp', '.restore-*', '.backup-*']
      },
      recovery: {
        codeSource: 'git',
        release: String(process.env.SIAC_RELEASE_COMMIT || process.env.REACT_APP_VERSION || 'main'),
        privateConfiguration: 'external-encrypted-recovery-kit'
      }
    };
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

    const partialBundle = `${bundlePath}.partial`;
    await runCommand('tar', ['-cf', partialBundle, '-C', workDirectory, ...BUNDLE_FILES]);
    await validateIntegralBundle(partialBundle, { pgRestorePath });
    fs.renameSync(partialBundle, bundlePath);
    fs.chmodSync(bundlePath, 0o600);
    return { manifest, sizeBytes: fs.statSync(bundlePath).size };
  } finally {
    fs.rmSync(workDirectory, { recursive: true, force: true });
    if (fs.existsSync(`${bundlePath}.partial`)) fs.rmSync(`${bundlePath}.partial`, { force: true });
  }
};

const extractIntegralBundle = async (bundlePath, destination, { pgRestorePath } = {}) => {
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  await assertSafeArchiveTypes(bundlePath);
  const outerEntries = assertSafeArchiveEntries(await listArchive(bundlePath), { outer: true });
  if (!outerEntries.length) throw new Error('El paquete integral esta vacio.');
  await runCommand('tar', ['-xf', bundlePath, '--no-same-owner', '--no-same-permissions', '-C', destination]);

  const manifestPath = path.join(destination, 'manifest.json');
  const dumpPath = path.join(destination, 'database.dump');
  const uploadsArchive = path.join(destination, 'uploads.tar.gz');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.format !== FORMAT || Number(manifest.version) !== FORMAT_VERSION) {
    throw new Error('La version del paquete integral no es compatible.');
  }
  const [databaseSha256, uploadsSha256] = await Promise.all([
    sha256File(dumpPath),
    sha256File(uploadsArchive)
  ]);
  if (databaseSha256 !== manifest.database?.sha256 || uploadsSha256 !== manifest.uploads?.sha256) {
    throw new Error('La huella de integridad del paquete no coincide.');
  }
  verifyDumpSignature(dumpPath);
  if (pgRestorePath) await runCommand(pgRestorePath, ['--list', dumpPath]);
  await assertSafeArchiveTypes(uploadsArchive, true);
  assertSafeArchiveEntries(await listArchive(uploadsArchive, true));
  return { manifest, dumpPath, uploadsArchive };
};

const validateIntegralBundle = async (bundlePath, options = {}) => {
  const validationDirectory = path.join(path.dirname(bundlePath), `.backup-validation-${crypto.randomUUID()}`);
  try {
    return await extractIntegralBundle(bundlePath, validationDirectory, options);
  } finally {
    fs.rmSync(validationDirectory, { recursive: true, force: true });
  }
};

module.exports = {
  FORMAT,
  FORMAT_VERSION,
  UPLOADS_ROOT,
  runCommand,
  sha256File,
  createIntegralBundle,
  extractIntegralBundle,
  validateIntegralBundle,
  assertSafeArchiveEntries
};
