const RTM_RULES = Object.freeze({
  MOTO: Object.freeze({ firstReviewYears: 2, renewalYears: 1 }),
  CARRO_PARTICULAR: Object.freeze({ firstReviewYears: 5, renewalYears: 1 }),
  VEHICULO_PUBLICO: Object.freeze({ firstReviewYears: 2, renewalYears: 1 })
});

const MOTO_CLASSES = Object.freeze(['MOTOCICLETA', 'MOTOCICLO', 'MOTOTRICICLO', 'CUATRIMOTO', 'CICLOMOTOR', 'TRICIMOTO']);
const TRANSITION_RULES = Object.freeze([
  Object.freeze({ type: 'CARRO_PARTICULAR', from: '2017-05-20', to: '2018-05-19', firstReviewYears: 6 })
]);

const normalize = (value = '') => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

// Suma años calendario conservando el mes y limitando el día al último válido (29/02 -> 28/02).
const addCalendarYears = (isoDate, years) => {
  if (!isIsoDate(isoDate)) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year + years, month, 0)).getUTCDate();
  const result = new Date(Date.UTC(year + years, month - 1, Math.min(day, lastDay)));
  return Number.isNaN(result.getTime()) ? null : result.toISOString().slice(0, 10);
};

const resolveVehicleRule = ({ vehicleClass, service }) => {
  const normalizedClass = normalize(vehicleClass);
  const normalizedService = normalize(service);
  if (MOTO_CLASSES.some((type) => normalizedClass.includes(type))) return { key: 'MOTO', ...RTM_RULES.MOTO };
  if (normalizedService.includes('PUBLICO')) return { key: 'VEHICULO_PUBLICO', ...RTM_RULES.VEHICULO_PUBLICO };
  return { key: 'CARRO_PARTICULAR', ...RTM_RULES.CARRO_PARTICULAR };
};

const firstRtmDueDate = ({ registrationDate, vehicleClass, service }) => {
  if (!isIsoDate(registrationDate)) return null;
  const rule = resolveVehicleRule({ vehicleClass, service });
  const transition = TRANSITION_RULES.find((item) => item.type === rule.key && registrationDate >= item.from && registrationDate <= item.to);
  return addCalendarYears(registrationDate, transition?.firstReviewYears ?? rule.firstReviewYears);
};

const evaluateRtmStatus = ({ registrationDate, vehicleClass, service, latestCertificateExpiry, asOfDate }) => {
  const today = isIsoDate(asOfDate) ? asOfDate : new Date().toISOString().slice(0, 10);
  const firstDueDate = firstRtmDueDate({ registrationDate, vehicleClass, service });
  const rule = resolveVehicleRule({ vehicleClass, service });

  // Después de la primera revisión manda la vigencia real del certificado RUNT, no un ciclo teórico.
  if (isIsoDate(latestCertificateExpiry)) return {
    status: latestCertificateExpiry < today ? 'VENCIDO' : 'VIGENTE',
    dueDate: latestCertificateExpiry, firstDueDate, ruleKey: rule.key, source: 'CERTIFICADO_RUNT'
  };
  if (!firstDueDate) return { status: 'SIN_DATOS_PARA_CALCULAR', dueDate: null, firstDueDate: null, ruleKey: rule.key, source: 'RUNT_SIN_REGISTRO' };
  return {
    status: today < firstDueDate ? 'NO_EXIGIBLE' : 'SIN_REGISTRO_RUNT',
    dueDate: firstDueDate, firstDueDate, ruleKey: rule.key, source: 'CALCULO_PRIMERA_REVISION'
  };
};

module.exports = { RTM_RULES, TRANSITION_RULES, addCalendarYears, resolveVehicleRule, firstRtmDueDate, evaluateRtmStatus };
