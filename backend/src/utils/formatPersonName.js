const LOWERCASE_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do']);

const formatPersonName = (value = '') => {
  const str = String(value || '').trim();
  if (!str) return '';

  return str
    .split(/\s+/)
    .map((token, idx) => {
      if (!token) return '';
      if (token.includes('-')) {
        return token
          .split('-')
          .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''))
          .join('-');
      }
      const lower = token.toLowerCase();
      if (idx > 0 && LOWERCASE_WORDS.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
};

module.exports = { formatPersonName };
