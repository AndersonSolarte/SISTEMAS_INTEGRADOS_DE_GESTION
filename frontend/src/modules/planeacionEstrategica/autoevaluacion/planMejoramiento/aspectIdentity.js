const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
export const aspectKey = (item = {}) => normalize(item.aspecto || item.aspectos_por_evaluar)
  ? JSON.stringify([item.factor, item.caracteristica, item.aspecto || item.aspectos_por_evaluar].map(normalize))
  : `id:${item.id}`;
export const uniqueAspects = (items = []) => [...new Map(items.slice().reverse().map((item) => [aspectKey(item), item])).values()].reverse();
