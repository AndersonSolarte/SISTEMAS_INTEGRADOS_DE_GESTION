const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const aspectKey = (item = {}) => normalize(item.aspecto || item.aspectos_por_evaluar)
  ? JSON.stringify([item.factor, item.caracteristica, item.aspecto || item.aspectos_por_evaluar].map(normalize))
  : `id:${item.id}`;
const uniqueAspects = (items = []) => [...new Map(items.slice().reverse().map((item) => [aspectKey(item), item])).values()].reverse();
const validateAspectAssignments = (objectives = []) => {
  const assigned = new Set();
  for (const objective of objectives) {
    const aspects = objective.aspectosAutoevaluacion?.length ? objective.aspectosAutoevaluacion
      : objective.origenAutoevaluacion?.id ? [{ ...objective, id: objective.origenAutoevaluacion.id }] : [];
    for (const aspect of uniqueAspects(aspects)) {
      const key = aspectKey(aspect);
      if (assigned.has(key)) throw Object.assign(new Error(`El aspecto «${aspect.aspecto || aspect.id}» ya está asociado a otro objetivo. Retire la asociación repetida.`), { status: 422 });
      assigned.add(key);
    }
  }
};
module.exports = { aspectKey, uniqueAspects, validateAspectAssignments };
