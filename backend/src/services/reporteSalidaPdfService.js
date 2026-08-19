const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const JSZip = require('jszip');
const { getReporteSalidaTemplatePath } = require('../config/reporteSalidaConfig');

const execFileAsync = promisify(execFile);
const DEFAULT_DECLARACION_SIN_ADJUNTO_SALUD = 'Declaro que al momento de radicar esta solicitud no cuento con archivos adjuntos o soportes para cargar en el sistema. Entiendo que la Oficina de Gestión del Talento Humano y/o Seguridad y Salud en el Trabajo podran requerir en cualquier momento los soportes correspondientes; por tanto, me comprometo a conservarlos despues de la atencion o tramite y a suministrarlos oportunamente cuando sean solicitados.';
const SST_RESPONSABLE_NOMBRE = 'ANGIE MELISSA MUÑOZ RODRIGUEZ';
const SST_RESPONSABLE_CARGO = 'Jefe de Gestion de Riesgos y Ambiente, Oficina de Seguridad y Salud en el Trabajo';

const getDeclaracionSinAdjunto = (salida = {}) =>
  salida.noCuentaAdjunto
    ? (salida.declaracionSinAdjunto || DEFAULT_DECLARACION_SIN_ADJUNTO_SALUD)
    : '';

const escapePdfText = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ');

const escapeXmlText = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const stripAccents = (value) =>
  String(value ?? '')
    .replace(/ñ/g, '__enie_min__')
    .replace(/Ñ/g, '__enie_may__')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/__enie_min__/g, 'ñ')
    .replace(/__enie_may__/g, 'Ñ');

const getTraceList = (solicitud = {}) => {
  const raw = solicitud.trazabilidad;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
};

const getTraceByEvents = (solicitud = {}, events = []) => {
  const traces = getTraceList(solicitud);
  return [...traces].reverse().find((trace) => events.includes(trace.event)) || null;
};

const getInitialApprovalTrace = (solicitud = {}) =>
  getTraceByEvents(solicitud, [
    'aprobada_dependencia',
    'visto_bueno_dependencia',
    'aprobada_jefe',
    'visto_bueno_jefe'
  ]);

const getDateCandidate = (solicitud = {}, fields = []) => {
  for (const field of fields) {
    const value = solicitud[field];
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return value;
  }
  return null;
};

const getTraceDate = (solicitud = {}, events = []) => {
  const trace = getTraceByEvents(solicitud, events);
  if (!trace?.at) return null;
  const date = new Date(trace.at);
  return Number.isNaN(date.getTime()) ? null : trace.at;
};

const getStageDate = (solicitud = {}, fields = [], events = []) =>
  getTraceDate(solicitud, events) || getDateCandidate(solicitud, fields);

const getSolicitudCreatedAt = (solicitud = {}) =>
  getTraceDate(solicitud, ['radicada', 'radicada_grupal'])
  || getDateCandidate(solicitud, ['createdAt', 'created_at', 'fecha_radicacion', 'radicado_at'])
  || new Date();

const getInitialApprovalPdfInfo = (solicitud = {}) => {
  const trace = getInitialApprovalTrace(solicitud);
  const actor = trace?.actor || {};
  const viaDependencia = ['aprobada_dependencia', 'visto_bueno_dependencia'].includes(trace?.event);
  const jefe = solicitud.jefe_snapshot || {};
  return {
    name: viaDependencia ? (actor.nombre || 'Dependencia') : (jefe.nombre || actor.nombre || ''),
    cargo: viaDependencia ? (actor.cargo || 'Dependencia') : (jefe.cargo || actor.cargo || ''),
    email: viaDependencia ? (actor.email || '') : '',
    viaDependencia,
    header: viaDependencia ? 'Autorizacion por Dependencia' : 'Autorizacion del Jefe inmediato',
    signed: Boolean(trace),
    dateValue: trace?.at || null
  };
};

const repairMojibakeText = (value) => {
  let text = String(value ?? '');
  if (!text) return text;

  const repairCommonWords = (input) => String(input)
    .replace(/\bInvestigacin\b/g, 'Investigacion')
    .replace(/\binvestigacin\b/g, 'investigacion')
    .replace(/\bMedelln\b/g, 'Medellin')
    .replace(/\bInformacin\b/g, 'Informacion')
    .replace(/\binformacin\b/g, 'informacion')
    .replace(/\bGestin\b/g, 'Gestion')
    .replace(/\bgestin\b/g, 'gestion')
    .replace(/\bRadicacin\b/g, 'Radicacion')
    .replace(/\bradicacin\b/g, 'radicacion')
    .replace(/\bAprobacin\b/g, 'Aprobacion')
    .replace(/\baprobacin\b/g, 'aprobacion')
    .replace(/\bRevisin\b/g, 'Revision')
    .replace(/\brevisin\b/g, 'revision')
    .replace(/\bAutorizacin\b/g, 'Autorizacion')
    .replace(/\bautorizacin\b/g, 'autorizacion')
    .replace(/\bAtencin\b/g, 'Atencion')
    .replace(/\batencin\b/g, 'atencion')
    .replace(/\bTrmite\b/g, 'Tramite')
    .replace(/\btrmite\b/g, 'tramite')
    .replace(/\bTransaccin\b/g, 'Transaccion')
    .replace(/\btransaccin\b/g, 'transaccion')
    .replace(/\bVerificacin\b/g, 'Verificacion')
    .replace(/\bverificacin\b/g, 'verificacion');
  const toPdfAscii = (input) => repairCommonWords(stripAccents(input).replace(/[^\x00-\x7FñÑ]/g, ''));
  const hasMojibake = /[ÃÂâï¿½]|�/.test(text);
  if (!hasMojibake) return toPdfAscii(text);

  for (let i = 0; i < 3; i += 1) {
    try {
      const repaired = Buffer.from(text, 'latin1').toString('utf8');
      if (repaired === text) break;
      text = repaired;
    } catch (_) {
      break;
    }
  }

  text = text
    .replace(/Ã¡|ÃƒÂ¡/g, 'a').replace(/Ã©|ÃƒÂ©/g, 'e').replace(/Ã­|ÃƒÂ­/g, 'i').replace(/Ã³|ÃƒÂ³/g, 'o').replace(/Ãº|ÃƒÂº/g, 'u')
    .replace(/Ã|ÃƒÂ/g, 'A').replace(/Ã‰|Ãƒâ€°/g, 'E').replace(/Ã|ÃƒÂ/g, 'I').replace(/Ã“|Ãƒâ€œ/g, 'O').replace(/Ãš|ÃƒÅ¡/g, 'U')
    .replace(/Ã±|ÃƒÂ±/g, 'ñ').replace(/Ã‘|Ãƒâ€˜/g, 'Ñ')
    .replace(/C\S*DIGO/g, 'CODIGO')
    .replace(/VERSI\S*N/g, 'VERSION')
    .replace(/Gesti[\uFFFDï¿½]?n/g, 'Gestion')
    .replace(/Rector[\uFFFDï¿½]?a/g, 'Rectoria')
    .replace(/Vicerrector[\uFFFDï¿½]?a/g, 'Vicerrectoria')
    .replace(/Categor[\uFFFDï¿½]?a/g, 'Categoria')
    .replace(/Reposici[\uFFFDï¿½]?n/g, 'Reposicion')
    .replace(/Radicaci[\uFFFDï¿½]?n/g, 'Radicacion')
    .replace(/Notificaci[\uFFFDï¿½]?n/g, 'Notificacion')
    .replace(/Justificaci[\uFFFDï¿½]?n/g, 'Justificacion')
    .replace(/electr[\uFFFDï¿½]?nicamente/g, 'electronicamente')
    .replace(/electr[\uFFFDï¿½]?nico/g, 'electronico')
    .replace(/Transacci[\uFFFDï¿½]?n/g, 'Transaccion')
    .replace(/Verificaci[\uFFFDï¿½]?n/g, 'Verificacion')
    .replace(/Autorizaci[\uFFFDï¿½]?n/g, 'Autorizacion')
    .replace(/Aprobaci[\uFFFDï¿½]?n/g, 'Aprobacion')
    .replace(/Investigaci[\uFFFDï¿½]?n/g, 'Investigacion')
    .replace(/investigaci[\uFFFDï¿½]?n/g, 'investigacion')
    .replace(/Medell[\uFFFDï¿½]?n/g, 'Medellin')
    .replace(/informaci[\uFFFDï¿½]?n/g, 'informacion')
    .replace(/atenci[\uFFFDï¿½]?n/g, 'atencion')
    .replace(/revisi[\uFFFDï¿½]?n/g, 'revision')
    .replace(/tr[\uFFFDï¿½]?mite/g, 'tramite')
    .replace(/c[\uFFFDï¿½]?digo/g, 'codigo')
    .replace(/bot[\uFFFDï¿½]?n/g, 'boton')
    .replace(/P[\uFFFDï¿½]?gina/g, 'Pagina')
    .replace(/Se[\uFFFDï¿½]?or\(a\)/g, 'Senor(a)')
    .replace(/Nari[\uFFFDï¿½]?o/g, 'Narino')
    .replace(/[\uFFFD]/g, '')
    .replace(/[ÃÂâ]/g, '');

  return toPdfAscii(text);
};

const sanitizePdfDefinition = (value) => {
  if (Array.isArray(value)) return value.map(sanitizePdfDefinition);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizePdfDefinition(entry)]));
  }
  if (typeof value === 'string') return repairMojibakeText(value);
  return value;
};

const formatDate = (value) => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const parts = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).formatToParts(value);
    const getPart = (type) => parts.find(part => part.type === type)?.value || '';
    const day = getPart('day');
    const month = getPart('month');
    const year = getPart('year');
    return `${day}/${month}/${year}`;
  }
  const text = String(value).slice(0, 10);
  const [year, month, day] = text.split('-');
  return year && month && day ? `${day}/${month}/${year}` : text;
};

const formatDateTime = (value) => {
  if (!value) return '';
  const dateObj = new Date(value);
  if (Number.isNaN(dateObj.getTime())) return value;
  const parts = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(dateObj);
  const getPart = (type) => parts.find(part => part.type === type)?.value || '';
  const day = getPart('day');
  const month = getPart('month');
  const year = getPart('year');
  let hours = Number(getPart('hour'));
  const mins = getPart('minute');
  const secs = getPart('second');
  const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day}/${month}/${year} ${hours}:${mins}:${secs} ${ampm}`;
};

const formatTimeAmPm = (timeString) => {
  if (!timeString) return '';
  const [h, m] = timeString.split(':');
  if (!h || !m) return timeString;
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12; 
  return `${String(hour).padStart(2, '0')}:${m} ${ampm}`;
};

const formatMinutes = (minutes) => {
  const total = Number(minutes || 0);
  if (!Number.isFinite(total) || total <= 0) return '0h 00m';
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

const getReposicionPdfInfo = (solicitud = {}) => {
  const data = solicitud.datos_formulario || {};
  const salida = data.salida || {};
  const reposicion = data.reposicion || {};
  const profile = solicitud.reposicion_perfil_laboral
    || data.laboral?.reposicionPerfil
    || data.parametrizacion_tiempo?.perfil_laboral
    || {};
  const total = Number(solicitud.reposicion_minutos || solicitud.tiempo_solicitado_minutos || 0);
  const paid = Number(solicitud.reposicion_minutos_pagados || data.reposicion_minutos_pagados || 0);
  const daily = Number(solicitud.reposicion_minutos_por_dia || data.parametrizacion_tiempo?.reposicion_minutos_por_dia || profile.minutesPerDay || 0);
  const durationLabels = {
    menos_media_jornada: 'Hasta media jornada',
    '1_2_dias': 'Entre 1 y 2 dias',
    '3_mas_dias': '3 o mas dias'
  };
  const stateLabels = { no_aplica: 'No aplica', pendiente: 'Pendiente', programada: 'Programada', cumplida: 'Cumplida', incumplida: 'Incumplida' };
  const attachmentName = data.adjunto_metadata?.nombre_original
    || data.adjunto_path
    || salida.adjunto_path
    || salida.adjunto_url
    || '';
  return {
    applies: Boolean(solicitud.reposicion_aplica),
    requested: Number(solicitud.tiempo_solicitado_minutos || total),
    total,
    paid,
    pending: Math.max(0, total - paid),
    daily,
    profileLabel: profile.label || profile.key || solicitud.reposicion_tipo_vinculacion || data.laboral?.tipoVinculacion || 'No registrado',
    contractLevel: solicitud.reposicion_nivel_contratacion || data.laboral?.nivelContratacion || 'No registrado',
    durationLabel: durationLabels[salida.duracionTipo] || salida.duracionTipo || 'No registrado',
    stateLabel: stateLabels[solicitud.reposicion_estado] || solicitud.reposicion_estado || 'Pendiente',
    attachmentName: attachmentName ? path.basename(String(attachmentName)) : '',
    reposicion
  };
};

const buildReposicionPdfSection = (solicitud = {}, sectionTitle = 'Informacion de reposicion de tiempo') => {
  const info = getReposicionPdfInfo(solicitud);
  if (!info.applies) return [];
  const rows = [
    [{ text: 'Tiempo solicitado:', bold: true }, { text: formatMinutes(info.requested) }, { text: 'Jornada diaria:', bold: true }, { text: formatMinutes(info.daily) }],
    [{ text: 'Perfil laboral:', bold: true }, { text: info.profileLabel }, { text: 'Nivel de contratacion:', bold: true }, { text: info.contractLevel }],
    [{ text: 'Duracion del permiso:', bold: true }, { text: info.durationLabel }, { text: 'Estado de reposicion:', bold: true }, { text: info.stateLabel }],
    [{ text: 'Total a reponer:', bold: true }, { text: formatMinutes(info.total) }, { text: 'Saldo pendiente:', bold: true }, { text: formatMinutes(info.pending) }],
    [{ text: 'Tiempo abonado:', bold: true }, { text: formatMinutes(info.paid) }, { text: 'Soporte adjunto:', bold: true }, { text: info.attachmentName || 'No adjuntado' }]
  ];
  const plan = info.reposicion || {};
  if (plan.fecha || plan.horaInicio || plan.observacion) {
    rows.push([
      { text: 'Plan informado:', bold: true },
      { text: [formatDate(plan.fecha), formatTimeAmPm(plan.horaInicio)].filter(Boolean).join(' ') || 'Sin fecha definida' },
      { text: 'Finalizacion:', bold: true },
      { text: [formatDate(plan.fechaFin || plan.fecha), formatTimeAmPm(plan.horaFin)].filter(Boolean).join(' ') || 'Sin fecha definida' }
    ]);
    if (plan.observacion) rows.push([{ text: 'Observacion:', bold: true }, { text: plan.observacion, colSpan: 3 }, {}, {}]);
  }
  if (solicitud.observacion_gestion_humana) {
    rows.push([
      { text: 'Seguimiento de reposicion:', bold: true },
      { text: solicitud.observacion_gestion_humana, colSpan: 3 },
      {}, {}
    ]);
  }
  return [
    { table: { widths: ['*'], body: [[{ text: sectionTitle, bold: true, fillColor: '#dbeafe', color: '#0b3a6f', margin: [5, 3, 5, 3] }]] }, margin: [0, 4, 0, 3] },
    { table: { widths: ['22%', '28%', '22%', '28%'], body: rows }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 8] }
  ];
};

const getTipoSalidaLabel = (tipo) => {
  const mapping = {
    cita_eps: 'Cita medica por EPS',
    cita_particular: 'Cita medica particular',
    cita_medica_laboral: 'Cita medica laboral',
    diligencia_personal: 'Diligencia personal',
    compensatorio: 'Compensatorio',
    voto_jurado: 'Permiso: Jurado de votación',
    voto_sufragante: 'Permiso: Sufragante',
    calamidad_domestica: 'Permiso: Calamidad doméstica',
    entierro_companero: 'Permiso: Entierro compañeros',
    comision_sindical: 'Permiso: Comisiones sindicales',
    matrimonio: 'Permiso: Matrimonio',
    lactancia: 'Permiso: Lactancia',
    luto_conyuge: 'Licencia luto: Cónyuge',
    luto_companero: 'Licencia luto: Compañero(a)',
    luto_familiar: 'Licencia luto: Familiar',
    actos_funebres: 'Licencia: Actos fúnebres',
    cuidado_ninez: 'Licencia: Cuidado niñez',
    calidad_servicio: 'Mejora en la calidad del servicio',
    jurado_votacion: 'Permiso: Jurado de votación',
    sufragante: 'Permiso: Sufragante',
    cargos_oficiales_transitorios: 'Permiso: Desempeño de cargos oficiales transitorios',
    comisiones_sindicales: 'Permiso: Comisiones sindicales',
    obligaciones_escolares: 'Permiso: Obligaciones escolares',
    citaciones_judiciales: 'Permiso: Citaciones judiciales, administrativas y de policía',
    cuidado_hijo_ley_2174: 'Permiso: Cuidado de hijo(a) - Ley 2174 de 2021'
  };
  if (!tipo) return '';
  if (mapping[tipo]) return mapping[tipo];
  if (tipo.startsWith('otra:')) return `Otra: ${tipo.substring(5)}`;
  return tipo;
};

const replaceOnce = (xml, search, replacement) => {
  const index = xml.indexOf(search);
  if (index < 0) return xml;
  return `${xml.slice(0, index)}${replacement}${xml.slice(index + search.length)}`;
};

const buildDocxData = (solicitud) => {
  const data = solicitud?.datos_formulario || {};
  const solicitante = solicitud?.solicitante_snapshot || {};
  const jefe = solicitud?.jefe_snapshot || {};
  const salida = data.salida || {};
  const reposicion = data.reposicion || {};
  const laboral = data.laboral || {};
  const personal = data.personal || {};
  return {
    fechaReporte: formatDate(new Date().toISOString()),
    nombre: solicitante.nombre || personal.nombre || '',
    documento: solicitante.username || personal.documento || '',
    cargo: laboral.cargo || '',
    dependencia: laboral.dependencia || '',
    fechaSalida: formatDate(salida.fecha),
    horaSalida: formatTimeAmPm(salida.horaInicio),
    fechaRegreso: formatDate(salida.fechaRegreso || salida.fechaFin || salida.fecha),
    horaRegreso: formatTimeAmPm(salida.horaFin),
    tipo: salida.tipo || '',
    categoria: salida.categoria || '',
    reposicionFecha: formatDate(reposicion.fecha),
    reposicionFechaFin: formatDate(reposicion.fechaFin || reposicion.fecha),
    reposicionInicio: formatTimeAmPm(reposicion.horaInicio),
    reposicionFin: formatTimeAmPm(reposicion.horaFin),
    jefeNombre: jefe.nombre || '',
    jefeCargo: jefe.cargo || '',
    jefeDocumento: jefe.username || '',
    ghFecha: solicitud.gestion_humana_aprobado_at ? formatDate(solicitud.gestion_humana_aprobado_at) : ''
  };
};

const buildCellTextXml = (text) => {
  const lines = String(text ?? '').split(/\r?\n/);
  return lines.map((line, index) => {
    const breakXml = index === 0 ? '' : '<w:br/>';
    return `<w:r>${breakXml}<w:t xml:space="preserve">${escapeXmlText(line)}</w:t></w:r>`;
  }).join('');
};

const setCellText = (cellXml, text) => {
  const tcPr = (cellXml.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/) || [''])[0];
  return `<w:tc>${tcPr}<w:p>${buildCellTextXml(text)}</w:p></w:tc>`;
};

const updateRowCell = (rowXml, cellIndex, text) => {
  const cells = rowXml.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
  if (!cells[cellIndex]) return rowXml;
  cells[cellIndex] = setCellText(cells[cellIndex], text);
  let updated = rowXml;
  (rowXml.match(/<w:tc[\s\S]*?<\/w:tc>/g) || []).forEach((cell, index) => {
    updated = replaceOnce(updated, cell, cells[index]);
  });
  return updated;
};

const fillReporteSalidaRows = (xml, values) => {
  const originalRows = xml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
  const rows = [...originalRows];
  const set = (rowIndex, cellIndex, text) => {
    if (!rows[rowIndex]) return;
    rows[rowIndex] = updateRowCell(rows[rowIndex], cellIndex, text);
  };

  set(0, 0, `  Fecha de reporte: ${values.fechaReporte}`);
  set(2, 0, `Nombres y apellidos: ${values.nombre}`);
  set(3, 0, `  Numero de documento de identidad: ${values.documento}`);
  set(4, 0, `Cargo: ${values.cargo}`);
  set(4, 1, `Dependencia: ${values.dependencia}`);
  set(5, 0, `Fecha de salida: ${values.fechaSalida}`);
  set(5, 1, `Hora de salida: ${values.horaSalida}`);
  set(6, 0, `Fecha de regreso: ${values.fechaRegreso}`);
  set(6, 1, `  Hora de regreso: ${values.horaRegreso}`);
  set(15, 0, values.tipo === 'cita_eps' ? 'X' : '');
  set(15, 2, values.tipo === 'cita_particular' ? 'X' : '');
  const isPersonalPermission = [
    'diligencia_personal', 'compensatorio',
    'voto_jurado', 'voto_sufragante', 'comision_sindical', 'matrimonio', 'lactancia', 'luto_conyuge', 'luto_companero', 'luto_familiar', 'actos_funebres', 'cuidado_ninez',
    'jurado_votacion', 'sufragante', 'cargos_oficiales_transitorios', 'calamidad_domestica', 'entierro_companero', 'comisiones_sindicales', 'obligaciones_escolares', 'citaciones_judiciales', 'cuidado_hijo_ley_2174'
  ].includes(values.tipo) || values.categoria === 'personales' || (String(values.tipo).startsWith('otra:') && values.categoria === 'personales');
  set(16, 0, isPersonalPermission ? 'X' : '');
  set(17, 0, ` Fecha:  ${values.reposicionFecha}${values.reposicionFechaFin && values.reposicionFechaFin !== values.reposicionFecha ? ` a ${values.reposicionFechaFin}` : ''}`);
  set(17, 1, ` Hora inicio: ${values.reposicionInicio}`);
  set(17, 2, ` Hora fin: ${values.reposicionFin}`);
  set(21, 1, ` Nombres y apellidos: ${values.jefeNombre}`);
  set(22, 1, ` Cargo: ${values.jefeCargo}`);
  set(23, 1, ` Cedula: ${values.jefeDocumento}`);
  set(25, 1, `RECIBIDO (Gestión del Talento Humano)\n\nFirma: ______________________________       Fecha:  ${values.ghFecha || '_________________________'}`);

  let updatedXml = xml;
  originalRows.forEach((row, index) => {
    updatedXml = replaceOnce(updatedXml, row, rows[index]);
  });
  return updatedXml;
};

const buildFilledDocxBuffer = async (solicitud) => {
  const templatePath = getReporteSalidaTemplatePath()
    || path.resolve(__dirname, '../../templates/reporte-salida/FR-002 REPORTE DE SALIDA v3.docx');
  const template = await fs.promises.readFile(templatePath);
  const zip = await JSZip.loadAsync(template);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('La plantilla FR-002 no contiene word/document.xml');
  const values = buildDocxData(solicitud);
  let xml = await file.async('string');
  xml = fillReporteSalidaRows(xml, values);

  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer' });
};

const findGeneratedPdfPath = async (outDir, docxPath) => {
  const expected = path.join(outDir, `${path.basename(docxPath, path.extname(docxPath))}.pdf`);
  try {
    await fs.promises.access(expected, fs.constants.R_OK);
    return expected;
  } catch (_) {
    const files = await fs.promises.readdir(outDir);
    const pdf = files
      .filter((file) => file.toLowerCase().endsWith('.pdf'))
      .map((file) => path.join(outDir, file))
      .sort()
      .pop();
    return pdf || '';
  }
};

const convertDocxToPdf = async (docxPath, targetPdfPath) => {
  const outDir = path.dirname(targetPdfPath);
  const profileDir = path.join(outDir, '.libreoffice-profile');
  await fs.promises.mkdir(profileDir, { recursive: true });

  const configured = String(process.env.LIBREOFFICE_BIN || '').trim();
  const candidates = configured ? [configured] : ['libreoffice', 'soffice'];
  let lastError = null;

  for (const binary of candidates) {
    try {
      await execFileAsync(binary, [
        `-env:UserInstallation=file:///${profileDir.replace(/\\/g, '/')}`,
        '--headless',
        '--nologo',
        '--nofirststartwizard',
        '--convert-to',
        'pdf',
        '--outdir',
        outDir,
        docxPath
      ], { timeout: 120000 });

      const generatedPdf = await findGeneratedPdfPath(outDir, docxPath);
      if (!generatedPdf) throw new Error('LibreOffice no genero el archivo PDF esperado.');
      if (path.resolve(generatedPdf) !== path.resolve(targetPdfPath)) {
        await fs.promises.copyFile(generatedPdf, targetPdfPath);
      }
      return true;
    } catch (error) {
      lastError = error;
      if (error.code !== 'ENOENT') break;
    }
  }

  console.warn('No fue posible convertir el DOCX FR-002 a PDF con LibreOffice:', lastError?.message || lastError);
  return false;
};

const buildLines = (solicitud) => {
  const data = solicitud?.datos_formulario || {};
  const solicitante = solicitud?.solicitante_snapshot || {};
  const jefe = solicitud?.jefe_snapshot || {};
  const salida = data.salida || {};
  const reposicion = data.reposicion || {};
  const laboral = data.laboral || {};
  const personal = data.personal || {};
  const reposicionInfo = getReposicionPdfInfo(solicitud);

  return [
    'UNIVERSIDAD CESMAG',
    'FR-002 REPORTE DE SALIDA v3',
    `Solicitud: ${solicitud.consecutivo || solicitud.id}`,
    '',
    'DATOS DEL COLABORADOR',
    `Nombre: ${solicitante.nombre || personal.nombre || ''}`,
    `Documento: ${solicitante.username || personal.documento || ''}`,
    `Correo: ${solicitante.email || ''}`,
    `Cargo: ${laboral.cargo || ''}`,
    `Dependencia: ${laboral.dependencia || ''}`,
    '',
    'DATOS DE SALIDA',
    `Tipo de salida: ${salida.tipo || ''}`,
    `Fecha salida: ${formatDate(salida.fecha)}`,
    `Fecha regreso: ${formatDate(salida.fechaRegreso || salida.fechaFin || salida.fecha)}`,
    `Hora inicio: ${formatTimeAmPm(salida.horaInicio)}`,
    `Hora fin: ${salida.categoria === 'salud' && salida.tipo !== 'terapias' && !salida.horaFin ? 'No especificada' : formatTimeAmPm(salida.horaFin)}`,
    `Tiempo solicitado: ${formatMinutes(solicitud.tiempo_solicitado_minutos)}`,
    `Motivo / observacion: ${salida.motivo || ''}`,
    ...(getDeclaracionSinAdjunto(salida) ? [`Declaracion de soportes: ${getDeclaracionSinAdjunto(salida)}`] : []),
    '',
    'DATOS DE REPOSICION',
    `Fecha reposicion: ${formatDate(reposicion.fecha)}`,
    `Fecha fin reposicion: ${formatDate(reposicion.fechaFin || reposicion.fecha)}`,
    `Hora inicio reposicion: ${formatTimeAmPm(reposicion.horaInicio)}`,
    `Hora fin reposicion: ${formatTimeAmPm(reposicion.horaFin)}`,
    `Tiempo reposicion: ${formatMinutes(solicitud.reposicion_minutos)}`,
    `Jornada diaria: ${formatMinutes(reposicionInfo.daily)}`,
    `Perfil laboral: ${reposicionInfo.profileLabel}`,
    `Nivel de contratacion: ${reposicionInfo.contractLevel}`,
    `Tiempo abonado: ${formatMinutes(reposicionInfo.paid)}`,
    `Saldo pendiente: ${formatMinutes(reposicionInfo.pending)}`,
    `Estado reposicion: ${solicitud.reposicion_estado || 'no_aplica'}`,
    `Soporte adjunto: ${reposicionInfo.attachmentName || 'No adjuntado'}`,
    '',
    'APROBACIONES',
    `Jefe inmediato: ${jefe.nombre || ''} - ${jefe.email || ''}`,
    `Aprobacion jefe: ${solicitud.jefe_aprobado_at ? formatDate(solicitud.jefe_aprobado_at) : 'Pendiente'}`,
    `Aprobacion Gestión del Talento Humano: ${solicitud.gestion_humana_aprobado_at ? formatDate(solicitud.gestion_humana_aprobado_at) : 'Pendiente'}`,
    '',
    'Este PDF fue generado automaticamente desde SIAC UNICESMAG con la informacion diligenciada en el formulario digital.'
  ];
};

const PdfPrinter = require('pdfmake');
const PDF_FONT_FAMILY = 'ReportFont';

const firstExistingPath = (paths) => paths.find((fontPath) => fs.existsSync(fontPath)) || paths[0];

const resolvePdfFontFiles = () => {
  if (process.platform === 'win32') {
    return {
      normal: firstExistingPath(['C:/Windows/Fonts/arial.ttf', 'C:/Windows/Fonts/segoeui.ttf']),
      bold: firstExistingPath(['C:/Windows/Fonts/arialbd.ttf', 'C:/Windows/Fonts/segoeuib.ttf']),
      italics: firstExistingPath(['C:/Windows/Fonts/ariali.ttf', 'C:/Windows/Fonts/segoeuii.ttf']),
      bolditalics: firstExistingPath(['C:/Windows/Fonts/arialbi.ttf', 'C:/Windows/Fonts/segoeuiz.ttf'])
    };
  }

  return {
    normal: firstExistingPath([
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/dejavu/DejaVuSans.ttf'
    ]),
    bold: firstExistingPath([
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'
    ]),
    italics: firstExistingPath([
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
      '/usr/share/fonts/dejavu/DejaVuSans-Oblique.ttf'
    ]),
    bolditalics: firstExistingPath([
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf',
      '/usr/share/fonts/dejavu/DejaVuSans-BoldOblique.ttf'
    ])
  };
};

const PDF_FONT_FILES = resolvePdfFontFiles();
const PDF_FONTS = {
  [PDF_FONT_FAMILY]: PDF_FONT_FILES
};

const buildOficioPdfDefinition = (solicitud, ghDirectorNombre, ghDirectorCargo) => {
  const data = solicitud?.datos_formulario || {};
  const solicitante = solicitud?.solicitante_snapshot || {};
  const jefe = solicitud?.jefe_snapshot || {};
  const salida = data.salida || {};
  const personal = data.personal || {};
  const laboral = data.laboral || {};

  // Formatter for date: e.g. "San Juan de Pasto, 15 de julio de 2026"
  const createdAtValue = getSolicitudCreatedAt(solicitud);
  const createdDate = new Date(createdAtValue);
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const createdDateParts = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric'
  }).formatToParts(createdDate);
  const getCreatedDatePart = (type) => createdDateParts.find(part => part.type === type)?.value || '';
  const dateFormatted = `San Juan de Pasto, ${getCreatedDatePart('day')} de ${meses[Number(getCreatedDatePart('month')) - 1]} de ${getCreatedDatePart('year')}`;

  // Signature variables
  const txId = data.tx_id || String(solicitud.consecutivo || solicitud.id);
  const initialApprovalPdf = getInitialApprovalPdfInfo(solicitud);
  const reqDate = formatDateTime(createdAtValue);
  const initialApprovalDateValue = initialApprovalPdf.dateValue
    || getDateCandidate(solicitud, ['jefe_aprobado_at']);
  const hasInitialApproval = Boolean(initialApprovalDateValue || solicitud.jefe_aprobado_at);
  const jefeDate = initialApprovalDateValue ? formatDateTime(initialApprovalDateValue) : 'Pendiente';
  const vicerrectoriaDateValue = getStageDate(solicitud, ['vicerrectoria_aprobado_at'], ['aprobada_vicerrectoria_academica']);
  const rectoriaDateValue = getStageDate(solicitud, ['rectoria_aprobado_at'], ['aprobada_rectoria']);
  const ghDateValue = getStageDate(solicitud, ['gestion_humana_aprobado_at'], ['aprobada_gestion_humana']);
  const vicerrectoriaDate = vicerrectoriaDateValue ? formatDateTime(vicerrectoriaDateValue) : 'Pendiente';
  const rectoriaDate = rectoriaDateValue ? formatDateTime(rectoriaDateValue) : 'Pendiente';
  const ghDate = ghDateValue ? formatDateTime(ghDateValue) : 'Pendiente';

  const isPropiasCargoSubtype = ['ponencia', 'visita_ies', 'capacitacion', 'proyecto_investigacion', 'asistente_congreso', 'practica_academica', 'torneo_deportivo', 'salida_campus', 'otra'].includes(salida.tipo) || String(salida.tipo).startsWith('otra:');
  const isPropiasCargo = salida.categoria === 'propias_cargo' && salida.tipo !== 'salida_campus';
  const alcance = isPropiasCargo ? (salida.alcance || 'Local') : 'Local';
  const requiresSst = isPropiasCargoSubtype && ['Nacional', 'Internacional'].includes(alcance);
  const hasVicerrectoriaApproval = Boolean(vicerrectoriaDateValue);
  const hasRectoriaApproval = Boolean(rectoriaDateValue);
  const vicerrectoriaName = laboral.vicerrectoria || solicitante.vicerrectoria || 'Vicerrectoria';
  const normalizedVicerrectoria = stripAccents(vicerrectoriaName).toLowerCase();
  const isRectoriaAuthority = normalizedVicerrectoria.includes('rectoria') && !normalizedVicerrectoria.includes('vicerrectoria') && !normalizedVicerrectoria.includes('vicerectoria');
  const isOneOrTwoDaysOficio = isPropiasCargo && salida.duracionTipo === '1_2_dias';
  const isThreeOrMoreDaysOficio = isPropiasCargo && salida.duracionTipo === '3_mas_dias';
  const requiresVicerrectoriaSignature = (isOneOrTwoDaysOficio || isThreeOrMoreDaysOficio) && !isRectoriaAuthority;
  const requiresRectoriaSignature = hasRectoriaApproval || (isRectoriaAuthority && !isThreeOrMoreDaysOficio);

  const sstEvent = getTraceByEvents(solicitud, ['aprobada_sst']);
  const sstApprovedAt = sstEvent ? new Date(sstEvent.at) : null;
  const sstDate = sstApprovedAt ? formatDateTime(sstApprovedAt) : 'Pendiente';
  const sstActorName = sstApprovedAt ? SST_RESPONSABLE_NOMBRE : 'Seguridad y Salud en el Trabajo';
  const frontendUrl = process.env.FRONTEND_URL || 'https://planeaciongp.unicesmag.edu.co';
  const verifyUrl = `${frontendUrl.replace(/\/$/, '')}/verificar/${txId}`;
  const buildSignatureCell = ({ signed, name, cargo, date, extra = {} }) => ({
    text: [
      { text: signed ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 8 },
      { text: `${signed ? name : 'Pendiente'}\n`, fontSize: 9 },
      { text: `Cargo: ${cargo || ''}\n`, fontSize: 7.5 },
      { text: `Fecha y hora: ${date}\n`, fontSize: 7.5 },
      { text: signed ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
    ],
    margin: [5, 5, 5, 5],
    ...extra
  });

  const signatureTableBody = [
    [
      { text: 'Firma del trabajador Solicitante', bold: true, alignment: 'center', fillColor: '#e0e0e0', fontSize: 9 },
      { text: initialApprovalPdf.header, bold: true, alignment: 'center', fillColor: '#e0e0e0', fontSize: 9 }
    ],
    [
      {
        text: [
          { text: 'Firmado electrónicamente por:\n', bold: true, fontSize: 8 },
          { text: `${solicitante.nombre || personal.nombre || ''}\n`, fontSize: 9 },
          { text: `Documento: ${solicitante.username || personal.documento || ''}\n`, fontSize: 7.5 },
          { text: `Fecha y hora: ${reqDate}\n`, fontSize: 7.5 },
          { text: `ID Transacción: ${txId}\n`, fontSize: 7, color: 'gray' }
        ],
        margin: [5, 5, 5, 5]
      },
      {
        text: [
          { text: hasInitialApproval ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 8 },
          { text: `${hasInitialApproval ? initialApprovalPdf.name : 'Pendiente'}\n`, fontSize: 9 },
          { text: `Cargo: ${initialApprovalPdf.cargo || ''}\n`, fontSize: 7.5 },
          ...(initialApprovalPdf.viaDependencia && initialApprovalPdf.email ? [{ text: `Correo: ${initialApprovalPdf.email}\n`, fontSize: 7.5 }] : []),
          { text: `Fecha y hora: ${jefeDate}\n`, fontSize: 7.5 },
          { text: hasInitialApproval ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
        ],
        margin: [5, 5, 5, 5]
      }
    ]
  ];

  if (requiresSst) {
    if (hasVicerrectoriaApproval || hasRectoriaApproval) {
      signatureTableBody.push([
        { text: `APROBADO (${vicerrectoriaName})`, bold: true, alignment: 'center', fillColor: '#e0e0e0', fontSize: 9 },
        { text: hasRectoriaApproval ? 'APROBADO (Rectoria)' : 'RECIBIDO (Gestión del Talento Humano)', bold: true, alignment: 'center', fillColor: '#e0e0e0', fontSize: 9 }
      ]);
      signatureTableBody.push([
        {
          text: [
            { text: hasVicerrectoriaApproval ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 8 },
            { text: `${hasVicerrectoriaApproval ? vicerrectoriaName : 'Pendiente'}\n`, fontSize: 9 },
            { text: `Cargo: ${vicerrectoriaName}\n`, fontSize: 7.5 },
            { text: `Fecha y hora: ${vicerrectoriaDate}\n`, fontSize: 7.5 },
            { text: hasVicerrectoriaApproval ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
          ],
          margin: [5, 5, 5, 5]
        },
        {
          text: [
            { text: hasRectoriaApproval ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 8 },
            { text: `${hasRectoriaApproval ? 'Rectoria' : 'Pendiente'}\n`, fontSize: 9 },
            { text: `Cargo: Rectoria\n`, fontSize: 7.5 },
            { text: `Fecha y hora: ${rectoriaDate}\n`, fontSize: 7.5 },
            { text: hasRectoriaApproval ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
          ],
          margin: [5, 5, 5, 5]
        }
      ]);
    }
    signatureTableBody.push([
      { text: 'RECIBIDO (Gestión del Talento Humano)', bold: true, alignment: 'center', fillColor: '#e0e0e0', fontSize: 9 },
      { text: 'VISTO BUENO (Seguridad y Salud en el Trabajo)', bold: true, alignment: 'center', fillColor: '#e0e0e0', fontSize: 9 }
    ]);
    signatureTableBody.push([
      {
        text: [
          { text: ghDateValue ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 8 },
          { text: `${ghDateValue ? ghDirectorNombre : 'Pendiente'}\n`, fontSize: 9 },
          { text: `Cargo: ${ghDirectorCargo}\n`, fontSize: 7.5 },
          { text: `Fecha y hora: ${ghDate}\n`, fontSize: 7.5 },
          { text: ghDateValue ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
        ],
        margin: [5, 5, 5, 5]
      },
      {
        text: [
          { text: sstApprovedAt ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 8 },
          { text: `${sstApprovedAt ? sstActorName : 'Pendiente'}\n`, fontSize: 9 },
          { text: `Cargo: ${SST_RESPONSABLE_CARGO}\n`, fontSize: 7.5 },
          { text: `Fecha y hora: ${sstDate}\n`, fontSize: 7.5 },
          { text: sstApprovedAt ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
        ],
        margin: [5, 5, 5, 5]
      }
    ]);
  } else {
    if (hasVicerrectoriaApproval || hasRectoriaApproval) {
      signatureTableBody.push([
        { text: `APROBADO (${vicerrectoriaName})`, bold: true, alignment: 'center', fillColor: '#e0e0e0', fontSize: 9 },
        { text: hasRectoriaApproval ? 'APROBADO (Rectoria)' : 'RECIBIDO (Gestión del Talento Humano)', bold: true, alignment: 'center', fillColor: '#e0e0e0', fontSize: 9 }
      ]);
      signatureTableBody.push([
        {
          text: [
            { text: hasVicerrectoriaApproval ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 8 },
            { text: `${hasVicerrectoriaApproval ? vicerrectoriaName : 'Pendiente'}\n`, fontSize: 9 },
            { text: `Cargo: ${vicerrectoriaName}\n`, fontSize: 7.5 },
            { text: `Fecha y hora: ${vicerrectoriaDate}\n`, fontSize: 7.5 },
            { text: hasVicerrectoriaApproval ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
          ],
          margin: [5, 5, 5, 5]
        },
        {
          text: [
            { text: hasRectoriaApproval ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 8 },
            { text: `${hasRectoriaApproval ? 'Rectoria' : 'Pendiente'}\n`, fontSize: 9 },
            { text: `Cargo: Rectoria\n`, fontSize: 7.5 },
            { text: `Fecha y hora: ${rectoriaDate}\n`, fontSize: 7.5 },
            { text: hasRectoriaApproval ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
          ],
          margin: [5, 5, 5, 5]
        }
      ]);
    }
    signatureTableBody.push([
      { text: 'RECIBIDO (Gestión del Talento Humano)', bold: true, alignment: 'center', colSpan: 2, fillColor: '#e0e0e0', fontSize: 9 },
      {}
    ]);
    signatureTableBody.push([
      {
        text: [
          { text: ghDateValue ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 8 },
          { text: `${ghDateValue ? ghDirectorNombre : 'Pendiente'}\n`, fontSize: 9 },
          { text: `Cargo: ${ghDirectorCargo}\n`, fontSize: 7.5 },
          { text: `Fecha y hora: ${ghDate}\n`, fontSize: 7.5 },
          { text: ghDateValue ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
        ],
        margin: [5, 5, 5, 5],
        alignment: 'center',
        colSpan: 2
      },
      {}
    ]);
  }

  signatureTableBody.length = 0;
  const oficioSignatureHeaderFill = '#eaf4ff';
  const buildOficioSignatureCell = ({ signed, name, cargo, date, extra = {} }) => ({
    text: [
      { text: signed ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 7.6 },
      { text: `${signed ? name : 'Pendiente'}\n`, fontSize: 8.4 },
      { text: `Cargo: ${cargo || ''}\n`, fontSize: 6.9 },
      { text: `Fecha y hora: ${date}\n`, fontSize: 6.9 },
      { text: signed ? `ID Transacción: ${txId}\n` : '\n', fontSize: 6.3, color: 'gray' }
    ],
    margin: [4, 4, 4, 4],
    ...extra
  });
  signatureTableBody.push(
    [
      { text: 'Firma del trabajador solicitante', bold: true, alignment: 'center', fillColor: oficioSignatureHeaderFill, fontSize: 8.4 },
      { text: 'VISTO BUENO del jefe inmediato', bold: true, alignment: 'center', fillColor: oficioSignatureHeaderFill, fontSize: 8.4 }
    ],
    [
      {
        text: [
          { text: 'Firmado electrónicamente por:\n', bold: true, fontSize: 7.6 },
          { text: `${solicitante.nombre || personal.nombre || ''}\n`, fontSize: 8.4 },
          { text: `Documento: ${solicitante.username || personal.documento || ''}\n`, fontSize: 6.9 },
          { text: `Fecha y hora: ${reqDate}\n`, fontSize: 6.9 },
          { text: `ID Transacción: ${txId}\n`, fontSize: 6.3, color: 'gray' }
        ],
        margin: [4, 4, 4, 4]
      },
      buildOficioSignatureCell({
          signed: hasInitialApproval,
          name: initialApprovalPdf.name || jefe.nombre || 'Jefe inmediato',
          cargo: initialApprovalPdf.cargo || jefe.cargo || 'Jefe inmediato',
          date: jefeDate
      })
    ]
  );

  if (requiresVicerrectoriaSignature && requiresRectoriaSignature) {
    signatureTableBody.push(
      [
        { text: `APROBACION de ${vicerrectoriaName}`, bold: true, alignment: 'center', fillColor: oficioSignatureHeaderFill, fontSize: 8.4 },
        { text: 'APROBACION de Rectoria', bold: true, alignment: 'center', fillColor: oficioSignatureHeaderFill, fontSize: 8.4 }
      ],
      [
        buildOficioSignatureCell({
          signed: hasVicerrectoriaApproval,
          name: vicerrectoriaName,
          cargo: vicerrectoriaName,
          date: vicerrectoriaDate
        }),
        buildOficioSignatureCell({
          signed: hasRectoriaApproval,
          name: 'Rectoria',
          cargo: 'Rectoria',
          date: rectoriaDate
        })
      ]
    );
  } else if (requiresVicerrectoriaSignature) {
    signatureTableBody.push(
      [
        { text: `APROBACION de ${vicerrectoriaName}`, bold: true, alignment: 'center', colSpan: 2, fillColor: oficioSignatureHeaderFill, fontSize: 8.4 },
        {}
      ],
      [
        buildOficioSignatureCell({
          signed: hasVicerrectoriaApproval,
          name: vicerrectoriaName,
          cargo: vicerrectoriaName,
          date: vicerrectoriaDate,
          extra: { alignment: 'center', colSpan: 2 }
        }),
        {}
      ]
    );
  } else if (requiresRectoriaSignature) {
    signatureTableBody.push(
      [
        { text: 'APROBACION de Rectoria', bold: true, alignment: 'center', colSpan: 2, fillColor: oficioSignatureHeaderFill, fontSize: 8.4 },
        {}
      ],
      [
        buildOficioSignatureCell({
          signed: hasRectoriaApproval,
          name: 'Rectoria',
          cargo: 'Rectoria',
          date: rectoriaDate,
          extra: { alignment: 'center', colSpan: 2 }
        }),
        {}
      ]
    );
  }

  if (requiresSst) {
    signatureTableBody.push(
      [
        { text: 'VISTO BUENO / RECIBIDO (Gestión del Talento Humano)', bold: true, alignment: 'center', fillColor: oficioSignatureHeaderFill, fontSize: 8.4 },
        { text: 'VISTO BUENO (Seguridad y Salud en el Trabajo)', bold: true, alignment: 'center', fillColor: oficioSignatureHeaderFill, fontSize: 8.4 }
      ],
      [
        buildOficioSignatureCell({
          signed: Boolean(ghDateValue),
          name: ghDirectorNombre,
          cargo: ghDirectorCargo,
          date: ghDate
        }),
        buildOficioSignatureCell({
          signed: Boolean(sstApprovedAt),
          name: sstActorName,
          cargo: SST_RESPONSABLE_CARGO,
          date: sstDate
        })
      ]
    );
  } else {
    signatureTableBody.push(
      [
        { text: 'VISTO BUENO / RECIBIDO (Gestión del Talento Humano)', bold: true, alignment: 'center', colSpan: 2, fillColor: oficioSignatureHeaderFill, fontSize: 8.4 },
        {}
      ],
      [
        buildOficioSignatureCell({
          signed: Boolean(ghDateValue),
          name: ghDirectorNombre,
          cargo: ghDirectorCargo,
          date: ghDate,
          extra: { alignment: 'center', colSpan: 2 }
        }),
        {}
      ]
    );
  }

  // Destinatario details
  const destTratamiento = salida.destinatarioTratamiento || 'Señor(a)';
  const destNombre = (salida.destinatarioNombre || '').toUpperCase();
  const destCargo = salida.destinatarioCargo || '';
  const destDependencia = salida.destinatarioEmpresa || jefe.dependencia || '';
  const destDireccionEmail = salida.destinatarioDireccionEmail || '';
  const fr013Background = path.join(__dirname, '../assets/fr013-carta-bg.png');
  const consecutiveText = [salida.codigoDependencia, solicitud.consecutivo || solicitud.id]
    .filter(Boolean)
    .join(' - ');

  return {
    pageSize: 'LETTER',
    pageMargins: [60, 104, 60, 72],
    defaultStyle: { font: PDF_FONT_FAMILY, fontSize: 11, color: '#000000', lineHeight: 1.12 },
    background: () => ({
      image: fr013Background,
      width: 612,
      height: 792
    }),

    footer: (currentPage, pageCount) => {
      return {
        text: `Página ${currentPage} de ${pageCount}`,
        alignment: 'right',
        fontSize: 8,
        margin: [0, 0, 70, 58],
        _unused: [
          { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', fontSize: 8.5, margin: [0, 0, 45, 5] },
          {
            image: path.join(__dirname, '../assets/pie_de_pag.png'),
            width: 522,
            alignment: 'center'
          }
        ],
        _unusedMargin: [0, 0, 0, 15]
      };
    },

    content: [
      {
        qr: verifyUrl,
        fit: 78,
        absolutePosition: { x: 474, y: 104 }
      },
      {
        text: [
          { text: 'Validar oficio:\n', bold: true },
          { text: verifyUrl, link: verifyUrl, color: '#005baa' }
        ],
        fontSize: 6.4,
        alignment: 'center',
        width: 132,
        absolutePosition: { x: 447, y: 185 }
      },
      { text: consecutiveText, margin: [0, 0, 0, 8] },
      { text: dateFormatted, margin: [0, 0, 0, 16] },
      
      {
        text: [
          { text: destTratamiento ? `${destTratamiento}\n` : '' },
          { text: `${destNombre}\n`, bold: true },
          { text: destCargo ? `${destCargo}\n` : '' },
          { text: destDependencia ? `${destDependencia}\n` : '' }
        ],
        margin: [0, 0, 0, 12]
      },
      
      { text: `Asunto: ${salida.oficioAsunto || ''}`, bold: true, margin: [0, 0, 0, 10] },
      
      { text: 'Paz y bien:', bold: true, margin: [0, 0, 0, 8] },
      
      { text: salida.oficioCuerpo || '', alignment: 'justify', margin: [0, 0, 0, 12] },
      
      { text: salida.oficioDespedida || 'Cordialmente,', margin: [0, 0, 0, 12] },
      
      
      ...(getDeclaracionSinAdjunto(salida) ? [
        { text: `Declaracion de soportes: ${getDeclaracionSinAdjunto(salida)}`, fontSize: 8.2, italics: true, color: '#334155', margin: [0, 0, 0, 4] }
      ] : []),

      ...buildReposicionPdfSection(solicitud, 'REPOSICION DE TIEMPO ASOCIADA A LA SALIDA'),
      
      // Signatures container
      {
        unbreakable: true,
        table: {
          widths: ['50%', '50%'],
          body: signatureTableBody
        },
        layout: 'borders',
        margin: [0, 0, 0, 4]
      },
      { text: `Anexos: ${salida.oficioAnexos || 'Ninguno'}`, fontSize: 7.6, margin: [0, 0, 0, 1] },
      { text: `Proyecto: ${salida.oficioProyecto || ''}`, fontSize: 7.6, margin: [0, 0, 0, 4] },
      {
        text: '',
        unbreakable: true,
        _unusedColumns: [
          {
            width: 78,
            qr: verifyUrl,
            fit: 70,
            margin: [0, 0, 8, 0]
          },
          {
            width: '*',
            text: [
              { text: 'Verificación de autenticidad e integridad\n', bold: true, fontSize: 8.5 },
              { text: 'Escanee el código QR o ingrese al enlace para validar este oficio firmado electrónicamente:\n', fontSize: 7.5 },
              { text: verifyUrl, fontSize: 7.5, color: 'blue', link: verifyUrl }
            ],
            margin: [0, 4, 0, 0]
          }
        ],
        margin: [0, 4, 0, 0]
      }
    ]
  };
};

const buildPdfBuffer = async (solicitud) => {
  let ghDirectorNombre = 'Gestion del Talento Humano';
  let ghDirectorCargo = 'Jefe de Gestión del Talento Humano';
  try {
    const { User } = require('../models');
    const { Op } = require('sequelize');
    const ghUser = await User.findOne({
      where: {
        [Op.and]: [
          { dependencia: { [Op.iLike]: '%Talento Humano%' } },
          { cargo: { [Op.iLike]: '%Jefe%' } },
          { cargo: { [Op.iLike]: '%Talento Humano%' } }
        ]
      }
    });
    if (ghUser) {
      ghDirectorNombre = ghUser.nombre;
      ghDirectorCargo = ghUser.cargo;
    }
  } catch (err) {
    console.error('Error fetching GH user for PDF:', err);
  }

  return new Promise(async (resolve, reject) => {
    try {
      const printer = new PdfPrinter(PDF_FONTS);

      const data = solicitud?.datos_formulario || {};
      const salida = data.salida || {};

      const isPropiasCargoOficio = salida.categoria === 'propias_cargo' && salida.tipo !== 'salida_campus' && salida.duracionTipo && salida.duracionTipo !== 'menos_media_jornada';
      if (isPropiasCargoOficio) {
        const docDefinition = sanitizePdfDefinition(buildOficioPdfDefinition(solicitud, ghDirectorNombre, ghDirectorCargo));
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const docChunks = [];
        pdfDoc.on('data', chunk => docChunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(docChunks)));
        pdfDoc.on('error', err => reject(err));
        pdfDoc.end();
        return;
      }

      const solicitante = solicitud?.solicitante_snapshot || {};
      const jefe = solicitud?.jefe_snapshot || {};
      const laboral = data.laboral || {};
      const personal = data.personal || {};

      const isSalidaMultiple = Boolean(data.is_salida_multiple || data.isSalidaMultiple);
      const participantes = data.participantes || [];
      const isPropiasCargo = salida.categoria === 'propias_cargo' && salida.tipo !== 'salida_campus';
      const alcance = isPropiasCargo ? (salida.alcance || 'Local') : 'Local';
      let ubicacionStr = alcance;
      if (isPropiasCargo) {
        if (alcance === 'Internacional' && salida.pais) {
          ubicacionStr = `${alcance} (${salida.pais})`;
        } else if (alcance === 'Nacional' && salida.departamento && salida.municipio) {
          ubicacionStr = `${alcance} (${salida.municipio}, ${salida.departamento})`;
        } else if (alcance === 'Regional' && salida.municipio) {
          ubicacionStr = `${alcance} (${salida.municipio}, Nariño)`;
        }
      }
      const entidadDestinoStr = isPropiasCargo ? String(salida.entidadDestino || '').trim() : '';

      let motivoStr = salida.motivo || getTipoSalidaLabel(salida.tipo);
      if (salida.tipo === 'salida_campus' && salida.campusSalida && salida.campusDestino) {
        motivoStr = `Salida entre campus (${salida.campusSalida} a ${salida.campusDestino})${salida.motivo ? ` - ${salida.motivo}` : ''}`;
      } else if (salida.tipo === 'terapias' && salida.terapiasList?.length) {
        motivoStr = `Terapias (${salida.terapiasList.length}). ${salida.motivo || ''}`;
      } else if (['cita_eps', 'cita_particular'].includes(salida.tipo) && salida.especialidadMedica) {
        motivoStr = `${getTipoSalidaLabel(salida.tipo)} (${salida.especialidadMedica})${salida.motivo ? ` - ${salida.motivo}` : ''}`;
      }

      const docDefinition = {
        pageMargins: [35, 25, 35, 25],
        defaultStyle: { font: PDF_FONT_FAMILY, fontSize: 9.5, color: '#333333' },
        content: [
          {
            table: {
              widths: ['22%', '50%', '28%'],
              body: [
                [
                  {
                    image: path.join(__dirname, '../assets/logo_formatos.jpg'),
                    width: 100,
                    alignment: 'center',
                    margin: [0, 5, 0, 5]
                  },
                  {
                    text: '\nREPORTE DE SALIDA DURANTE LA\nJORNADA LABORAL',
                    alignment: 'center',
                    fontSize: 12,
                    bold: true,
                    margin: [0, 10, 0, 0]
                  },
                  {
                    table: {
                      widths: ['*'],
                      body: [
                        [ { text: 'CODIGO: THM-DP-FR-002', bold: true, fontSize: 9 } ],
                        [ { text: 'VERSION: 4', bold: true, fontSize: 9 } ],
                        [ { text: 'FECHA: 15/JUL/2026', bold: true, fontSize: 9 } ]
                      ]
                    },
                    layout: {
                      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0 : 1,
                      vLineWidth: () => 0,
                      paddingLeft: () => 4,
                      paddingRight: () => 4,
                      paddingTop: () => 2,
                      paddingBottom: () => 2
                    },
                    margin: [-4, -2, -4, -2]
                  }
                ]
              ]
            },
            layout: 'borders',
            margin: [0, 0, 0, 8]
          },
          {
            table: {
              widths: ['*'],
              body: [
                [ { text: '1. Información del Trabajador', bold: true, fillColor: '#e0e0e0', margin: [5, 3, 5, 3] } ]
              ]
            },
            margin: [0, 0, 0, 3]
          },
          {
            table: {
              widths: ['25%', '25%', '25%', '25%'],
              body: [
                [
                  { text: 'Nombres y apellidos:', bold: true },
                  { text: solicitante.nombre || personal.nombre || '' },
                  { text: 'Documento:', bold: true },
                  { text: solicitante.username || personal.documento || '' }
                ],
                [
                  { text: 'Cargo:', bold: true },
                  { text: laboral.cargo || '' },
                  { text: 'Dependencia:', bold: true },
                  { text: laboral.dependencia || '' }
                ],
                [
                  { text: 'Correo:', bold: true },
                  { text: solicitante.email || personal.correo || '', colSpan: 3 },
                  {}, {}
                ]
              ]
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 8]
          },
          {
            table: {
              widths: ['*'],
              body: [
                [ { text: '2. Datos de Salida', bold: true, fillColor: '#e0e0e0', margin: [5, 3, 5, 3] } ]
              ]
            },
            margin: [0, 0, 0, 3]
          },
          {
            table: {
              widths: ['25%', '25%', '25%', '25%'],
              body: (() => {
                const isReposicionType = salida.tipo === 'diligencia_personal';
                const tableBody = [];
                if (salida.tipo !== 'terapias') {
                  tableBody.push([
                    { text: 'Fecha de salida:', bold: true },
                    { text: formatDate(salida.fecha) },
                    { text: 'Hora de salida:', bold: true },
                    { text: formatTimeAmPm(salida.horaInicio) }
                  ]);
                  tableBody.push([
                    { text: 'Fecha de regreso:', bold: true },
                    { text: salida.tipo === 'urgencia_medica' ? 'No aplica (Urgencia)' : formatDate(salida.fechaRegreso || salida.fechaFin || salida.fecha) },
                    { text: 'Hora de regreso:', bold: true },
                    { text: salida.tipo === 'urgencia_medica' ? 'No aplica (Urgencia)' : (salida.categoria === 'salud' && salida.tipo !== 'terapias' && !salida.horaFin ? 'No especificada' : formatTimeAmPm(salida.horaFin)) }
                  ]);
                }
                tableBody.push([
                  { text: 'Alcance:', bold: true },
                  { text: ubicacionStr },
                  { text: 'Categoría:', bold: true },
                  { text: getTipoSalidaLabel(salida.tipo) }
                ]);
                if (entidadDestinoStr) {
                  tableBody.push([
                    { text: 'Entidad / institucion de destino:', bold: true },
                    { text: entidadDestinoStr, colSpan: 3 },
                    {}, {}
                  ]);
                }
                if (isReposicionType) {
                  tableBody.push([
                    { text: 'Tiempo solicitado:', bold: true },
                    { text: formatMinutes(solicitud.tiempo_solicitado_minutos) },
                    { text: 'Detalle/Motivo:', bold: true },
                    { text: motivoStr }
                  ]);
                } else {
                  tableBody.push([
                    { text: 'Detalle/Motivo:', bold: true },
                    { text: motivoStr, colSpan: 3 },
                    {}, {}
                  ]);
                }
                const declaracionSinAdjunto = getDeclaracionSinAdjunto(salida);
                if (declaracionSinAdjunto) {
                  tableBody.push([
                    { text: 'Declaracion de soportes:', bold: true },
                    { text: declaracionSinAdjunto, colSpan: 3 },
                    {}, {}
                  ]);
                }
                return tableBody;
              })()
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 8]
          }
        ]
      };

      if (salida.tipo === 'terapias' && salida.terapiasList?.length) {
         const tBody = [
           [
             { text: 'No.', bold: true, fillColor: '#f8f8f8' },
             { text: 'Fecha', bold: true, fillColor: '#f8f8f8' },
             { text: 'Hora inicio', bold: true, fillColor: '#f8f8f8' },
             { text: 'Hora fin', bold: true, fillColor: '#f8f8f8' }
           ]
         ];
         salida.terapiasList.forEach((t, i) => {
           tBody.push([
             (i + 1).toString(),
             formatDate(t.fecha),
             formatTimeAmPm(t.horaInicio),
             formatTimeAmPm(t.horaFin)
           ]);
         });
         
         tBody.push([
           { text: 'Tiempo total autorizado:', colSpan: 3, alignment: 'right', bold: true, fillColor: '#f8f8f8' },
           {},
           {},
           { text: formatMinutes(solicitud.tiempo_solicitado_minutos), bold: true, fillColor: '#f8f8f8', alignment: 'center' }
         ]);

         docDefinition.content.push({
           table: {
             widths: ['*'],
             body: [
               [ { text: `3. Cronograma de Terapias (${salida.terapiasList.length})`, bold: true, fillColor: '#e0e0e0', margin: [5, 3, 5, 3] } ]
             ]
           },
           margin: [0, 0, 0, 3]
         });

         docDefinition.content.push({
           table: {
             headerRows: 1,
             widths: ['10%', '30%', '30%', '30%'],
             body: tBody
           },
           layout: 'lightHorizontalLines',
           margin: [0, 0, 0, 8]
         });
      }

      if (isSalidaMultiple && participantes.length > 0) {
        docDefinition.content.push({
          table: {
            widths: ['*'],
            body: [
              [ { text: `3. Participantes de Salida Grupal (${participantes.length})`, bold: true, fillColor: '#e0e0e0', margin: [5, 3, 5, 3] } ]
            ]
          },
          margin: [0, 0, 0, 3]
        });

        const pBody = [
          [
            { text: 'Documento', bold: true, fillColor: '#f8f8f8' },
            { text: 'Nombre', bold: true, fillColor: '#f8f8f8' },
            { text: 'Cargo / Dependencia', bold: true, fillColor: '#f8f8f8' }
          ]
        ];
        participantes.forEach(p => {
          pBody.push([
            p.documento || p.username || '',
            p.nombre || p.nombres || '',
            `${p.cargo || ''} / ${p.dependencia || ''}`
          ]);
        });

        docDefinition.content.push({
          table: {
            headerRows: 1,
            widths: ['20%', '40%', '40%'],
            body: pBody
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 8]
        });
      }

      docDefinition.content.push(...buildReposicionPdfSection(solicitud, '4. Reposicion de tiempo'));

      ghDirectorCargo = solicitud.jefe_snapshot?.director_gh_cargo || ghDirectorCargo;
      const txId = solicitud.datos_formulario?.tx_id || String(solicitud.consecutivo || solicitud.id);
      const initialApprovalPdf = getInitialApprovalPdfInfo(solicitud);
      const reqDate = formatDateTime(getSolicitudCreatedAt(solicitud));
      const initialApprovalDateValue = initialApprovalPdf.dateValue
        || getDateCandidate(solicitud, ['jefe_aprobado_at']);
      const hasInitialApproval = Boolean(initialApprovalDateValue || solicitud.jefe_aprobado_at);
      const jefeDate = initialApprovalDateValue ? formatDateTime(initialApprovalDateValue) : 'Pendiente';
      const ghDateValue = getStageDate(solicitud, ['gestion_humana_aprobado_at'], ['aprobada_gestion_humana']);
      const ghDate = ghDateValue ? formatDateTime(ghDateValue) : 'Pendiente';

      const isPropiasCargoSubtype = ['ponencia', 'visita_ies', 'capacitacion', 'proyecto_investigacion', 'asistente_congreso', 'practica_academica', 'torneo_deportivo', 'salida_campus', 'otra'].includes(salida.tipo) || String(salida.tipo).startsWith('otra:');
      const requiresSst = isPropiasCargoSubtype && ['Nacional', 'Internacional'].includes(alcance);

      const sstEvent = getTraceByEvents(solicitud, ['aprobada_sst']);
      const sstApprovedAt = sstEvent ? new Date(sstEvent.at) : null;
      const sstDate = sstApprovedAt ? formatDateTime(sstApprovedAt) : 'Pendiente';
      const sstActorName = sstApprovedAt ? SST_RESPONSABLE_NOMBRE : 'Seguridad y Salud en el Trabajo';

      const signatureTableBody = [];
      const isLeader = Boolean(data.is_leader);

      if (isSalidaMultiple) {
        if (isLeader) {
          // Leader has:
          // Row 1: Solicitante (Líder) | RECIBIDO (Gestión del Talento Humano)
          signatureTableBody.push(
            [
              { text: 'Firma del trabajador Solicitante (Líder)', bold: true, alignment: 'center', fillColor: '#e0e0e0' },
              { text: 'RECIBIDO (Gestión del Talento Humano)', bold: true, alignment: 'center', fillColor: '#e0e0e0' }
            ],
            [
              {
                text: [
                  { text: 'Firmado electrónicamente por:\n', bold: true, fontSize: 9 },
                  { text: `${solicitante.nombre || personal.nombre || ''}\n`, fontSize: 10 },
                  { text: `Documento: ${solicitante.username || personal.documento || ''}\n`, fontSize: 8 },
                  { text: `Fecha y hora: ${reqDate}\n`, fontSize: 8 },
                  { text: `ID Transacción: ${txId}\n`, fontSize: 7, color: 'gray' }
                ],
                margin: [5, 5, 5, 5]
              },
              {
                text: [
                  { text: ghDateValue ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 9 },
                  { text: `${ghDateValue ? ghDirectorNombre : 'Pendiente'}\n`, fontSize: 10 },
                  { text: `Cargo: ${ghDirectorCargo}\n`, fontSize: 8 },
                  { text: `Fecha y hora: ${ghDate}\n`, fontSize: 8 },
                  { text: ghDateValue ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
                ],
                margin: [5, 5, 5, 5]
              }
            ]
          );

          if (requiresSst) {
            signatureTableBody.push(
              [
                { text: 'VISTO BUENO (Seguridad y Salud en el Trabajo)', bold: true, alignment: 'center', colSpan: 2, fillColor: '#e0e0e0' },
                {}
              ],
              [
                {
                  text: [
                    { text: sstApprovedAt ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 9 },
                    { text: `${sstApprovedAt ? sstActorName : 'Pendiente'}\n`, fontSize: 10 },
                    { text: `Cargo: ${SST_RESPONSABLE_CARGO}\n`, fontSize: 8 },
                    { text: `Fecha y hora: ${sstDate}\n`, fontSize: 8 },
                    { text: sstApprovedAt ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
                  ],
                  margin: [5, 5, 5, 5],
                  alignment: 'center',
                  colSpan: 2
                },
                {}
              ]
            );
          }
        } else {
          // Participant has:
          // Row 1: Solicitante | Líder de la Actividad
          // Row 2: RECIBIDO (Gestión del Talento Humano) (colSpan 2 if requiresSst is false, else col 1: GH, col 2: SST)
          let leaderName = 'Líder de la Actividad';
          let leaderCargo = 'Líder de la Actividad';
          let leaderDocument = '';
          let leaderDateValue = null;
          let hasLeaderApproval = false;

          try {
            const { ReporteSalidaSolicitud } = require('../models');
            const leaderSol = await ReporteSalidaSolicitud.findOne({
              where: {
                'datos_formulario.grupo_id': data.grupo_id,
                'datos_formulario.is_leader': true
              }
            });
            if (leaderSol) {
              leaderName = leaderSol.solicitante_snapshot?.nombre || leaderSol.datos_formulario?.personal?.nombre || '';
              leaderCargo = leaderSol.solicitante_snapshot?.cargo || leaderSol.datos_formulario?.laboral?.cargo || '';
              leaderDocument = leaderSol.solicitante_snapshot?.username || leaderSol.datos_formulario?.personal?.documento || '';
              leaderDateValue = leaderSol.created_at || leaderSol.createdAt;
              hasLeaderApproval = true;
            }
          } catch (err) {
            console.error('Error fetching leader solicitud for participant PDF:', err);
          }

          const leaderDateStr = leaderDateValue ? formatDateTime(leaderDateValue) : 'Pendiente';

          signatureTableBody.push(
            [
              { text: 'Firma del trabajador Solicitante', bold: true, alignment: 'center', fillColor: '#e0e0e0' },
              { text: 'Firma del Líder de la Actividad', bold: true, alignment: 'center', fillColor: '#e0e0e0' }
            ],
            [
              {
                text: [
                  { text: 'Firmado electrónicamente por:\n', bold: true, fontSize: 9 },
                  { text: `${solicitante.nombre || personal.nombre || ''}\n`, fontSize: 10 },
                  { text: `Documento: ${solicitante.username || personal.documento || ''}\n`, fontSize: 8 },
                  { text: `Fecha y hora: ${reqDate}\n`, fontSize: 8 },
                  { text: `ID Transacción: ${txId}\n`, fontSize: 7, color: 'gray' }
                ],
                margin: [5, 5, 5, 5]
              },
              {
                text: [
                  { text: hasLeaderApproval ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 9 },
                  { text: `${leaderName}\n`, fontSize: 10 },
                  { text: `Documento: ${leaderDocument}\n`, fontSize: 8 },
                  { text: `Cargo: ${leaderCargo}\n`, fontSize: 8 },
                  { text: `Fecha y hora: ${leaderDateStr}\n`, fontSize: 8 },
                  { text: hasLeaderApproval ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
                ],
                margin: [5, 5, 5, 5]
              }
            ]
          );

          if (requiresSst) {
            signatureTableBody.push(
              [
                { text: 'RECIBIDO (Gestión del Talento Humano)', bold: true, alignment: 'center', fillColor: '#e0e0e0' },
                { text: 'VISTO BUENO (Seguridad y Salud en el Trabajo)', bold: true, alignment: 'center', fillColor: '#e0e0e0' }
              ],
              [
                {
                  text: [
                    { text: ghDateValue ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 9 },
                    { text: `${ghDateValue ? ghDirectorNombre : 'Pendiente'}\n`, fontSize: 10 },
                    { text: `Cargo: ${ghDirectorCargo}\n`, fontSize: 8 },
                    { text: `Fecha y hora: ${ghDate}\n`, fontSize: 8 },
                    { text: ghDateValue ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
                  ],
                  margin: [5, 5, 5, 5]
                },
                {
                  text: [
                    { text: sstApprovedAt ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 9 },
                    { text: `${sstApprovedAt ? sstActorName : 'Pendiente'}\n`, fontSize: 10 },
                    { text: `Cargo: ${SST_RESPONSABLE_CARGO}\n`, fontSize: 8 },
                    { text: `Fecha y hora: ${sstDate}\n`, fontSize: 8 },
                    { text: sstApprovedAt ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
                  ],
                  margin: [5, 5, 5, 5]
                }
              ]
            );
          } else {
            signatureTableBody.push(
              [
                { text: 'RECIBIDO (Gestión del Talento Humano)', bold: true, alignment: 'center', colSpan: 2, fillColor: '#e0e0e0' },
                {}
              ],
              [
                {
                  text: [
                    { text: ghDateValue ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 9 },
                    { text: `${ghDateValue ? ghDirectorNombre : 'Pendiente'}\n`, fontSize: 10 },
                    { text: `Cargo: ${ghDirectorCargo}\n`, fontSize: 8 },
                    { text: `Fecha y hora: ${ghDate}\n`, fontSize: 8 },
                    { text: ghDateValue ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
                  ],
                  margin: [5, 5, 5, 5],
                  alignment: 'center',
                  colSpan: 2
                },
                {}
              ]
            );
          }
        }
      } else {
        // Original non-multiple logic
        signatureTableBody.push(
          [
            { text: 'Firma del trabajador Solicitante', bold: true, alignment: 'center', fillColor: '#e0e0e0' },
            { text: initialApprovalPdf.header, bold: true, alignment: 'center', fillColor: '#e0e0e0' }
          ],
          [
            {
              text: [
                { text: 'Firmado electrónicamente por:\n', bold: true, fontSize: 9 },
                { text: `${solicitante.nombre || personal.nombre || ''}\n`, fontSize: 10 },
                { text: `Documento: ${solicitante.username || personal.documento || ''}\n`, fontSize: 8 },
                { text: `Fecha y hora: ${reqDate}\n`, fontSize: 8 },
                { text: `ID Transacción: ${txId}\n`, fontSize: 7, color: 'gray' }
              ],
              margin: [5, 5, 5, 5]
            },
            {
              text: [
                { text: hasInitialApproval ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 9 },
                { text: `${hasInitialApproval ? initialApprovalPdf.name : 'Pendiente'}\n`, fontSize: 10 },
                { text: `Cargo: ${initialApprovalPdf.cargo || ''}\n`, fontSize: 8 },
                ...(initialApprovalPdf.viaDependencia && initialApprovalPdf.email ? [{ text: `Correo: ${initialApprovalPdf.email}\n`, fontSize: 8 }] : []),
                { text: `Fecha y hora: ${jefeDate}\n`, fontSize: 8 },
                { text: hasInitialApproval ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
              ],
              margin: [5, 5, 5, 5]
            }
          ]
        );

        if (requiresSst) {
          signatureTableBody.push([
            { text: 'RECIBIDO (Gestión del Talento Humano)', bold: true, alignment: 'center', fillColor: '#e0e0e0' },
            { text: 'VISTO BUENO (Seguridad y Salud en el Trabajo)', bold: true, alignment: 'center', fillColor: '#e0e0e0' }
          ]);
          signatureTableBody.push([
            {
              text: [
                { text: ghDateValue ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 9 },
                { text: `${ghDateValue ? ghDirectorNombre : 'Pendiente'}\n`, fontSize: 10 },
                { text: `Cargo: ${ghDirectorCargo}\n`, fontSize: 8 },
                { text: `Fecha y hora: ${ghDate}\n`, fontSize: 8 },
                { text: ghDateValue ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
              ],
              margin: [5, 5, 5, 5]
            },
            {
              text: [
                { text: sstApprovedAt ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 9 },
                { text: `${sstApprovedAt ? sstActorName : 'Pendiente'}\n`, fontSize: 10 },
                { text: `Cargo: ${SST_RESPONSABLE_CARGO}\n`, fontSize: 8 },
                { text: `Fecha y hora: ${sstDate}\n`, fontSize: 8 },
                { text: sstApprovedAt ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
              ],
              margin: [5, 5, 5, 5]
            }
          ]);
        } else {
          signatureTableBody.push([
            { text: 'RECIBIDO (Gestión del Talento Humano)', bold: true, alignment: 'center', colSpan: 2, fillColor: '#e0e0e0' },
            {}
          ]);
          signatureTableBody.push([
            {
              text: [
                { text: ghDateValue ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 9 },
                { text: `${ghDateValue ? ghDirectorNombre : 'Pendiente'}\n`, fontSize: 10 },
                { text: `Cargo: ${ghDirectorCargo}\n`, fontSize: 8 },
                { text: `Fecha y hora: ${ghDate}\n`, fontSize: 8 },
                { text: ghDateValue ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
              ],
              margin: [5, 5, 5, 5],
              alignment: 'center',
              colSpan: 2
            },
            {}
          ]);
        }
      }

      docDefinition.content.push({
        table: {
          widths: ['50%', '50%'],
          body: signatureTableBody
        },
        layout: 'borders',
        margin: [0, 0, 0, 8]
      });

      let trazabilidad = solicitud?.trazabilidad || [];
      if (typeof trazabilidad === 'string') {
        try { trazabilidad = JSON.parse(trazabilidad); } catch (e) { trazabilidad = []; }
      }
      if (!Array.isArray(trazabilidad)) trazabilidad = [];

      if (trazabilidad.length > 0) {
        const traceEventLabels = {
          'radicada': 'Radicación inicial',
          'radicada_grupal': 'Radicación de salida grupal',
          'correo_jefe_enviado': 'Notificación a Jefe Inmediato',
          'correo_jefe_error': 'Error al notificar a Jefe Inmediato',
          'aprobada_jefe': 'Aprobación de Jefe Inmediato',
          'aprobada_dependencia': 'Autorizacion por Dependencia',
          'visto_bueno_jefe': 'Visto bueno de Jefe Inmediato',
          'visto_bueno_dependencia': 'Visto bueno de Dependencia',
          'rechazada_jefe': 'Rechazada por Jefe Inmediato',
          'rechazada_dependencia': 'Rechazada por Dependencia',
          'correo_gestion_humana_enviado': 'Notificación a Gestión del Talento Humano',
          'correo_gestion_humana_error': 'Error al notificar a Gestión del Talento Humano',
          'aprobada_gestion_humana': 'Aprobación de Gestión del Talento Humano',
          'rechazada_gestion_humana': 'Rechazada por Gestión del Talento Humano',
          'correo_sst_enviado': 'Notificación a SST',
          'correo_sst_error': 'Error al notificar a SST',
          'aprobada_sst': 'Visto bueno de SST',
          'rechazada_sst': 'Rechazada por SST',
          'notificacion_final_enviada': 'Notificación final enviada',
          'reposicion_cumplida': 'Reposición marcada como cumplida',
          'reposicion_incumplida': 'Reposición marcada como incumplida',
          'reposicion_pendiente': 'Reposición marcada como pendiente'
        };

        const traceBody = [
          [
            { text: 'Fecha / Hora', bold: true, fillColor: '#f4f4f5' },
            { text: 'Evento', bold: true, fillColor: '#f4f4f5' },
            { text: 'Actor', bold: true, fillColor: '#f4f4f5' },
            { text: 'Detalle', bold: true, fillColor: '#f4f4f5' }
          ]
        ];

        trazabilidad.forEach(t => {
          const dateStr = t.at ? formatDateTime(t.at) : '';
          const eventStr = traceEventLabels[t.event] || t.event;
          
          let actorStr = t.actor?.nombre || t.actor?.username || '';
          if (!actorStr) {
            if (t.event.includes('_dependencia')) {
              actorStr = 'Dependencia';
            } else if (t.event.includes('_jefe')) {
              actorStr = solicitud?.jefe_snapshot?.nombre || 'Jefe Inmediato';
            } else if (t.event.includes('_gestion_humana')) {
              actorStr = 'Gestión del Talento Humano';
            } else if (t.event.includes('_sst')) {
              actorStr = 'Seguridad y Salud en el Trabajo';
            } else if (t.event.includes('correo_') || t.event.includes('notificacion_')) {
              actorStr = 'Sistema Automático';
            } else {
              actorStr = 'Sistema Automático';
            }
          }
          
          let detailStr = '';
          if (t.motivo) detailStr = t.motivo;
          if (t.observacion) detailStr = t.observacion;
          if (t.error) detailStr = `Error: ${t.error}`;
          if (t.justificacion) detailStr = `Justificación: ${t.justificacion}`;

          if (!detailStr) {
            if (t.event.includes('radicada')) detailStr = 'Se registró la solicitud en el sistema.';
            else if (t.event.includes('correo_')) detailStr = 'Correo electrónico enviado exitosamente.';
            else if (t.event.includes('notificacion_final')) detailStr = 'Correos finales de cierre enviados al colaborador, dependencia, Gestión del Talento Humano y Seguridad y Salud en el Trabajo (SST).';
            else if (t.event.includes('aprobada_')) detailStr = 'Aprobado sin observaciones adicionales.';
            else if (t.event.includes('rechazada_')) detailStr = 'Rechazado sin justificación adicional.';
            else detailStr = 'Procesado exitosamente.';
          }

          traceBody.push([
            { text: dateStr, fontSize: 8 },
            { text: eventStr, fontSize: 8 },
            { text: actorStr, fontSize: 8 },
            { text: detailStr, fontSize: 8 }
          ]);
        });

        docDefinition.content.push({
          table: {
            widths: ['20%', '30%', '25%', '25%'],
            body: traceBody
          },
          layout: 'lightHorizontalLines',
          margin: [0, 5, 0, 8]
        });
      }

      docDefinition.content.push({
        text: [
          'Documento generado automáticamente desde SIAC UNICESMAG con la información diligenciada en el formulario digital.\n',
          'Toda la información personal suministrada en este reporte será tratada de forma estrictamente confidencial, en cumplimiento y de acuerdo con la Política de Tratamiento de Datos Personales de UNICESMAG, garantizando su uso exclusivo para los fines administrativos e institucionales correspondientes.'
        ],
        fontSize: 8,
        color: '#71717a',
        alignment: 'center',
        margin: [20, 5, 20, 0]
      });

      const frontendUrl = process.env.FRONTEND_URL || 'https://planeaciongp.unicesmag.edu.co';
      const verifyUrl = `${frontendUrl.replace(/\/$/, '')}/verificar/${txId}`;
      docDefinition.content.push({
        unbreakable: true,
        columns: [
          {
            width: 105,
            qr: verifyUrl,
            fit: 95,
            margin: [0, 0, 10, 0]
          },
          {
            width: '*',
            text: [
              { text: 'Verificación de Autenticidad e Integridad\n', bold: true, fontSize: 9 },
              { text: 'Este documento ha sido firmado electrónicamente. Para verificar su validez legal y confirmar que no ha sido alterado, escanee el código QR o ingrese a:\n', fontSize: 8 },
              { text: verifyUrl, fontSize: 8, color: 'blue', link: verifyUrl }
            ],
            margin: [0, 5, 0, 0]
          }
        ],
        margin: [20, 10, 20, 5]
      });

      const pdfOptions = {
        userPassword: '', 
        ownerPassword: process.env.PDF_OWNER_PASSWORD || 'UNICESMAG-SECURE-2026',
        permissions: {
          modifying: false,
          copying: false,
          annotating: false,
          fillingForms: false
        }
      };

      const pdfDoc = printer.createPdfKitDocument(sanitizePdfDefinition(docDefinition), pdfOptions);
      const docChunks = [];
      pdfDoc.on('data', chunk => docChunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(docChunks)));
      pdfDoc.on('error', err => reject(err));
      pdfDoc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const ensureReporteSalidaPdf = async (solicitud, docxAttachment = null) => {
  const outDir = path.resolve(__dirname, '../../uploads/reporte-salida');
  await fs.promises.mkdir(outDir, { recursive: true });
  
  const data = solicitud.datos_formulario || {};
  const isOficio = data.salida?.categoria === 'propias_cargo' && data.salida?.tipo !== 'salida_campus' && data.salida?.duracionTipo && data.salida?.duracionTipo !== 'menos_media_jornada';
  const docType = isOficio ? 'Oficio-Salida' : 'FR-002-digital';
  
  const filename = `REPORTE-SALIDA-${String(solicitud.consecutivo || solicitud.id).replace(/[^a-zA-Z0-9_-]/g, '_')}-${docType}.pdf`;
  const filePath = path.join(outDir, filename);

  const buffer = await buildPdfBuffer(solicitud);
  await fs.promises.writeFile(filePath, buffer);
  
  return {
    filename,
    path: filePath,
    contentType: 'application/pdf'
  };
};

const ensureReporteSalidaDocx = async (solicitud) => {
  const outDir = path.resolve(__dirname, '../../uploads/reporte-salida');
  await fs.promises.mkdir(outDir, { recursive: true });
  const base = String(solicitud.consecutivo || solicitud.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${base}-FR-002-diligenciado.docx`;
  const filePath = path.join(outDir, filename);
  const buffer = await buildFilledDocxBuffer(solicitud);
  await fs.promises.writeFile(filePath, buffer);
  return {
    filename,
    path: filePath,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
};

module.exports = {
  ensureReporteSalidaDocx,
  ensureReporteSalidaPdf,
  formatMinutes,
  getReposicionPdfInfo,
  buildReposicionPdfSection
};
