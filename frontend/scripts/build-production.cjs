const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const publicVariables = new Set([
  'REACT_APP_API_URL', 'REACT_APP_API_TIMEOUT_MS', 'REACT_APP_NAME', 'REACT_APP_VERSION',
  'REACT_APP_GOOGLE_CLIENT_ID', 'REACT_APP_TURNSTILE_SITE_KEY',
  'REACT_APP_ENABLE_REPORTE_SALIDA_FORM', 'REACT_APP_ENABLE_DESPLAZAMIENTO_VIATICOS',
  'REACT_APP_SESSION_IDLE_TIMEOUT_MS', 'REACT_APP_SESSION_MAX_AGE_MS'
]);

// CRA incorpora todas las variables REACT_APP_* al JavaScript publico.
const sources = [process.env];
for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  const filename = path.resolve(__dirname, '..', name);
  if (fs.existsSync(filename)) sources.push(dotenv.parse(fs.readFileSync(filename)));
}
const rejected = [...new Set(sources.flatMap((source) => Object.keys(source)
  .filter((name) => /^REACT_APP_/i.test(name) && !publicVariables.has(name))))];
if (rejected.length) {
  console.error('Variables no autorizadas para el navegador:', rejected.join(', '));
  process.exit(1);
}
process.env.GENERATE_SOURCEMAP = 'false';
process.env.NODE_ENV = 'production';
require('react-scripts/scripts/build');
