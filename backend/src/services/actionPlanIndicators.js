const getActiveIndicators = (item = {}) => {
  const custom = item.custom_values || {};
  const active = [];

  const kinds = [
    { kind: 'resultado', shortLabel: 'Resultado', label: 'Indicador de resultado', indKey: 'indicadorResultado', metaKey: 'metaResultado', activeKey: 'indicadorResultadoActivo', color: '#2563eb', badgeBg: '#eff6ff', borderColor: '#bfdbfe' },
    { kind: 'logro', shortLabel: 'Logro', label: 'Indicador de logro', indKey: 'indicadorLogro', metaKey: 'metaLogro', activeKey: 'indicadorLogroActivo', color: '#0d9488', badgeBg: '#f0fdfa', borderColor: '#99f6e4' },
    { kind: 'impacto', shortLabel: 'Impacto', label: 'Indicador de impacto', indKey: 'indicadorImpacto', metaKey: 'metaImpacto', activeKey: 'indicadorImpactoActivo', color: '#7c3aed', badgeBg: '#f5f3ff', borderColor: '#ddd6fe' }
  ];

  for (const k of kinds) {
    const isExplicit = custom[k.activeKey];
    const indVal = custom[k.indKey] || (k.kind === 'resultado' && !isExplicit ? (item.indicator || custom.indicator) : '');
    const metaVal = custom[k.metaKey] || (k.kind === 'resultado' && !isExplicit ? (item.target || custom.target) : '');
    const hasContent = Boolean(String(indVal || metaVal || '').trim());

    if (isExplicit === true || (isExplicit === undefined && hasContent && k.kind === 'resultado' && (custom.indicadorResultadoActivo || custom.indicadorLogroActivo || custom.indicadorImpactoActivo))) {
      active.push({
        kind: k.kind,
        shortLabel: k.shortLabel,
        label: k.label,
        indicator: String(indVal || '').trim() || 'Sin indicador',
        target: String(metaVal || '').trim() || '100%',
        color: k.color,
        badgeBg: k.badgeBg,
        borderColor: k.borderColor
      });
    } else if (isExplicit) {
      active.push({
        kind: k.kind,
        shortLabel: k.shortLabel,
        label: k.label,
        indicator: String(indVal || '').trim() || 'Sin indicador',
        target: String(metaVal || '').trim() || '100%',
        color: k.color,
        badgeBg: k.badgeBg,
        borderColor: k.borderColor
      });
    }
  }

  // Si no tiene bloques dinámicos activos, usar el indicador principal estándar
  if (active.length === 0) {
    active.push({
      kind: 'principal',
      shortLabel: item.indicator_type || custom.indicator_type || 'Indicador',
      label: item.indicator_type || custom.indicator_type || 'Indicador',
      indicator: String(item.indicator || custom.indicator || '').trim() || 'Sin indicador',
      target: String(item.target || custom.target || '').trim() || '100%',
      color: '#059669',
      badgeBg: '#ecfdf5',
      borderColor: '#a7f3d0'
    });
  }

  return active;
};

const getIndicatorProgress = (item, periodId, kind) => {
  const custom = item.custom_values || {};
  const monitoringIndicators = custom.monitoring_indicators?.[periodId];
  if (monitoringIndicators && monitoringIndicators[kind] !== undefined) {
    const val = typeof monitoringIndicators[kind] === 'object' ? monitoringIndicators[kind].progress : monitoringIndicators[kind];
    const num = Number(val);
    return isNaN(num) ? null : num;
  }
  // Si solo hay un indicador o es principal, tomar el resultado general del periodo
  const result = (item.monitoringResults || []).find((r) => String(r.monitoring_period_id) === String(periodId));
  if (result && result.physical_progress !== null && result.physical_progress !== undefined) {
    const num = Number(result.physical_progress);
    return isNaN(num) ? null : num;
  }
  return null;
};

const calculateOverallFulfillment = (item, periods = []) => {
  const indicators = getActiveIndicators(item);
  if (!indicators.length) return 0;

  let totalSum = 0;
  for (const ind of indicators) {
    let indPeriodSum = 0;
    for (const p of periods) {
      const prog = getIndicatorProgress(item, p.id, ind.kind);
      if (prog !== null) {
        indPeriodSum += prog;
      }
    }
    totalSum += indPeriodSum;
  }

  return Number((totalSum / indicators.length).toFixed(1));
};

const filterEvidencesByIndicator = (evidences = [], kind) => {
  if (!kind || kind === 'principal') return evidences;
  return evidences.filter((ev) => {
    const desc = String(ev.description || '').toLowerCase();
    const name = String(ev.original_name || '').toLowerCase();
    const tag = `[${kind.toLowerCase()}]`;
    return desc.includes(tag) || desc.includes(`indicador de ${kind.toLowerCase()}`) || name.includes(kind.toLowerCase());
  });
};

module.exports = {
  getActiveIndicators,
  getIndicatorProgress,
  calculateOverallFulfillment,
  filterEvidencesByIndicator
};
