function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\u00a0/g, ' ');
}

function toIsoDate(value) {
  if (!value) return null;
  const normalized = String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const compactMatch = normalized.match(/^(\d{2})(\d{2})(\d{4})$/);
  let day;
  let month;
  let year;
  if (isoMatch) {
    [, year, month, day] = isoMatch;
  } else if (compactMatch) {
    [, day, month, year] = compactMatch;
  } else {
    [, day, month, year] = normalized.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/) || [];
  }
  if (!day) {
    const months = {
      ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
      JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, SETIEMBRE: 9, OCTUBRE: 10,
      NOVIEMBRE: 11, DICIEMBRE: 12
    };
    const dayFirst = normalized.match(/(\d{1,2})\s+(?:DE\s+)?([A-Z]+)\s+(?:DE\s+)?(\d{4})/);
    const monthFirst = normalized.match(/([A-Z]+)\s+(\d{1,2})\s+(?:DE\s+)?(\d{4})/);
    if (dayFirst && months[dayFirst[2]]) {
      day = dayFirst[1]; month = months[dayFirst[2]]; year = dayFirst[3];
    } else if (monthFirst && months[monthFirst[1]]) {
      day = monthFirst[2]; month = months[monthFirst[1]]; year = monthFirst[3];
    }
  }
  if (!day || !month || !year) return null;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (parsed.getUTCFullYear() !== Number(year)
    || parsed.getUTCMonth() !== Number(month) - 1
    || parsed.getUTCDate() !== Number(day)) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function registrationYear(value) {
  const match = String(value || '').replace(/\s/g, '').toUpperCase().match(/^EKA?(\d{4})/);
  return match ? Number(match[1]) : null;
}

function validateRegistrationDate(registrationNumber, value) {
  const examDate = toIsoDate(value);
  const expectedYear = registrationYear(registrationNumber);
  const actualYear = examDate ? Number(examDate.slice(0, 4)) : null;
  return {
    examDate,
    expectedYear,
    actualYear,
    valid: Boolean(examDate && expectedYear && actualYear === expectedYear)
  };
}

function textContainsIdentification(text, identification) {
  if (!/^\d{5,20}$/.test(identification)) return false;
  return String(text || '').split(/\n/).some((line) =>
    line.replace(/\D/g, '').includes(identification));
}

function parseEvaluatedData(rawText, hints = {}) {
  const text = normalizeText(rawText);
  const detectedRegistration = firstMatch(text, [
    /n[uú]mero\s+de\s+registro\s*:?\s*(EKA?\s*\d{8,})/iu,
    /registro\s+n(?:[.\s]*[°ºo])?\s*:?\s*(EKA?\s*\d{8,})/iu,
    /\b(EKA?\s*\d{8,})\b/iu
  ])?.replace(/\s/g, '').toUpperCase() || null;
  const hintedRegistration = String(hints.registrationNumber || '').replace(/\s/g, '').toUpperCase();
  const registrationNumber = /^EKA?\d{8,}$/.test(hintedRegistration)
    ? hintedRegistration : detectedRegistration;

  let identification = firstMatch(text, [
    /identificaci[oó]n\s*:?\s*(?:C\.?[ \t]*C\.?|C[ÉE]DULA(?:[ \t]+DE[ \t]+CIUDADAN[IÍ]A)?)?[ \t]*([0-9][0-9. \t]{5,14})/iu,
    /(?:c[eé]dula[ \t]+de[ \t]+ciudadan[ií]a|documento)[ \t]*:?[ \t]*(?:\n[ \t]*)?([0-9][0-9. \t]{5,14})/iu,
    /\bC\.?[ \t]*C\.?[ \t]*:?[ \t]*([0-9][0-9. \t]{5,14})/iu
  ]);
  if (identification) identification = identification.replace(/\D/g, '');
  const expectedIdentification = String(hints.identification || '').replace(/\D/g, '');
  const expectedIdentificationRead = textContainsIdentification(text, expectedIdentification);
  if (expectedIdentificationRead) identification = expectedIdentification;
  const identificationMismatch = Boolean(identification && /^\d{5,20}$/.test(expectedIdentification)
    && identification !== expectedIdentification);

  const dateText = firstMatch(text, [
    /fecha\s+de\s+presentaci[oó]n\s+del\s+examen\s+y\s+expedici[oó]n\s+del\s+certificado\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/iu,
    /aplicaci[oó]n\s+del\s+examen\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/iu,
    /fecha\s+de\s+presentaci[oó]n\s+del\s+examen\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/iu,
    /fecha\s+de\s+aplicaci[oó]n\s*:?\s*(\d{1,2}\s+(?:de\s+)?[a-záéíóúñ]+\s+(?:de\s+)?\d{4})/iu,
    /aplicaci[oó]n\s+del\s+examen\s*:?\s*(\d{1,2}\s+(?:de\s+)?[a-záéíóúñ]+\s+(?:de\s+)?\d{4})/iu,
    /fecha\s+de\s+presentaci[oó]n(?:\s+del\s+examen)?\s*:?\s*(\d{1,2}\s+(?:de\s+)?[a-záéíóúñ]+\s+(?:de\s+)?\d{4})/iu,
    /fecha\s+de(?:l)?\s+examen\s*:?\s*([a-záéíóúñ]+\s+\d{1,2}\s+(?:de\s+)?\d{4})/iu,
    /fecha\s+de(?:l)?\s+examen\s*:?\s*(\d{1,2}\s+(?:de\s+)?[a-záéíóúñ]+\s+(?:de\s+)?\d{4})/iu,
    /fecha\s+de(?:l)?\s+examen\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/iu,
    /(?<!\d)(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})(?!\d)/u
  ]);

  const compactDateText = firstMatch(text, [
    /fecha\s+de\s+presentaci\S+[\s\S]{0,140}?certificado[\s\S]{0,120}?(\d{8})(?!\d)/iu
  ]);
  const dateValidation = validateRegistrationDate(registrationNumber, dateText || compactDateText);
  const parsedExamDate = dateValidation.examDate;
  const expectedYear = dateValidation.expectedYear;
  const dateYearMismatch = Boolean(parsedExamDate && expectedYear && !dateValidation.valid);
  const examDate = dateValidation.valid ? parsedExamDate : null;
  const missingFields = [];
  if (!registrationNumber) missingFields.push('Número de registro');
  if (!examDate) missingFields.push(dateYearMismatch
    ? `Fecha del examen (debe corresponder al año ${expectedYear} del EK)`
    : 'Fecha de presentación');
  if (!identification) missingFields.push('Cédula no legible en el PDF');
  else if (identificationMismatch) {
    missingFields.push(`La cédula leída en el PDF (${identification}) no coincide con la cédula consultada (${expectedIdentification})`);
  }
  return {
    registrationNumber,
    examDate,
    identification,
    expectedIdentification: expectedIdentification || null,
    expectedIdentificationRead,
    identificationMismatch,
    complete: missingFields.length === 0,
    missingFields
  };
}

function toDisplayDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

module.exports = {
  normalizeText, parseEvaluatedData, toIsoDate, toDisplayDate, registrationYear,
  validateRegistrationDate
};
