const getActiveIndicators = (item = {}) => {
  const custom = item.custom_values || {};
  const active = [];

  const hasStructuredConfig =
    custom.indicadorResultadoActivo !== undefined ||
    custom.indicadorLogroActivo !== undefined ||
    custom.indicadorImpactoActivo !== undefined ||
    Boolean(custom.indicadorResultado) ||
    Boolean(custom.indicadorLogro) ||
    Boolean(custom.indicadorImpacto);

  if (hasStructuredConfig) {
    const kinds = [
      { kind: 'resultado', shortLabel: 'Resultado', label: 'Indicador de resultado', indKey: 'indicadorResultado', metaKey: 'metaResultado', activeKey: 'indicadorResultadoActivo', color: '#2563eb', badgeBg: '#eff6ff', borderColor: '#bfdbfe' },
      { kind: 'logro', shortLabel: 'Logro', label: 'Indicador de logro', indKey: 'indicadorLogro', metaKey: 'metaLogro', activeKey: 'indicadorLogroActivo', color: '#0d9488', badgeBg: '#f0fdfa', borderColor: '#99f6e4' },
      { kind: 'impacto', shortLabel: 'Impacto', label: 'Indicador de impacto', indKey: 'indicadorImpacto', metaKey: 'metaImpacto', activeKey: 'indicadorImpactoActivo', color: '#7c3aed', badgeBg: '#f5f3ff', borderColor: '#ddd6fe' }
    ];

    for (const k of kinds) {
      const isExplicit = custom[k.activeKey];
      const rawInd = custom[k.indKey] || (k.kind === 'resultado' ? (item.indicator || custom.indicator) : '');
      const rawMeta = custom[k.metaKey] || (k.kind === 'resultado' ? (item.target || custom.target) : '');

      const cleanInd = String(rawInd || '').trim();
      const cleanMeta = String(rawMeta || '').trim();
      const hasRealContent = cleanInd.length > 0 && cleanInd.toLowerCase() !== 'sin indicador';

      // Regla: un carril de seguimiento solo existe si realmente tiene texto redactado en el indicador
      // y no está explícitamente desactivado.
      if (isExplicit !== false && hasRealContent) {
        active.push({
          kind: k.kind,
          shortLabel: k.shortLabel,
          label: k.label,
          indicator: cleanInd,
          target: cleanMeta || '100%',
          color: k.color,
          badgeBg: k.badgeBg,
          borderColor: k.borderColor
        });
      }
    }
  }

  // Si no tiene bloques estructurados con contenido, usar el indicador principal estándar de la actividad
  if (active.length === 0) {
    const mainInd = String(item.indicator || custom.indicator || '').trim();
    const mainTarget = String(item.target || custom.target || '').trim();
    active.push({
      kind: 'principal',
      shortLabel: item.indicator_type || custom.indicator_type || 'Indicador',
      label: item.indicator_type || custom.indicator_type || 'Indicador',
      indicator: mainInd || 'Sin indicador',
      target: mainTarget || '100%',
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
