const fs = require('fs');
const path = require('path');

const WORKSPACE_ROOT = path.resolve(__dirname, '../../..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'build', 'dist', 'coverage', 'backups', 'tmp_docx_inspect']);
const TEXT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.env', '.example', '.yml', '.yaml', '.dockerfile', '.md', '.css']);
const SECRET_PATTERNS = [
  /(api[_-]?key|secret|token|password|private[_-]?key)\s*[:=]\s*['"]?([A-Za-z0-9_\-./+=]{16,})/i,
  /-----BEGIN (RSA |EC |OPENSSH |)?PRIVATE KEY-----/i,
  /(AIza[0-9A-Za-z\-_]{20,})/,
  /(sk-[A-Za-z0-9]{20,})/
];

const toRelative = (file) => path.relative(WORKSPACE_ROOT, file).replace(/\\/g, '/');

const redact = (value = '') => String(value)
  .replace(/(api[_-]?key|secret|token|password|private[_-]?key)(\s*[:=]\s*['"]?)[^'"\s]+/ig, '$1$2[REDACTED]')
  .replace(/AIza[0-9A-Za-z\-_]{10,}/g, 'AIza[REDACTED]')
  .replace(/sk-[A-Za-z0-9]{10,}/g, 'sk-[REDACTED]')
  .slice(0, 900);

const componentFromFile = (relativeFile = '') => {
  if (relativeFile.startsWith('frontend/')) return 'Frontend';
  if (relativeFile.startsWith('backend/')) return 'Backend';
  if (relativeFile.toLowerCase().includes('docker')) return 'Infraestructura';
  if (relativeFile.endsWith('package.json') || relativeFile.endsWith('package-lock.json')) return 'Dependencias';
  if (relativeFile.includes('config') || relativeFile.includes('.env')) return 'Configuracion';
  if (relativeFile.includes('sql') || relativeFile.includes('migrations')) return 'Base de datos';
  return 'Configuracion';
};

const finding = ({ title, description, severity = 'Informativo', file, line, evidence, recommendation }) => ({
  title,
  description,
  severity,
  affected_component: componentFromFile(file || ''),
  affected_file: file || null,
  affected_line: line || null,
  evidence: redact(evidence || ''),
  recommendation
});

const walk = (dir, out = []) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    if (SKIP_DIRS.has(entry.name)) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      return;
    }
    const ext = path.extname(entry.name).toLowerCase();
    const lower = entry.name.toLowerCase();
    if (TEXT_EXTENSIONS.has(ext) || lower === 'dockerfile' || lower.includes('.env')) out.push(full);
  });
  return out;
};

const readTextFile = (file) => {
  const stat = fs.statSync(file);
  if (stat.size > 2 * 1024 * 1024) return '';
  return fs.readFileSync(file, 'utf8');
};

const scanDependencies = (findings) => {
  ['package.json', 'backend/package.json', 'frontend/package.json'].forEach((relative) => {
    const file = path.join(WORKSPACE_ROOT, relative);
    if (!fs.existsSync(file)) return;
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    Object.entries(deps).forEach(([name, version]) => {
      const clean = String(version || '');
      if (clean === '*' || clean.toLowerCase() === 'latest') {
        findings.push(finding({
          title: 'Dependencia sin version fija',
          description: `La dependencia ${name} usa un rango demasiado amplio.`,
          severity: 'Medio',
          file: relative,
          evidence: `${name}: ${clean}`,
          recommendation: 'Fijar versiones o rangos controlados y validar con npm audit/CodeQL en CI.'
        }));
      }
    });
  });
};

const scanFileRules = (file, text, findings) => {
  const relative = toRelative(file);
  const lines = text.split(/\r?\n/);

  lines.forEach((lineText, index) => {
    const line = index + 1;
    if (SECRET_PATTERNS.some((pattern) => pattern.test(lineText))) {
      findings.push(finding({
        title: 'Posible secreto hardcodeado',
        description: 'Se detecto un patron compatible con token, API key, password o llave privada.',
        severity: 'Critico',
        file: relative,
        line,
        evidence: lineText,
        recommendation: 'Mover el secreto a variables de entorno o gestor de secretos; rotar la credencial si fue real.'
      }));
    }
    if (/\beval\s*\(/.test(lineText) || /new Function\s*\(/.test(lineText)) {
      findings.push(finding({
        title: 'Ejecucion dinamica insegura',
        description: 'El uso de eval o Function puede habilitar ejecucion arbitraria de codigo.',
        severity: 'Alto',
        file: relative,
        line,
        evidence: lineText,
        recommendation: 'Reemplazar por parsers/estructuras declarativas y validar entradas.'
      }));
    }
    if (/dangerouslySetInnerHTML\s*=/.test(lineText)) {
      findings.push(finding({
        title: 'Renderizado HTML potencialmente inseguro',
        description: 'dangerouslySetInnerHTML puede habilitar XSS si el contenido no esta sanitizado.',
        severity: 'Alto',
        file: relative,
        line,
        evidence: lineText,
        recommendation: 'Evitar HTML crudo o sanitizar con una libreria aprobada antes de renderizar.'
      }));
    }
    if (/sequelize\.query\s*\([^`'"]*\+|query\s*\([^`'"]*\+|SELECT .* \$\{|INSERT .* \$\{|UPDATE .* \$\{/i.test(lineText)) {
      findings.push(finding({
        title: 'Consulta SQL posiblemente concatenada',
        description: 'La construccion dinamica de SQL puede derivar en inyeccion si incluye datos externos.',
        severity: 'Alto',
        file: relative,
        line,
        evidence: lineText,
        recommendation: 'Usar replacements/bind parameters o metodos del ORM.'
      }));
    }
    if (/console\.(log|warn|error).*?(password|token|secret|authorization|cookie)/i.test(lineText)) {
      findings.push(finding({
        title: 'Log con posible dato sensible',
        description: 'Los logs no deben imprimir secretos, tokens ni credenciales.',
        severity: 'Medio',
        file: relative,
        line,
        evidence: lineText,
        recommendation: 'Redactar datos sensibles antes de registrarlos o eliminar el log.'
      }));
    }
  });

  if (/cors\s*\(\s*\{[^}]*origin\s*:\s*['"]\*['"]/is.test(text) || /Access-Control-Allow-Origin['"]?\s*,\s*['"]\*['"]/i.test(text)) {
    findings.push(finding({
      title: 'CORS abierto',
      description: 'La configuracion permite origen wildcard.',
      severity: 'Alto',
      file: relative,
      evidence: 'origin: *',
      recommendation: 'Restringir CORS a dominios institucionales por ambiente.'
    }));
  }

  if (/router\.(get|post|put|patch|delete)\s*\([^)]*\)/.test(text) && relative.startsWith('backend/src/routes/')) {
    text.split(/\r?\n/).forEach((lineText, index) => {
      if (/router\.(get|post|put|patch|delete)\s*\(/.test(lineText) && !/\bauth\b|\badminAuth\b|\bonlyAdmin\b|\bhasAnyRole\b|\bensureAccess\b/.test(lineText)) {
        findings.push(finding({
          title: 'Ruta backend sin autenticacion evidente',
          description: 'La ruta no muestra middleware de autenticacion en la declaracion. Puede ser intencional si es publica.',
          severity: relative.includes('public') ? 'Informativo' : 'Medio',
          file: relative,
          line: index + 1,
          evidence: lineText,
          recommendation: 'Confirmar si la ruta es publica; si no lo es, agregar auth y autorizacion por permiso/rol.'
        }));
      }
    });
  }

  if (/multer\s*\(/.test(text) && !/fileSize|LIMIT_FILE_SIZE|limits\s*:/.test(text)) {
    findings.push(finding({
      title: 'Upload sin limite de tamano evidente',
      description: 'La configuracion de carga no muestra limite de tamano en el mismo archivo.',
      severity: 'Medio',
      file: relative,
      evidence: 'multer(...) sin limits.fileSize cercano',
      recommendation: 'Definir limite maximo, tipos MIME permitidos y almacenamiento controlado.'
    }));
  }

  if (path.basename(relative).toLowerCase() === 'dockerfile' && !/\n\s*USER\s+/i.test(`\n${text}`)) {
    findings.push(finding({
      title: 'Dockerfile sin usuario no-root',
      description: 'El contenedor puede ejecutarse como root si no se declara USER.',
      severity: 'Medio',
      file: relative,
      evidence: 'No se encontro instruccion USER',
      recommendation: 'Crear usuario no privilegiado y ejecutar la aplicacion con USER.'
    }));
  }
};

const scanEnvFiles = (files, findings) => {
  files
    .map(toRelative)
    .filter((relative) => relative.includes('.env') && !relative.endsWith('.example'))
    .forEach((relative) => {
      findings.push(finding({
        title: 'Archivo de entorno presente en workspace',
        description: 'Los archivos .env no deben quedar expuestos ni versionados.',
        severity: relative.includes('.local') ? 'Bajo' : 'Medio',
        file: relative,
        evidence: 'Archivo .env detectado; contenido no expuesto por el scanner.',
        recommendation: 'Verificar .gitignore, permisos de archivo y ausencia de secretos reales en repositorio.'
      }));
    });
};

const runStaticSecurityScan = () => {
  const findings = [];
  const files = walk(WORKSPACE_ROOT);
  scanDependencies(findings);
  scanEnvFiles(files, findings);
  files.forEach((file) => {
    try {
      const text = readTextFile(file);
      if (text) scanFileRules(file, text, findings);
    } catch (_) {
      // El scanner es preventivo: si un archivo no puede leerse, se omite sin interrumpir el escaneo.
    }
  });
  return findings.slice(0, 500);
};

const getCodeWindow = (relativeFile, lineNumber) => {
  if (!relativeFile || !lineNumber) return '';
  const file = path.resolve(WORKSPACE_ROOT, relativeFile);
  if (!file.startsWith(WORKSPACE_ROOT) || !fs.existsSync(file)) return '';
  const lines = readTextFile(file).split(/\r?\n/);
  const start = Math.max(0, Number(lineNumber) - 4);
  const end = Math.min(lines.length, Number(lineNumber) + 3);
  return redact(lines.slice(start, end).map((line, idx) => `${start + idx + 1}: ${line}`).join('\n'));
};

module.exports = {
  runStaticSecurityScan,
  getCodeWindow
};
