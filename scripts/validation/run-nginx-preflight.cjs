const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '../..');
const temporaryRoot = path.join(root, 'tmp');
const work = fs.mkdtempSync(path.join(temporaryRoot, 'nginx-preflight-'));
const run = (executable, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; let error = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { error += chunk; });
  child.on('error', reject);
  child.on(options.resolveOnExit ? 'exit' : 'close', (code) => code === 0 ? resolve(output) : reject(new Error(error)));
});
const port = () => new Promise((resolve) => {
  const server = net.createServer();
  server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => resolve(value)); });
});
// Este preflight prueba Nginx y el navegador; el backend completo se prueba
// separadamente en validate-release.cjs sobre la base restaurada.
const server = http.createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.statusCode = request.url === '/api/health' ? 200 : 404;
  response.end('{}');
});
(async () => {
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    await require('./nginx-validation.cjs')({ root, work, backendPort: server.address().port, port, run, check: (name) => console.log(`Preflight: ${name}`) });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    const target = path.resolve(work);
    if (!target.startsWith(`${path.resolve(temporaryRoot)}${path.sep}`) || !path.basename(target).startsWith('nginx-preflight-')) throw new Error('Ruta temporal no permitida.');
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
})();
