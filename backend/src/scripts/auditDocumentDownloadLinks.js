const { sequelize } = require('../config/database');

const classifyLink = (value = '') => {
  const link = String(value || '').trim();
  if (!link) return 'vacio';
  if (link.startsWith('/uploads/')) return 'archivo-local';

  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();
    if (host.includes('drive.usercontent.google.com')) return 'google-descarga-directa';
    if (host.includes('drive.google.com')) {
      if (url.pathname.includes('/file/d/') && url.pathname.includes('/view')) return 'google-drive-vista';
      if (url.pathname.includes('/uc')) return 'google-drive-descarga';
      return 'google-drive';
    }
    if (host.includes('docs.google.com')) {
      if (url.pathname.includes('/export')) return 'google-docs-export';
      return 'google-docs-vista-edicion';
    }
    return host;
  } catch (_error) {
    return 'texto-no-url';
  }
};

const main = async () => {
  const terms = process.argv.slice(2).map((term) => String(term || '').trim()).filter(Boolean);
  const replacements = {};
  const filters = terms.map((term, index) => {
    const key = `term${index}`;
    replacements[key] = `%${term}%`;
    return `(codigo ILIKE :${key} OR titulo ILIKE :${key} OR link_acceso ILIKE :${key})`;
  });
  const where = [
    'link_acceso IS NOT NULL',
    'length(trim(link_acceso)) > 0',
    ...(filters.length ? [`(${filters.join(' OR ')})`] : [])
  ].join('\n      AND ');

  const [rows] = await sequelize.query(`
    SELECT codigo, titulo, link_acceso
    FROM documentos
    WHERE ${where}
    ORDER BY id ASC
  `, { replacements });

  const counts = new Map();
  rows.forEach((row) => {
    const type = classifyLink(row.link_acceso);
    counts.set(type, (counts.get(type) || 0) + 1);
  });

  console.log(`Documentos con link_acceso${terms.length ? ` filtrados por: ${terms.join(', ')}` : ''}: ${rows.length}`);
  Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([type, count]) => console.log(`${type}: ${count}`));

  console.log('\nMuestras:');
  rows.slice(0, terms.length ? 100 : 20).forEach((row, index) => {
    const link = String(row.link_acceso || '').trim();
    console.log(`${index + 1}. ${row.codigo || ''} | ${row.titulo || ''} | ${classifyLink(link)} | ${link}`);
  });

  await sequelize.close();
};

main().catch(async (error) => {
  console.error('No se pudo auditar link_acceso:', error.message);
  try {
    await sequelize.close();
  } catch (_closeError) {
    // noop
  }
  process.exit(1);
});
