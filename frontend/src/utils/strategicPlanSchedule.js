/**
 * Utilidades para determinar la vigencia y plazos programados de Planes de Acción
 */

/**
 * Determina si un plan de acción se encuentra dentro de su vigencia programada y activa para el usuario líder.
 * Regla:
 * - Si el plan o su vigencia están cerrados ('closed', 'inactive', 'archived') -> false.
 * - Si tiene prórroga individual vigente -> true.
 * - Si el plazo de la vigencia (Plazo General configurado por Planeación o plazo del plan) ya venció (today > endsOn) -> false.
 * - Si el plazo aún no ha iniciado (today < startsOn) -> false.
 */
export const isPlanWithinActiveSchedule = (plan) => {
  if (!plan) return false;
  if (plan.status === 'closed') return false;
  if (typeof plan.is_within_schedule === 'boolean') {
    return plan.is_within_schedule;
  }

  const term = plan.term;
  if (!term || ['closed', 'inactive', 'archived'].includes(term.status)) return false;

  const todayIso = new Date().toISOString().slice(0, 10);

  // 1. Revisar prórrogas individuales activas otorgadas por Planeación
  const extensions = Array.isArray(plan.metadata?.formulation_extensions)
    ? plan.metadata.formulation_extensions
    : [];

  let activeExtensionDate = null;
  for (const ext of extensions) {
    const extDate = ext.extended_until || ext.ends_on || ext.fecha_limite;
    if (extDate) {
      const extIso = String(extDate).slice(0, 10);
      if (extIso >= todayIso) {
        if (!activeExtensionDate || extIso > activeExtensionDate) {
          activeExtensionDate = extIso;
        }
      }
    }
  }

  // Si tiene una prórroga individual vigente, la prórroga manda y está dentro de plazo
  if (activeExtensionDate) {
    return true;
  }

  // 2. Si la vigencia tiene un Plazo General configurado por Planeación (ej. 2026-10-27)
  const termEndsOn = term.metadata?.formulation_ends_on;
  const planEndsOn = plan.metadata?.formulation_ends_on;
  const effectiveEndsOn = termEndsOn || planEndsOn || term.ends_on || (term.year ? `${term.year}-12-31` : null);

  const termStartsOn = term.metadata?.formulation_starts_on;
  const planStartsOn = plan.metadata?.formulation_starts_on;
  const effectiveStartsOn = termStartsOn || planStartsOn || term.starts_on || (term.year ? `${term.year}-01-01` : null);

  if (effectiveEndsOn) {
    const endsIso = String(effectiveEndsOn).slice(0, 10);
    if (todayIso > endsIso) {
      return false; // Plazo vencido / cerrado
    }
  }

  if (effectiveStartsOn) {
    const startsIso = String(effectiveStartsOn).slice(0, 10);
    if (todayIso < startsIso) {
      return false; // Aún no inicia
    }
  }

  return true;
};
