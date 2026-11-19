const SHORT_SPANISH_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const isApprovedRequest = (row) => row?.estado === 'finalizada';

export const isRejectedRequest = (row) => row?.estado === 'no_aprobada';

export const isPendingRequest = (row) => !isApprovedRequest(row) && !isRejectedRequest(row);

export const isDiligenciaPersonalRow = (row) => {
  if (!row) return false;
  const salidaTipo = String(row.datos_formulario?.salida?.tipo || row.datos_formulario?.tipo || '').toLowerCase();
  if (salidaTipo && salidaTipo !== 'diligencia_personal') return false;
  return Boolean(row.reposicion_aplica);
};

export const hasPendingReposicion = (row) => {
  if (!isApprovedRequest(row) || !isDiligenciaPersonalRow(row) || row?.reposicion_estado === 'cumplida') return false;
  const total = Number(row?.reposicion_minutos || row?.tiempo_solicitado_minutos || 0);
  const paid = Number(row?.reposicion_minutos_pagados || row?.datos_formulario?.reposicion_minutos_pagados || 0);
  if (total > 0 && paid >= total) return false;
  return total - paid > 0;
};

export const hasValidatedReposicion = (row) => {
  if (!isApprovedRequest(row) || !isDiligenciaPersonalRow(row)) return false;
  if (row?.reposicion_estado === 'cumplida') return true;
  const total = Number(row?.reposicion_minutos || row?.tiempo_solicitado_minutos || 0);
  const paid = Number(row?.reposicion_minutos_pagados || row?.datos_formulario?.reposicion_minutos_pagados || 0);
  return total > 0 && paid >= total;
};

export const computeReporteSalidaSummary = (rows = []) => {
  const list = Array.isArray(rows) ? rows : [];
  return {
    total: list.length,
    pendientes: list.filter(isPendingRequest).length,
    personales: list.filter(hasPendingReposicion).length,
    reposicionesValidadas: list.filter(hasValidatedReposicion).length,
    finalizadas: list.filter(isApprovedRequest).length,
    rechazadas: list.filter(isRejectedRequest).length
  };
};

export const filterRowsByCardFilter = (rows = [], cardFilter = 'todas') => {
  const list = Array.isArray(rows) ? rows : [];
  if (cardFilter === 'pendientes') return list.filter(isPendingRequest);
  if (cardFilter === 'personales') return list.filter(hasPendingReposicion);
  if (cardFilter === 'reposicionesValidadas') return list.filter(hasValidatedReposicion);
  if (cardFilter === 'finalizadas') return list.filter(isApprovedRequest);
  return list;
};

export const matchesSegmentoFilter = (row, segmentoFiltro = '') => {
  if (!segmentoFiltro) return true;
  const rowCat = String(row?.datos_formulario?.salida?.categoria || row?.datos_formulario?.salida?.category || '').toLowerCase();
  const tipo = String(row?.datos_formulario?.salida?.tipo || '').toLowerCase();

  if (segmentoFiltro === 'salud') {
    if (rowCat === 'salud') return true;
    return ['cita_eps', 'cita_particular', 'cita_medica_laboral', 'terapias', 'urgencia_medica'].includes(tipo);
  }

  if (segmentoFiltro === 'personales') {
    if (rowCat === 'personales') return true;
    return ['diligencia_personal', 'calamidad', 'jurado_votacion', 'sufragante', 'voto_jurado', 'voto_sufragante'].includes(tipo)
      || tipo.startsWith('otra_personal:')
      || (tipo.startsWith('otra:') && rowCat === 'personales');
  }

  if (segmentoFiltro === 'institucionales' || segmentoFiltro === 'propias_cargo') {
    if (rowCat === 'propias_cargo') return true;
    return [
      'reunion_institucional',
      'evento_institucional',
      'ponencia',
      'visita_ies',
      'salida_campus',
      'practica_academica',
      'trabajo_campo',
      'asistente_congreso',
      'capacitacion',
      'proyecto_investigacion',
      'proyeccion_social',
      'torneo_deportivo',
      'practica_integral_movilidad'
    ].includes(tipo)
      || tipo.startsWith('otra_misional:')
      || (tipo.startsWith('otra:') && rowCat !== 'personales');
  }

  return tipo === segmentoFiltro;
};

export const formatBogotaDateKey = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value || '';
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  return year && month && day ? `${year}-${month}-${day}` : '';
};

export const parseDateKey = (key) => {
  const [year, month, day] = String(key || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

export const addDaysToKey = (key, days) => {
  const date = parseDateKey(key);
  if (!date) return '';
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
};

export const getTodayBogotaKey = () => formatBogotaDateKey(new Date());

export const getRadicacionDateKey = (row) => {
  const traceRadicacion = Array.isArray(row?.trazabilidad)
    ? row.trazabilidad.find((trace) => String(trace?.event || '').toLowerCase().includes('radicacion'))
    : null;
  return formatBogotaDateKey(
    row?.created_at
    || row?.createdAt
    || row?.fecha_radicacion
    || traceRadicacion?.at
    || traceRadicacion?.fecha
    || traceRadicacion?.createdAt
  );
};

export const getRangeStartKey = (range) => {
  if (range === 'all') return '';
  const todayKey = getTodayBogotaKey();
  const days = range === 'weekly' ? 7 : 30;
  return addDaysToKey(todayKey, -(days - 1));
};

export const isDateInsideRange = (dateKey, range) => {
  if (!dateKey) return false;
  const todayKey = getTodayBogotaKey();
  if (dateKey > todayKey) return false;
  if (range === 'all') return true;
  const startKey = getRangeStartKey(range);
  return dateKey >= startKey && dateKey <= todayKey;
};

export const buildContinuousDailyChart = (dailyMap, startKey, endKey) => {
  const startDate = parseDateKey(startKey);
  const endDate = parseDateKey(endKey);
  if (!startDate || !endDate || startDate > endDate) return [];

  const chart = [];
  let cursor = startKey;
  while (parseDateKey(cursor) <= endDate) {
    chart.push(dailyMap[cursor] || { date: cursor, solicitudes: 0 });
    cursor = addDaysToKey(cursor, 1);
  }
  return chart;
};

export const formatShortSpanishDate = (dateKey) => {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(dateKey || '');
  const monthIndex = Number(match[2]) - 1;
  const monthName = SHORT_SPANISH_MONTHS[monthIndex];
  if (!monthName) return String(dateKey || '');
  return `${Number(match[3])} ${monthName} ${match[1]}`;
};
