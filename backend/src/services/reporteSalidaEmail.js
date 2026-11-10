// Política exclusiva de salidas y desplazamientos; no altera otros módulos.
const OFFICE_EMAIL = 'viceinvestiga@unicesmag.edu.co';
const JAVIER_EMAIL = 'jajimenez@unicesmag.edu.co';

const routeSalidaRecipients = (recipients) => {
  const values = (Array.isArray(recipients) ? recipients : [recipients])
    .flatMap((value) => String(value || '').split(/[;,]/))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .map((value) => value === OFFICE_EMAIL ? JAVIER_EMAIL : value);
  return [...new Set(values)];
};

const sendInstitutionalEmail = (options) => {
  const recipients = routeSalidaRecipients(options.to);
  return require('./emailService').sendInstitutionalEmail({
    ...options,
    to: typeof options.to === 'string' && recipients.length === 1 ? recipients[0] : recipients
  });
};

module.exports = { routeSalidaRecipients, sendInstitutionalEmail };
