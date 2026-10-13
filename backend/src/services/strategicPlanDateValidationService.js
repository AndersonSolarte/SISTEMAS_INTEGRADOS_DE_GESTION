const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isValidIsoDate = (value) => {
  const text = String(value || '');
  if (!ISO_DATE.test(text)) return false;
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

const getMinAdministrativeActDate = (startsOn) => {
  if (!isValidIsoDate(startsOn)) return null;
  const startYear = Number(String(startsOn).slice(0, 4));
  return `${startYear - 2}-01-01`;
};

const validateAdministrativeActDate = ({ startsOn, approvedOn, endsOn }) => {
  if (approvedOn === null || approvedOn === undefined || approvedOn === '') return;
  if (!isValidIsoDate(approvedOn)) {
    throw Object.assign(new Error('Seleccione una fecha válida para el acto administrativo.'), { statusCode: 422 });
  }
  if (!isValidIsoDate(startsOn)) {
    throw Object.assign(new Error('Seleccione primero una fecha inicial válida para el PED.'), { statusCode: 422 });
  }
  const minApprovedOn = getMinAdministrativeActDate(startsOn);
  if (minApprovedOn && String(approvedOn) < minApprovedOn) {
    const startYear = Number(String(startsOn).slice(0, 4));
    throw Object.assign(new Error(`La fecha del acto administrativo no puede ser anterior al periodo previo de formulación (${startYear - 2}).`), { statusCode: 422 });
  }
  if (endsOn && isValidIsoDate(endsOn) && String(approvedOn) > String(endsOn)) {
    throw Object.assign(new Error('La fecha del acto administrativo no puede ser posterior a la fecha final del PED.'), { statusCode: 422 });
  }
};

module.exports = { isValidIsoDate, getMinAdministrativeActDate, validateAdministrativeActDate };
