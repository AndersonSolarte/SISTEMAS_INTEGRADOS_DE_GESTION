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

const validateAdministrativeActDate = ({ startsOn, approvedOn }) => {
  if (approvedOn === null || approvedOn === undefined || approvedOn === '') return;
  if (!isValidIsoDate(approvedOn)) {
    throw Object.assign(new Error('Seleccione una fecha válida para el acto administrativo.'), { statusCode: 422 });
  }
  if (!isValidIsoDate(startsOn)) {
    throw Object.assign(new Error('Seleccione primero una fecha inicial válida para el PED.'), { statusCode: 422 });
  }
  if (String(approvedOn) < String(startsOn)) {
    throw Object.assign(new Error('La fecha del acto administrativo no puede ser anterior a la fecha inicial del PED.'), { statusCode: 422 });
  }
};

module.exports = { isValidIsoDate, validateAdministrativeActDate };
