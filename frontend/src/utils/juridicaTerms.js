// Utilidad de cálculo de términos legales y festivos en Colombia (Ley Emiliani / Ley 1755 de 2015)

const holidayCache = {};

function getEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function nextMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 1) return d;
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

const pad = (n) => String(n).padStart(2, '0');
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function getColombianHolidays(year) {
  if (holidayCache[year]) return holidayCache[year];
  const holidays = new Set();

  // Festivos fijos
  holidays.add(`${year}-01-01`); // Año Nuevo
  holidays.add(`${year}-05-01`); // Día del Trabajo
  holidays.add(`${year}-07-20`); // Independencia
  holidays.add(`${year}-08-07`); // Batalla de Boyacá
  holidays.add(`${year}-12-08`); // Inmaculada Concepción
  holidays.add(`${year}-12-25`); // Navidad

  // Ley Emiliani (se trasladan al siguiente lunes)
  holidays.add(toYMD(nextMonday(new Date(year, 0, 6)))); // Reyes Magos
  holidays.add(toYMD(nextMonday(new Date(year, 2, 19)))); // San José
  holidays.add(toYMD(nextMonday(new Date(year, 5, 29)))); // San Pedro y San Pablo
  holidays.add(toYMD(nextMonday(new Date(year, 7, 15)))); // Asunción de la Virgen
  holidays.add(toYMD(nextMonday(new Date(year, 9, 12)))); // Día de la Raza
  holidays.add(toYMD(nextMonday(new Date(year, 10, 1)))); // Todos los Santos
  holidays.add(toYMD(nextMonday(new Date(year, 10, 11)))); // Independencia de Cartagena

  // Fiestas basadas en Pascua
  const easter = getEaster(year);
  const addDays = (base, n) => {
    const r = new Date(base);
    r.setDate(r.getDate() + n);
    return r;
  };

  holidays.add(toYMD(addDays(easter, -3))); // Jueves Santo
  holidays.add(toYMD(addDays(easter, -2))); // Viernes Santo
  holidays.add(toYMD(nextMonday(addDays(easter, 40)))); // Ascensión (43 días)
  holidays.add(toYMD(nextMonday(addDays(easter, 60)))); // Corpus Christi
  holidays.add(toYMD(nextMonday(addDays(easter, 68)))); // Sagrado Corazón

  holidayCache[year] = holidays;
  return holidays;
}

export function isHoliday(date) {
  const y = date.getFullYear();
  const holidays = getColombianHolidays(y);
  return holidays.has(toYMD(date));
}

export function isBusinessDay(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // Sábado o Domingo
  return !isHoliday(date);
}

/**
 * Añade N días hábiles a una fecha dada (excluyendo fines de semana y festivos de Colombia)
 */
export function addBusinessDays(startDateStr, numDays) {
  if (!startDateStr || !numDays) return startDateStr;
  const parts = String(startDateStr).slice(0, 10).split('-').map(Number);
  const cur = new Date(parts[0], parts[1] - 1, parts[2]);
  let added = 0;
  while (added < Number(numDays)) {
    cur.setDate(cur.getDate() + 1);
    if (isBusinessDay(cur)) {
      added++;
    }
  }
  return toYMD(cur);
}

/**
 * Añade N días calendario
 */
export function addCalendarDays(startDateStr, numDays) {
  if (!startDateStr || !numDays) return startDateStr;
  const parts = String(startDateStr).slice(0, 10).split('-').map(Number);
  const cur = new Date(parts[0], parts[1] - 1, parts[2]);
  cur.setDate(cur.getDate() + Number(numDays));
  return toYMD(cur);
}

/**
 * Diferencia en días hábiles entre dos fechas (hoy vs fecha límite)
 * Si toDate es futuro -> resultado positivo
 * Si toDate es pasado -> resultado negativo
 */
export function diffBusinessDays(fromDate, toDate) {
  if (!fromDate || !toDate) return 0;
  const d1 = new Date(typeof fromDate === 'string' ? `${fromDate.slice(0, 10)}T00:00:00` : fromDate);
  const d2 = new Date(typeof toDate === 'string' ? `${toDate.slice(0, 10)}T00:00:00` : toDate);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);

  if (d1.getTime() === d2.getTime()) return 0;
  const isFuture = d2 > d1;
  const start = new Date(isFuture ? d1 : d2);
  const end = new Date(isFuture ? d2 : d1);

  let count = 0;
  const cur = new Date(start);
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    if (isBusinessDay(cur)) count++;
  }
  return isFuture ? count : -count;
}

/**
 * Diferencia en días calendario entre dos fechas
 */
export function diffCalendarDays(fromDate, toDate) {
  if (!fromDate || !toDate) return 0;
  const d1 = new Date(typeof fromDate === 'string' ? `${fromDate.slice(0, 10)}T00:00:00` : fromDate);
  const d2 = new Date(typeof toDate === 'string' ? `${toDate.slice(0, 10)}T00:00:00` : toDate);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * Calcula el estado de término y la alerta visual para un expediente
 */
export function getTermAlert(fechaLimite, estado, fechaIngreso) {
  const CLOSED = ['entregado', 'cerrado', 'cancelado'];
  if (CLOSED.includes(estado)) {
    return {
      status: 'finalizado',
      label: 'Atendido / Cerrado',
      badge: 'Cerrado',
      color: '#15803d',
      bg: '#f0fdf4',
      borderColor: '#bbf7d0',
      diffBusiness: null,
      diffCalendar: null,
      urgent: false
    };
  }

  if (!fechaLimite) {
    return {
      status: 'sin_limite',
      label: 'Sin término fijado',
      badge: 'Sin término',
      color: '#64748b',
      bg: '#f8fafc',
      borderColor: '#e2e8f0',
      diffBusiness: null,
      diffCalendar: null,
      urgent: false
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limitDate = new Date(`${String(fechaLimite).slice(0, 10)}T00:00:00`);
  const calDays = diffCalendarDays(today, limitDate);
  const busDays = diffBusinessDays(today, limitDate);

  if (calDays < 0) {
    const overdueDays = Math.abs(busDays);
    return {
      status: 'vencido',
      label: `Vencido (-${overdueDays} d.h.)`,
      badge: `Vencido (-${overdueDays}d)`,
      color: '#dc2626',
      bg: '#fef2f2',
      borderColor: '#fca5a5',
      diffBusiness: busDays,
      diffCalendar: calDays,
      urgent: true,
      severity: 'error',
      sublabel: `Venció el ${formatDateBrief(fechaLimite)}`
    };
  }

  if (calDays === 0) {
    return {
      status: 'vence_hoy',
      label: '¡Vence hoy!',
      badge: '¡Vence hoy!',
      color: '#ea580c',
      bg: '#fff7ed',
      borderColor: '#fdba74',
      diffBusiness: 0,
      diffCalendar: 0,
      urgent: true,
      severity: 'warning',
      sublabel: 'Término legal vence hoy'
    };
  }

  if (busDays <= 3) {
    return {
      status: 'urgente',
      label: `Urgente (${busDays} d.h.)`,
      badge: `${busDays} d.h. restantes`,
      color: '#ea580c',
      bg: '#fff7ed',
      borderColor: '#fdba74',
      diffBusiness: busDays,
      diffCalendar: calDays,
      urgent: true,
      severity: 'warning',
      sublabel: `Quedan ${busDays} días hábiles`
    };
  }

  if (busDays <= 5) {
    return {
      status: 'por_vencer',
      label: `Por vencer (${busDays} d.h.)`,
      badge: `${busDays} d.h. restantes`,
      color: '#d97706',
      bg: '#fffbeb',
      borderColor: '#fde047',
      diffBusiness: busDays,
      diffCalendar: calDays,
      urgent: true,
      severity: 'warning',
      sublabel: `Quedan ${busDays} días hábiles`
    };
  }

  return {
    status: 'en_termino',
    label: `En término (${busDays} d.h.)`,
    badge: `En término (${busDays}d)`,
    color: '#059669',
    bg: '#ecfdf5',
    borderColor: '#a7f3d0',
    diffBusiness: busDays,
    diffCalendar: calDays,
    urgent: false,
    severity: 'success',
    sublabel: `Plazo oportuno (${busDays} días hábiles)`
  };
}

export function formatDateBrief(dateStr) {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
    return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(y, m - 1, d));
  } catch (_) {
    return String(dateStr);
  }
}

export function formatDateDetailed(dateStr) {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
    return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
  } catch (_) {
    return String(dateStr);
  }
}

/**
 * Catálogo predeterminado de términos legales en Colombia (Ley 1755 de 2015, Decreto 2591 de 1991, CPACA)
 */
export const DERECHO_PETICION_PRESETS = [
  {
    key: 'peticion_documentos',
    label: '10 días hábiles',
    title: 'Información y documentos',
    rule: 'Ley 1755 de 2015, Art. 14 num. 1',
    days: 10,
    type: 'business',
    groupMatch: 'Derechos de petición',
    description: 'Peticiones de documentos y de información pública (expedición de copias, certificados o registros).'
  },
  {
    key: 'peticion_general',
    label: '15 días hábiles',
    title: 'Interés general o particular',
    rule: 'Ley 1755 de 2015, Art. 14 regla general',
    days: 15,
    type: 'business',
    groupMatch: 'Derechos de petición',
    description: 'Petición ordinaria en interés general o particular (solicitud de reconocimiento de un derecho, resolver una situación o prestación de servicio).'
  },
  {
    key: 'peticion_consulta',
    label: '30 días hábiles',
    title: 'Consultas jurídicas / Conceptos',
    rule: 'Ley 1755 de 2015, Art. 14 num. 3',
    days: 30,
    type: 'business',
    groupMatch: 'Derechos de petición',
    description: 'Peticiones mediante las cuales se eleva una consulta a la autoridad en relación con las materias a su cargo.'
  },
  {
    key: 'peticion_autoridades',
    label: '10 días hábiles',
    title: 'Entre autoridades / Entidades',
    rule: 'Ley 1755 de 2015, Art. 30',
    days: 10,
    type: 'business',
    groupMatch: 'Derechos de petición',
    description: 'Peticiones entre autoridades e instituciones públicas o de vigilancia y control.'
  },
  {
    key: 'tutela',
    label: '3 días hábiles',
    title: 'Acción de Tutela (Término judicial)',
    rule: 'Decreto 2591 de 1991',
    days: 3,
    type: 'business',
    groupMatch: 'Tutelas',
    description: 'Requerimientos y traslado de acciones de tutela por juzgados o tribunales.'
  },
  {
    key: 'requerimiento_control',
    label: '5 días hábiles',
    title: 'Requerimiento urgente de control',
    rule: 'Término de control institucional',
    days: 5,
    type: 'business',
    groupMatch: 'Requerimientos',
    description: 'Requerimientos con término perentorio de entes de control, auditorías o descargos.'
  }
];
