const words = (value) => (String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().match(/[a-z0-9]+/g) || []);

const closeWord = (left, right) => {
  if (right.startsWith(left)) return true;
  // Short terms and identifiers must match exactly; tolerate typos in longer words.
  if (left.length < 5 || !/^[a-z]+$/.test(left) || !/^[a-z]+$/.test(right)) return false;
  const limit = left.length >= 7 ? 2 : 1;
  if (Math.abs(left.length - right.length) > limit) return false;
  const distance = Array.from({ length: left.length + 1 }, (_, i) => [i]);
  distance[0] = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      distance[i][j] = Math.min(distance[i - 1][j] + 1, distance[i][j - 1] + 1,
        distance[i - 1][j - 1] + Number(left[i - 1] !== right[j - 1]));
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        distance[i][j] = Math.min(distance[i][j], distance[i - 2][j - 2] + 1);
      }
    }
  }
  return distance[left.length][right.length] <= limit;
};

export const filterActionPlanUnits = (units, plans, query) => {
  const terms = words(query);
  if (!terms.length) return units;
  const byUnit = new Map();
  for (const plan of plans) {
    const id = String(plan.catalog_item_id || plan.organizationalUnit?.id);
    if (!byUnit.has(id)) byUnit.set(id, plan);
  }
  const candidates = units.map((unit) => {
    const assignment = unit.annualAssignment?.responsible || {};
    const plan = byUnit.get(String(unit.id));
    const responsible = plan?.responsibleUser || {};
    const primary = words([unit.name, unit.code].filter(Boolean).join(' '));
    const all = [...primary, ...words([
      assignment.name, assignment.document, assignment.email, assignment.position,
      responsible.nombre, responsible.email, responsible.cargo,
      plan?.code, plan?.title, plan?.status, plan ? 'plan creado abierto' : 'pendiente crear plan'
    ].filter(Boolean).join(' '))];
    // A user's profile dependency may differ from this plan's dependency. It is
    // deliberately excluded to avoid showing unrelated plans for "sistemas".
    return { unit, primary, all };
  });
  const matches = (field, fuzzy = false) => candidates.filter((candidate) => terms.every((term) =>
    candidate[field].some((word) => fuzzy ? closeWord(term, word) : word.startsWith(term))));
  // Prefer names/codes and exact keywords before considering similar spellings.
  for (const find of [() => matches('primary'), () => matches('all'),
    () => matches('primary', true), () => matches('all', true)]) {
    const result = find();
    if (result.length) return result.map(({ unit }) => unit);
  }
  return [];
};
