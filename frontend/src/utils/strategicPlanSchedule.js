/**
 * Utilidades para determinar la vigencia y plazos programados de Planes de Acción
 *
 * REGLAS INSTITUCIONALES:
 * 1. Plazo Global (Vigencia): Es el plazo general de formulación definido por Planeación y Efectividad para todos los planes.
 * 2. Plazo Individual: Es el plazo específico o prórroga otorgada a un plan en particular.
 * 3. Si no hay plazo individual, el plan se rige por el plazo global.
 * 4. REGLA DE MAYOR PLAZO (MAX DATE):
 *    Siempre prevalece la fecha que otorgue mayor tiempo (la mayor entre el plazo individual y el plazo global).
 *    - Si el plazo global se amplía y supera al individual, rige el plazo global para ese plan.
 *    - Si el plazo individual es mayor al global (ej. prórroga concedida), se respeta y rige el plazo individual.
 * 5. Hasta que no se venza esa fecha mayor (o mientras la vigencia no esté formalmente cerrada),
 *    el usuario líder mantiene visualización y acceso a su Plan de Acción.
 *    Al vencerse la fecha mayor, el módulo se oculta y restringe automáticamente.
 */

/**
 * Resuelve y calcula el cronograma efectivo y plazos para un Plan de Acción.
 * @param {Object} plan - Objeto del plan de acción (con term y metadata).
 * @returns {Object} Detalle completo del cronograma y plazos calculados.
 */
export const getPlanEffectiveSchedule = (plan) => {
  if (!plan) {
    return {
      isWithinSchedule: false,
      isScheduleExpired: true,
      isScheduleNotStarted: false,
      isTermClosed: false,
      effectiveEndsOn: null,
      effectiveStartsOn: null,
      globalEndsOn: null,
      individualEndsOn: null,
      activeDeadlineType: 'global',
      hasActiveIndividualExtension: false,
      daysRemaining: null
    };
  }

  // Si el plan está cerrado formalmente
  const isPlanClosed = plan.status === 'closed';

  const term = plan.term;
  const isTermClosed = Boolean(!term || ['closed', 'inactive', 'archived'].includes(term?.status) || isPlanClosed);

  const todayIso = new Date().toISOString().slice(0, 10);

  // 1. Plazo Global de la Vigencia
  const termMeta = term?.metadata || {};
  const globalEndsOn = termMeta.formulation_ends_on || term?.ends_on || (term?.year ? `${term.year}-12-31` : null);
  const globalStartsOn = termMeta.formulation_starts_on || term?.starts_on || (term?.year ? `${term.year}-01-01` : null);

  // 2. Plazo Individual del Plan (prórrogas otorgadas formalmente en metadata)
  const planMeta = plan.metadata || {};
  const extensions = Array.isArray(planMeta.formulation_extensions) ? planMeta.formulation_extensions : [];

  // REGLA INSTITUCIONAL ESTRICTA:
  // Un plazo individual ÚNICAMENTE existe si fue otorgado formalmente mediante prórroga individual (formulation_extensions).
  // La prórroga que rige es la ÚLTIMA configurada para ese plan (último elemento del historial asignado).
  let individualEndsOn = null;
  let individualStartsOn = null;

  if (extensions.length > 0) {
    const latestExt = extensions[extensions.length - 1];
    const extDate = latestExt ? (latestExt.new_deadline || latestExt.extended_until || latestExt.ends_on || latestExt.fecha_limite) : null;
    individualEndsOn = extDate ? String(extDate).slice(0, 10) : (planMeta.formulation_ends_on ? String(planMeta.formulation_ends_on).slice(0, 10) : null);
    individualStartsOn = latestExt?.starts_on ? String(latestExt.starts_on).slice(0, 10) : (planMeta.formulation_starts_on ? String(planMeta.formulation_starts_on).slice(0, 10) : null);
  }

  // 3. REGLA DE ORO: PREVALECE LA FECHA MAYOR ENTRE GLOBAL E INDIVIDUAL
  let effectiveEndsOn = null;
  let activeDeadlineType = 'global';

  const gIso = globalEndsOn ? String(globalEndsOn).slice(0, 10) : null;
  const iIso = individualEndsOn ? String(individualEndsOn).slice(0, 10) : null;

  if (gIso && iIso) {
    if (iIso > gIso) {
      effectiveEndsOn = iIso;
      activeDeadlineType = 'individual';
    } else {
      effectiveEndsOn = gIso;
      activeDeadlineType = 'global';
    }
  } else if (iIso) {
    effectiveEndsOn = iIso;
    activeDeadlineType = 'individual';
  } else if (gIso) {
    effectiveEndsOn = gIso;
    activeDeadlineType = 'global';
  }

  // Fecha de inicio: la menor para no bloquear accesos tempranos concedidos
  const gStartIso = globalStartsOn ? String(globalStartsOn).slice(0, 10) : null;
  const iStartIso = individualStartsOn ? String(individualStartsOn).slice(0, 10) : null;
  let effectiveStartsOn = null;
  if (gStartIso && iStartIso) {
    effectiveStartsOn = iStartIso < gStartIso ? iStartIso : gStartIso;
  } else {
    effectiveStartsOn = gStartIso || iStartIso || null;
  }

  // Estado de vencimiento
  const isScheduleExpired = isTermClosed || Boolean(effectiveEndsOn && todayIso > effectiveEndsOn);
  const isScheduleNotStarted = Boolean(effectiveStartsOn && todayIso < effectiveStartsOn);
  const isWithinSchedule = !isTermClosed && !isScheduleExpired && !isScheduleNotStarted;

  // Prórroga activa: si el plazo que rige es individual y está vigente
  const hasActiveIndividualExtension = Boolean(
    activeDeadlineType === 'individual' &&
    effectiveEndsOn &&
    effectiveEndsOn >= todayIso &&
    (!gIso || effectiveEndsOn > gIso)
  );

  // Días restantes
  const daysRemaining = effectiveEndsOn
    ? Math.ceil((new Date(`${effectiveEndsOn}T23:59:59`) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    isWithinSchedule,
    isScheduleExpired,
    isScheduleNotStarted,
    isTermClosed,
    effectiveEndsOn,
    effectiveStartsOn,
    globalEndsOn: gIso,
    individualEndsOn: iIso,
    activeDeadlineType,
    hasActiveIndividualExtension,
    daysRemaining
  };
};

/**
 * Determina si un plan de acción se encuentra dentro de su vigencia y plazo programado activo para el usuario.
 */
export const isPlanWithinActiveSchedule = (plan) => {
  if (!plan) return false;
  if (plan.status === 'closed') return false;

  const schedule = getPlanEffectiveSchedule(plan);
  return schedule.isWithinSchedule;
};
