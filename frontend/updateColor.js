const fs = require('fs');
const file = 'c:/laragon/www/SISTEMAS_INTEGRADOS_DE_GESTION/frontend/src/components/internacionalizacion/InternacionalizacionMovilidadDashboard.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  "color:'#cbd5e1', fontWeight:700, width:20, textAlign:'right'",
  "color:'#64748b', fontWeight:700, width:20, textAlign:'right'"
);
fs.writeFileSync(file, content, 'utf8');
console.log('Color updated');
