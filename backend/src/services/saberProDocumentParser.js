function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\u00a0/g, ' ');
}

function toIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const normalized = String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const compactMatch = normalized.match(/^(\d{2})(\d{2})(\d{4})$/);
  const missingDaySeparatorMatch = normalized.match(/^(\d{2})(\d{2})[\/-](\d{4})$/);
  const missingYearSeparatorMatch = normalized.match(/^(\d{2})[\/-](\d{2})(\d{4})$/);
  let day;
  let month;
  let year;
  if (isoMatch) {
    [, year, month, day] = isoMatch;
  } else if (compactMatch) {
    [, day, month, year] = compactMatch;
  } else if (missingDaySeparatorMatch) {
    [, day, month, year] = missingDaySeparatorMatch;
  } else if (missingYearSeparatorMatch) {
    [, day, month, year] = missingYearSeparatorMatch;
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
  const match = String(value || '').replace(/\s/g, '').toUpperCase().match(/^EK(\d{4})\d{8}$/);
  return match ? Number(match[1]) : null;
}

function isValidRegistrationNumber(value) {
  return /^EK\d{12}$/.test(String(value || '').replace(/\s/g, '').toUpperCase());
}

function differsByAtMostOneEdit(leftValue, rightValue) {
  const left = String(leftValue || '');
  const right = String(rightValue || '');
  if (Math.abs(left.length - right.length) > 1) return false;
  if (left.length === right.length) {
    let differences = 0;
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) differences += 1;
      if (differences > 1) return false;
    }
    return true;
  }
  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  let shortIndex = 0;
  let longIndex = 0;
  let skipped = false;
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
    } else if (!skipped) {
      skipped = true;
      longIndex += 1;
    } else {
      return false;
    }
  }
  return true;
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
  const source = String(text || '');
  const separatedDigits = identification.split('').join('[\\s.\\-_|:]*');
  if (new RegExp(separatedDigits).test(source)) return true;

  // En certificados escaneados en columnas, Tesseract suele confundir 0/O,
  // 1/I o 5/S. Solo aplicamos esta tolerancia cerca del rótulo del documento
  // y siempre contra la identificación esperada de la BD institucional.
  const searchable = source
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  const labelPattern = /(?:NUMERO\s+DE\s+(?:DOCUMENTO|IDENTIFICACION)|IDENTIFICACION|CEDULA)/g;
  const digitAlternatives = {
    0: '[0OQD]', 1: '[1IL|]', 2: '[2Z]', 3: '3', 4: '4',
    5: '[5S]', 6: '[6G]', 7: '7', 8: '[8B]', 9: '9'
  };
  const tolerantExpected = identification
    .split('')
    .map((digit) => digitAlternatives[digit])
    .join('[\\s.\\-_|:]*');
  const tolerantPattern = new RegExp(tolerantExpected);
  let labelMatch;
  while ((labelMatch = labelPattern.exec(searchable)) !== null) {
    const nearbyText = searchable.slice(labelMatch.index, labelMatch.index + 260);
    if (tolerantPattern.test(nearbyText)) return true;
  }
  return false;
}

function toDisplayDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function parseEvaluatedData(rawText, hints = {}) {
  const text = normalizeText(rawText);
  const hintedRegistration = String(hints.registrationNumber || '').replace(/\s/g, '').toUpperCase();
  const expectedRegistrationNumber = hintedRegistration || null;
  const hintedIdentification = String(hints.identification || '').replace(/\D/g, '');
  const hintedIdentificationRead = textContainsIdentification(text, hintedIdentification);
  const rawRegistrationCandidates = [...text.matchAll(/\b(EKA?\s*\d{8,})\b/giu)]
    .map((match) => match[1].replace(/\s/g, '').toUpperCase());
  const supportedExpectedRegistration = hintedIdentificationRead
    && isValidRegistrationNumber(expectedRegistrationNumber)
    && rawRegistrationCandidates.some((candidate) => differsByAtMostOneEdit(candidate, expectedRegistrationNumber));
  const detectedRegistration = (supportedExpectedRegistration ? expectedRegistrationNumber : null) || firstMatch(text, [
    /n[uú]mero\s+de\s+registro\s*:?\s*(EKA?\s*\d{8,})/iu,
    /registro\s+n(?:[.\s]*[°ºo])?\s*:?\s*(EKA?\s*\d{8,})/iu,
    /\b(EKA?\s*\d{8,})\b/iu
  ])?.replace(/\s/g, '').toUpperCase() || null;
  const registrationNumber = detectedRegistration;
  const registrationMatches = Boolean(
    registrationNumber && isValidRegistrationNumber(registrationNumber)
    && expectedRegistrationNumber && registrationNumber === expectedRegistrationNumber
  );
  const registrationMismatch = Boolean(!registrationMatches);

  let identification = firstMatch(text, [
    /(?:tipo\s+y\s+n[uú]mero\s+de\s+documento|n[uú]mero\s+de\s+(?:documento|identificaci[oó]n)|documento\s+de\s+identidad|identificaci[oó]n|c[eé]dula(?:\s+de\s+ciudadan[ií]a)?|documento)[ \t]*:?[ \t]*(?:\n[ \t]*)?(?:(?:C\.?[ \t]*C\.?|T\.?[ \t]*I\.?|C\.?[ \t]*E\.?|P\.?[ \t]*E\.?[ \t]*P\.?|P\.?[ \t]*P\.?[ \t]*T\.?|P\.?[ \t]*A\.?|C[ÉE]DULA(?:[ \t]+DE[ \t]+CIUDADAN[IÍ]A|[ \t]+DE[ \t]+EXTRANJER[IÍ]A)?|TARJETA(?:[ \t]+DE[ \t]+IDENTIDAD)?)[ \t:.-]*)?([0-9][0-9. \t]{5,14})/iu,
    /\b(?:C\.?[ \t]*C\.?|T\.?[ \t]*I\.?|C\.?[ \t]*E\.?)[ \t]*:?[ \t]*([0-9][0-9. \t]{5,14})/iu
  ]);
  if (identification) identification = identification.replace(/\D/g, '');
  const expectedIdentification = hintedIdentification;
  const expectedIdentificationRead = hintedIdentificationRead;
  if (expectedIdentificationRead) identification = expectedIdentification;
  const identificationMatches = Boolean(
    identification && /^\d{5,20}$/.test(expectedIdentification) && identification === expectedIdentification
  );
  const identificationMismatch = Boolean(!identificationMatches);

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
  // Los reportes incluyen fecha del examen y fecha de publicación. OCR puede
  // perder un separador en la primera (p. ej. 3110/2021). Entre todas las
  // fechas leídas se prioriza la que pertenece al año codificado en el EK.
  const expectedRegistrationYear = registrationYear(registrationNumber);
  const numericDateCandidates = text.match(
    /(?<!\d)(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\d{4}[\/-]\d{4}|\d{2}[\/-]\d{6}|\d{8})(?!\d)/gu
  ) || [];
  const yearMatchingDate = numericDateCandidates.find(
    (value) => toIsoDate(value)?.startsWith(`${expectedRegistrationYear}-`)
  );
  const labeledDate = toIsoDate(dateText);
  const selectedDateText = labeledDate?.startsWith(`${expectedRegistrationYear}-`)
    ? dateText
    : yearMatchingDate || dateText || compactDateText;
  const dateValidation = validateRegistrationDate(registrationNumber, selectedDateText);
  const parsedExamDate = dateValidation.examDate;
  const expectedYear = dateValidation.expectedYear;
  const dateYearMismatch = Boolean(parsedExamDate && expectedYear && !dateValidation.valid);
  const examDate = parsedExamDate;
  const expectedExamDate = toIsoDate(hints.examDate);
  const examDateMatches = Boolean(
    examDate && expectedExamDate && examDate === expectedExamDate && !dateYearMismatch
  );
  const examDateMismatch = Boolean(!examDateMatches);

  const missingFields = [];
  if (!identification) {
    missingFields.push(`No se pudo leer el número de documento en el PDF (numero_identificacion BD: ${expectedIdentification || 'sin dato'})`);
  } else if (!expectedIdentification) {
    missingFields.push(`Documento leído en PDF (${identification}) sin numero_identificacion en BD`);
  } else if (identification !== expectedIdentification) {
    missingFields.push(`El documento leído en el PDF (${identification}) no coincide con numero_identificacion en BD (${expectedIdentification})`);
  }

  if (!registrationNumber) {
    missingFields.push(`No se pudo leer el código EK en el PDF (codigo_ek BD: ${expectedRegistrationNumber || 'sin dato'})`);
  } else if (!isValidRegistrationNumber(registrationNumber)) {
    missingFields.push(`El código EK leído en el PDF (${registrationNumber}) es inválido: debe tener exactamente 14 caracteres (EK y 12 dígitos)`);
  } else if (!expectedRegistrationNumber) {
    missingFields.push(`El EK leído en el PDF (${registrationNumber}) no coincide con codigo_ek en BD (sin dato)`);
  } else if (registrationNumber !== expectedRegistrationNumber) {
    missingFields.push(`El EK leído en el PDF (${registrationNumber}) no coincide con codigo_ek en BD (${expectedRegistrationNumber})`);
  }

  if (!examDate) {
    missingFields.push(`No se pudo leer la fecha en el PDF (fecha_presentacion_ek BD: ${toDisplayDate(expectedExamDate) || 'sin dato'})`);
  } else if (dateYearMismatch) {
    missingFields.push(`La fecha leída en el PDF (${toDisplayDate(examDate)}) no corresponde al año ${expectedYear} del código EK (${registrationNumber})`);
  } else if (!expectedExamDate) {
    missingFields.push(`La fecha leída en el PDF (${toDisplayDate(examDate)}) no coincide con fecha_presentacion_ek en BD (sin dato)`);
  } else if (examDate !== expectedExamDate) {
    missingFields.push(`La fecha leída en el PDF (${toDisplayDate(examDate)}) no coincide con fecha_presentacion_ek en BD (${toDisplayDate(expectedExamDate)})`);
  }

  return {
    registrationNumber,
    expectedRegistrationNumber,
    registrationMatches,
    registrationMismatch,
    examDate,
    expectedExamDate,
    examDateMatches,
    examDateMismatch,
    dateYearMismatch,
    identification,
    expectedIdentification: expectedIdentification || null,
    expectedIdentificationRead,
    identificationMatches,
    identificationMismatch,
    readComplete: Boolean(isValidRegistrationNumber(registrationNumber) && dateValidation.valid && identification),
    complete: missingFields.length === 0,
    missingFields
  };
}

module.exports = {
  normalizeText,
  parseEvaluatedData,
  toIsoDate,
  toDisplayDate,
  registrationYear,
  isValidRegistrationNumber,
  validateRegistrationDate
};
