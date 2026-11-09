const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
export const aspectKey = (item = {}) => normalize(item.aspecto || item.aspectos_por_evaluar)
  ? JSON.stringify([item.factor, item.caracteristica, item.aspecto || item.aspectos_por_evaluar].map(normalize))
  : `id:${item.id}`;
export const uniqueAspects = (items = []) => [...new Map(items.slice().reverse().map((item) => [aspectKey(item), item])).values()].reverse();

export const pendingAspects = (opportunities = [], objectives = []) => {
  const assigned = objectives.flatMap((objective) => objective.aspectosAutoevaluacion?.length
    ? objective.aspectosAutoevaluacion
    : objective.origenAutoevaluacion?.id ? [{ ...objective, id: objective.origenAutoevaluacion.id }] : []);
  const keys = new Set(assigned.map(aspectKey));
  // Some legacy objectives have only their source ID. Match that ID only when
  // there is no descriptive identity, so reused row IDs don't hide other factors.
  const legacyIds = new Set(assigned.filter((item) => !item.aspecto && !item.aspectos_por_evaluar).map((item) => String(item.id)));
  return uniqueAspects(opportunities).filter((item) => !keys.has(aspectKey(item)) && !legacyIds.has(String(item.id)));
};
