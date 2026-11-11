const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../build');
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Falta el build de produccion.');
const forbidden = [];
const walk = (directory) => {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name);
    if (item.isSymbolicLink()) { forbidden.push(filename); continue; }
    if (item.isDirectory()) { walk(filename); continue; }
    if (/\.(map|pem|key|p12|pfx|sql|dump|siacbackup|enc|jsx|tsx|ts|py)$/i.test(item.name)
      || /^\.env(?:\.|$)/i.test(item.name)
      || /^(?:package(?:-lock)?\.json|Dockerfile|nginx\.conf)$/i.test(item.name)) forbidden.push(filename);
  }
};
walk(root);
if (forbidden.length) {
  console.error('Archivos no publicables:', forbidden.map((file) => path.relative(root, file)));
  process.exit(1);
}
console.log('Build verificado: sin mapas de fuente ni archivos privados de los tipos comprobados.');
