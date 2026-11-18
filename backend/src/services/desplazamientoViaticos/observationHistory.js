const clean = value => typeof value === 'string' ? value.trim() : '';
const FINANCIAL_STAGES = new Set(['tecnico_contable', 'tesoreria']);
const labels = {
  jefe: 'Jefe inmediato', financiera_previa: 'Vicerrectoría Financiera',
  financiera_final: 'Vicerrectoría Financiera', sst: 'Seguridad y Salud en el Trabajo',
  gestion_humana: 'Gestión del Talento Humano', tecnico_contable: 'Técnico Contable',
  tesoreria: 'Tesorería / Pagaduría', rectoria: 'Rectoría',
  vicerrectoria_dependencia: 'Vicerrectoría correspondiente'
};
const stageFor = event => {
  const key = String(event || '').replace(/^(?:no_aprobado|aprobado|aprobada|completado|liquidada|pago_autorizado|visto_bueno)_/, '');
  return ({ vicerrectoria_financiera: 'financiera_previa', vicerrectoria_academica: 'vicerrectoria_dependencia' })[key] || key;
};
const formatObservationDate = value => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : 'Fecha no registrada';
};

// Una sola fuente para HTML, PDF y Excel. No altera el historial persistido.
const getObservationHistory = (solicitud = {}, { includeFinancial = true } = {}) => {
  const plan = Array.isArray(solicitud.plan_aprobacion) ? solicitud.plan_aprobacion : [];
  const traces = Array.isArray(solicitud.trazabilidad) ? solicitud.trazabilidad : [];
  const history = [];
  const seen = new Set();
  traces.forEach((trace, index) => {
    if (/^correo_/.test(trace.event || '')) return;
    const stepKey = stageFor(trace.event);
    if (!includeFinancial && FINANCIAL_STAGES.has(stepKey)) return;
    const step = plan.find(item => item.key === stepKey);
    const detail = trace.detail || {};
    const values = [detail.observacion, detail.observaciones, detail.observation,
      detail.observacionesLiquidacion, trace.observacion, trace.motivo, trace.justificacion];
    [...new Set(values.map(clean).filter(Boolean))].forEach(text => {
      const actorName = clean(trace.actor?.nombre) || clean(trace.actor?.email) || step?.label || 'Responsable no registrado';
      const actorEmail = clean(trace.actor?.email);
      const key = JSON.stringify([stepKey, trace.at || '', actorEmail || actorName, text]);
      if (seen.has(key)) return;
      seen.add(key);
      history.push({ stepKey, stepLabel: step?.label || labels[stepKey] || 'Anotación del trámite',
        actorName, actorEmail, actorCargo: clean(trace.actor?.cargo), date: trace.at || null, text, index });
    });
  });
  if (includeFinancial) {
    traces.forEach((trace, index) => {
      const previous = clean(trace.detail?.observacionesLiquidacionAnterior);
      if (!previous || history.some(item => item.text === previous)) return;
      history.push({ stepKey: 'liquidacion', stepLabel: 'Observación previa al ajuste de Tesorería (registro anterior)',
        actorName: 'Responsable no registrado', actorEmail: '', actorCargo: '', date: null, text: previous, index });
    });
  }
  // Registros antiguos pueden tener una nota sin su autor en la trazabilidad.
  // Conservarla sin inventar quién la escribió ni una fecha de firma.
  const legacyText = clean(solicitud.liquidacion?.observaciones);
  if (includeFinancial && legacyText && !history.some(item => item.text === legacyText)) {
    history.push({ stepKey: 'liquidacion', stepLabel: 'Observación a la liquidación (registro anterior)',
      actorName: 'Responsable no registrado', actorEmail: '', actorCargo: '', date: null, text: legacyText, index: traces.length });
  }
  return history.sort((a, b) => {
    const time = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).getTime() : Infinity;
    const first = time(a.date), second = time(b.date);
    return first === second ? a.index - b.index : first < second ? -1 : 1;
  });
};

module.exports = { getObservationHistory, formatObservationDate };
