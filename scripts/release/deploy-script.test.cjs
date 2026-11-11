const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const bash = process.env.VALIDATION_BASH || 'C:/Users/adsolarte/AppData/Local/Programs/Git/bin/bash.exe';

const scenario = (flags = {}) => {
  const temporaryRoot = path.join(root, 'tmp');
  const work = fs.mkdtempSync(path.join(temporaryRoot, 'deploy-flow-test-'));
  try {
    const bin = path.join(work, 'bin'); fs.mkdirSync(bin);
    const log = path.join(work, 'commands.log');
    fs.writeFileSync(path.join(work, 'docker-compose.yml'), 'services: {}\n');
    fs.writeFileSync(path.join(bin, 'git'), `#!/usr/bin/env bash
printf 'git %s\\n' "$*" >> "$FLOW_LOG"
case "$1" in
 branch) echo main;;
 status) [[ "$MOCK_DIRTY" == 0 ]] || echo ' M tracked-file';;
 rev-parse) echo fixture-commit;;
esac
exit 0
`);
    fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
printf 'docker %s\\n' "$*" >> "$FLOW_LOG"
if [[ "$*" == 'compose images -q '* ]]; then echo sha256:fixture-image; fi
if [[ "$*" == 'compose build --pull' && "$MOCK_BUILD_FAIL" == 1 ]]; then exit 17; fi
if [[ "$*" == 'compose up '* && "$MOCK_HEALTH_FAIL" == 1 ]]; then exit 18; fi
exit 0
`);
    const env = { ...process.env, MOCK_DIRTY: '0', MOCK_BUILD_FAIL: '0', MOCK_HEALTH_FAIL: '0', ...flags, SIAC_PROJECT_DIR: work.replaceAll('\\', '/'), FLOW_LOG: log.replaceAll('\\', '/') };
    const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') || 'PATH';
    env[pathKey] = `${bin};${env[pathKey] || ''}`;
    const unix = (value) => value.replace(/^([A-Za-z]):[\\/]/, (_, drive) => `/${drive.toLowerCase()}/`).replaceAll('\\', '/');
    env.MOCK_BIN = unix(bin);
    env.DEPLOY_SCRIPT = unix(path.join(root, 'deploy.sh'));
    const result = spawnSync(bash, ['--noprofile', '--norc', '-c', 'export PATH="$MOCK_BIN:$PATH"; exec /usr/bin/bash --noprofile --norc "$DEPLOY_SCRIPT"'], { env, windowsHide: true, encoding: 'utf8', timeout: 30000 });
    if (result.error) throw result.error;
    return { status: result.status, commands: fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '', output: result.stdout + result.stderr };
  } finally {
    const target = path.resolve(work);
    if (!target.startsWith(`${path.resolve(temporaryRoot)}${path.sep}`) || !path.basename(target).startsWith('deploy-flow-test-')) throw new Error('Ruta temporal no permitida.');
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
};

test('construye y comprueba antes de sustituir contenedores; no usa down ni reset', () => {
  const result = scenario();
  assert.equal(result.status, 0, result.output);
  assert.ok(result.commands.indexOf('compose build --pull') < result.commands.indexOf('compose up -d'));
  assert.ok(result.commands.indexOf('productionPreflight.js --database') < result.commands.indexOf('compose up -d'));
  assert.doesNotMatch(result.commands, /compose down|reset --hard/);
  assert.match(result.commands, /merge --ff-only/);
});
test('un fallo al construir mantiene los contenedores anteriores', () => {
  const result = scenario({ MOCK_BUILD_FAIL: '1' });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.commands, /compose up|compose down/);
});
test('un fallo de salud intenta volver a imagenes anteriores sin restaurar datos', () => {
  const result = scenario({ MOCK_HEALTH_FAIL: '1' });
  assert.notEqual(result.status, 0);
  assert.match(result.commands, /docker compose --project-directory .*docker-compose\.previous\.yml.*rollback-images\.yml.*up -d/);
  assert.doesNotMatch(result.commands, /pg_restore|run migrate/);
});
test('rechaza cambios locales antes de descargar codigo o construir', () => {
  const result = scenario({ MOCK_DIRTY: '1' });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.commands, /git fetch|compose build|compose up/);
});
