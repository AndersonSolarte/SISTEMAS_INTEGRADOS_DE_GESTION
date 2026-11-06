const resolvePlanEffectiveSchedule = (plan, term = null) => {
  const resolvedTerm = term || plan?.term || null;
  const termMeta = resolvedTerm?.metadata || {};
  const planMeta = plan?.metadata || {};

  const isTermClosed = Boolean(resolvedTerm && ['closed', 'inactive', 'archived'].includes(resolvedTerm.status)) || plan?.status === 'closed';
  const todayIso = new Date().toISOString().slice(0, 10);

  // 1. Plazo Global de la Vigencia
  const globalEndsOn = termMeta.formulation_ends_on || resolvedTerm?.ends_on || (resolvedTerm?.year ? `${resolvedTerm.year}-12-31` : null);
  const globalStartsOn = termMeta.formulation_starts_on || resolvedTerm?.starts_on || (resolvedTerm?.year ? `${resolvedTerm.year}-01-01` : null);

  // 2. Plazo Individual del Plan (prórrogas otorgadas formalmente en metadata)
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

  // 3. Regla del Mayor Plazo (MAX DATE):
  // Si la fecha global supera la fecha individual, nos quedamos con la fecha que más tenga plazo (la mayor).
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

  const gStartIso = globalStartsOn ? String(globalStartsOn).slice(0, 10) : null;
  const iStartIso = individualStartsOn ? String(individualStartsOn).slice(0, 10) : null;
  let effectiveStartsOn = null;
  if (gStartIso && iStartIso) {
    effectiveStartsOn = iStartIso < gStartIso ? iStartIso : gStartIso;
  } else {
    effectiveStartsOn = gStartIso || iStartIso || null;
  }

  const isScheduleExpired = isTermClosed || Boolean(effectiveEndsOn && todayIso > effectiveEndsOn);
  const isScheduleNotStarted = Boolean(effectiveStartsOn && todayIso < effectiveStartsOn);
  const isWithinSchedule = !isTermClosed && !isScheduleExpired && !isScheduleNotStarted;

  const hasActiveIndividualExtension = Boolean(
    activeDeadlineType === 'individual' &&
    effectiveEndsOn &&
    effectiveEndsOn >= todayIso &&
    (!gIso || effectiveEndsOn > gIso)
  );

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
    hasActiveIndividualExtension
  };
};

module.exports = { resolvePlanEffectiveSchedule };
