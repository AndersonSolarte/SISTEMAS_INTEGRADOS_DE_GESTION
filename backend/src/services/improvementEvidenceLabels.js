const kinds = ['Resultado', 'Logro', 'Impacto'];
const folderName = (kind) => `${String(kinds.indexOf(kind) + 1).padStart(2, '0')} - Evidencias de ${kind.toLowerCase()}`;
const evidenceName = (name, kind) => {
  if (!kinds.includes(kind)) return String(name || 'evidencia');
  const original = String(name || 'evidencia').replace(/^\[Evidencia de (resultado|logro|impacto)\]\s*/i, '');
  const extension = require('path').extname(original);
  const prefix = `[Evidencia de ${kind.toLowerCase()}] `;
  return `${prefix}${original.slice(0, original.length - extension.length).slice(0, Math.max(1, 180 - prefix.length - extension.length))}${extension}`;
};
module.exports = { kinds, folderName, evidenceName };
