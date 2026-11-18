const path = require('node:path');
const { getObservationHistory, formatObservationDate } = require('./observationHistory');

const text = value => String(value ?? '').trim();
const value = input => text(input) || 'No registrado';
const date = input => {
  const raw = text(input);
  if (!(input instanceof Date) && !/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw || 'No registrada';
  const parsed = input instanceof Date ? input : new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00Z` : raw);
  if (!Number.isFinite(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric'
  });
};
const time = input => {
  const match = text(input).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value(input);
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? 'a. m.' : 'p. m.'}`;
};
const title = label => ({ text: label, headlineLevel: 1, bold: true, color: '#0b3a6f', fontSize: 10, margin: [0, 12, 0, 6] });
const field = (label, content) => [{ text: label, bold: true, color: '#334155', fillColor: '#eff5fb' }, { text: value(content) }];
const table = rows => ({
  table: { widths: [128, '*'], body: rows },
  layout: { hLineColor: () => '#d4e0ed', vLineColor: () => '#d4e0ed', hLineWidth: () => .5, vLineWidth: () => .5,
    paddingLeft: () => 7, paddingRight: () => 7, paddingTop: () => 5, paddingBottom: () => 5 }
});
const section = (label, rows) => {
  const result = table(rows);
  result.margin = [0, 12, 0, 0];
  result.table.headerRows = 1;
  result.table.keepWithHeaderRows = 1;
  result.table.body.unshift([{ text: label, colSpan: 2, bold: true, color: '#0b3a6f', fillColor: '#e7f0fa', fontSize: 10 }, {}]);
  return result;
};
const aliases = {
  jefe: ['aprobada_jefe', 'visto_bueno_jefe', 'aprobada_dependencia'],
  financiera_previa: ['aprobada_vicerrectoria_financiera'],
  vicerrectoria_dependencia: ['aprobada_vicerrectoria_academica'],
  sst: ['aprobada_sst'], gestion_humana: ['aprobada_gestion_humana'], rectoria: ['aprobada_rectoria']
};

// Exclusivo para el oficio vinculado a viáticos. No modifica los oficios normales.
const buildViaticosOficioDefinition = (solicitud, { font, annexLabel, createdAt } = {}) => {
  const data = solicitud.datos_formulario || {};
  const salida = data.salida || {}, viaticos = data.viaticos || {};
  const personal = data.personal || {}, laboral = data.laboral || {};
  const solicitante = solicitud.solicitante_snapshot || {}, jefe = solicitud.jefe_snapshot || {};
  const traces = Array.isArray(solicitud.trazabilidad) ? solicitud.trazabilidad : [];
  const storedPlan = Array.isArray(data.plan_aprobacion_normal) ? data.plan_aprobacion_normal : [];
  const plan = storedPlan.filter((step, index, items) => step.key && items.findIndex(item => item.key === step.key) === index);
  const paymentConfirmed = traces.some(trace => trace.event === 'pago_autorizado_tesoreria' || (trace.event === 'finalizada' && trace.detail?.pago_autorizado === true));
  const finalized = paymentConfirmed && ['finalizada', 'pago_autorizado_pendiente_legalizacion', 'legalizacion_finalizada'].includes(solicitud.estado);
  const rejected = solicitud.estado === 'no_aprobada';
  const status = finalized ? 'Salida autorizada · trámite aprobado' : rejected ? 'Solicitud no aprobada' : 'Solicitud en trámite de aprobación';
  const name = value(solicitante.nombre || personal.nombre);
  const email = text(solicitante.email || solicitante.correo || personal.correo || personal.email);
  const cargo = text(laboral.cargo || solicitante.cargo);
  const dependencia = text(laboral.dependencia || solicitante.dependencia);
  const purpose = text(viaticos.objetoComision || salida.motivo);
  const destination = [...new Set([viaticos.lugarVisitar, salida.entidadDestino, salida.municipio, salida.departamento, salida.pais].map(text).filter(Boolean))].join(' · ');
  const days = Number(viaticos.numeroDiasSolicitados);
  const duration = Number.isInteger(days) && days > 0 ? `${days} ${days === 1 ? 'día solicitado' : 'días solicitados'}` : 'Días no registrados';
  const txId = text(data.tx_id || solicitud.consecutivo || solicitud.id);
  const verifyUrl = `${(process.env.FRONTEND_URL || 'https://planeaciongp.unicesmag.edu.co').replace(/\/$/, '')}/verificar/${encodeURIComponent(txId)}`;
  const radication = traces.find(trace => ['radicada', 'radicada_grupal'].includes(trace.event));
  const findTrace = key => [...traces].reverse().find(trace => [...(aliases[key] || []), `aprobado_${key}`, `completado_${key}`].includes(trace.event));
  const signatures = [{ label: 'Trabajador solicitante', trace: radication,
    name, cargo, email, signed: Boolean(radication), at: radication?.at }];
  plan.forEach(step => {
    const trace = findTrace(step.key);
    signatures.push({ label: step.label || step.key, trace,
      name: trace?.actor?.nombre || (step.key === 'jefe' ? jefe.nombre : '') || step.label,
      cargo: trace?.actor?.cargo || (step.key === 'jefe' ? jefe.cargo : '') || step.label,
      email: trace?.actor?.email || step.email, signed: Boolean(trace), at: trace?.at });
  });
  const payment = [...traces].reverse().find(trace => trace.event === 'pago_autorizado_tesoreria');
  if (payment) signatures.push({ label: 'Cierre del trámite de viáticos · Tesorería / Pagaduría',
    name: payment.actor?.nombre || 'Tesorería / Pagaduría', cargo: payment.actor?.cargo || 'Tesorería / Pagaduría',
    email: payment.actor?.email, signed: true, at: payment.at });
  const signatureRows = [];
  for (let index = 0; index < signatures.length; index += 2) {
    const pair = signatures.slice(index, index + 2);
    const heading = pair.map(item => ({ text: item.label, bold: true, color: '#0b3a6f', fillColor: '#eef5fd', margin: [5, 5, 5, 5] }));
    const cells = pair.map(item => ({ margin: [5, 5, 5, 6], stack: [
      { text: item.signed ? 'Actuación registrada electrónicamente' : 'Actuación pendiente', bold: true, color: item.signed ? '#166534' : '#64748b', fontSize: 8 },
      { text: item.signed ? value(item.name) : 'Pendiente', bold: true, margin: [0, 3, 0, 2] },
      { text: `Cargo / instancia: ${value(item.cargo)}`, fontSize: 8 },
      { text: `Correo: ${value(item.email)}`, fontSize: 8 },
      { text: `Fecha y hora: ${item.signed ? formatObservationDate(item.at) : 'Pendiente'}`, fontSize: 8 }
    ] }));
    if (pair.length === 1) { heading.push({ text: '' }); cells.push({ text: '' }); }
    signatureRows.push(...[heading, cells]);
  }
  const history = getObservationHistory({ ...solicitud, plan_aprobacion: plan });
  const route = [...plan.map(step => step.label || step.key), 'Técnico Contable', 'Tesorería / Pagaduría'].join(' → ');
  const closing = finalized
    ? 'Se deja constancia del trámite de la salida institucional y de las actuaciones registradas en el SIAC. La liquidación de viáticos y gastos de viaje se documenta en el formato FR-004 asociado; este oficio no sustituye dicho documento ni la legalización posterior.'
    : rejected ? 'El presente documento conserva los datos de la solicitud y su estado de no aprobación. No constituye autorización de salida ni de desembolso.'
      : 'La presente solicitud se somete a revisión de las instancias competentes. Su radicación y los vistos buenos parciales no constituyen autorización definitiva de salida ni de desembolso; esta se determina al completar el flujo de aprobación de viáticos.';
  const content = [
    { columns: [{ width: '*', stack: [
      { text: 'OFICIO DE SALIDA INSTITUCIONAL', color: '#0b3a6f', bold: true, fontSize: 15 },
      { text: value(solicitud.consecutivo), bold: true, color: '#475569', margin: [0, 4, 0, 2] },
      { text: `San Juan de Pasto, ${date(createdAt || radication?.at || solicitud.created_at || new Date().toISOString())}`, fontSize: 9 }
    ] }, { width: 64, qr: verifyUrl, fit: 54, alignment: 'right' }], margin: [0, 0, 0, 12] },
    { text: status, bold: true, color: finalized ? '#166534' : '#0b3a6f', fillColor: '#eff5fb', margin: [0, 0, 0, 10] },
    { text: [value(salida.destinatarioTratamiento || 'Señor(a)'), '\n', { text: value(salida.destinatarioNombre || jefe.nombre || jefe.cargo || 'Autoridad competente'), bold: true },
      '\n', value(salida.destinatarioCargo || jefe.cargo || jefe.dependencia), '\nUniversidad CESMAG'], margin: [0, 0, 0, 10] },
    { text: `Asunto: ${salida.oficioAsunto || (finalized ? 'Constancia de autorización de salida institucional con viáticos' : 'Solicitud de autorización de salida institucional con viáticos')}`, bold: true, color: '#0b3a6f', margin: [0, 0, 0, 9] },
    { text: 'Saludo de Paz y Bien.', margin: [0, 0, 0, 8] },
    { text: salida.oficioCuerpo || `En mi calidad de ${cargo || 'colaborador(a)'} de ${dependencia || 'la dependencia registrada'} de la Universidad CESMAG, presento la información de la salida institucional relacionada con la misión descrita a continuación, para su trámite y constancia ante las instancias competentes.`, alignment: 'justify', margin: [0, 0, 0, 6] },
    section('1. Identificación del solicitante', [field('Nombres y apellidos', name), field('Documento de identificación', solicitante.username || solicitante.documento || personal.documento),
      field('Cargo', cargo), field('Programa / dependencia', dependencia), field('Correo institucional', email)]),
    section('2. Objeto y alcance de la misión', [field('Objeto de la comisión', purpose), field('Actividad / motivo registrado', salida.motivo), field('Destino / entidad a visitar', destination),
      field('Alcance del desplazamiento', salida.alcance), ...(viaticos.fechaEvento ? [field('Fecha del evento', date(viaticos.fechaEvento))] : [])]),
    section('3. Programación y condiciones del desplazamiento', [field('Salida programada', `${date(salida.fecha)} · ${time(salida.horaInicio)}`), field('Regreso programado', `${date(salida.fechaRegreso)} · ${time(salida.horaFin)}`),
      field('Duración solicitada en FR-004', duration), field('Transporte autorizado', viaticos.transporte), field('Alojamiento', viaticos.alojamiento),
      ...(viaticos.observacionesEspeciales ? [field('Condiciones especiales', viaticos.observacionesEspeciales)] : [])]),
    title('4. Condiciones del trámite institucional'),
    { text: closing, alignment: 'justify', margin: [0, 0, 0, 7] },
    { text: [{ text: 'Ruta de aprobación registrada: ', bold: true }, route], fontSize: 8.5, color: '#475569', margin: [0, 0, 0, 8] },
    { text: 'Agradezco la revisión y gestión correspondiente de esta salida, en atención a las actividades y responsabilidades institucionales de la Universidad CESMAG.', alignment: 'justify', margin: [0, 0, 0, 8] },
    { text: salida.oficioDespedida || 'Fraternalmente,', margin: [0, 0, 0, 8] },
    title('5. Actuaciones y firmas electrónicas'),
    ...Array.from({ length: Math.ceil(signatureRows.length / 2) }, (_, index) => ({
      unbreakable: true,
      table: { widths: ['50%', '50%'], body: signatureRows.slice(index * 2, index * 2 + 2) },
      layout: 'lightHorizontalLines'
    })),
    ...(history.length ? [title('6. Observaciones registradas durante el trámite'), ...history.map((obs, index) => ({ margin: [0, 0, 0, 9], stack: [
      { text: `${index + 1}. ${obs.stepLabel} · ${formatObservationDate(obs.date)}`, bold: true, color: '#0b3a6f' },
      { text: `Usuario: ${obs.actorName}\nCargo: ${obs.actorCargo || 'No registrado'}\nCorreo: ${obs.actorEmail || 'No registrado'}`, fontSize: 8.5, margin: [0, 4, 0, 4] },
      { text: obs.text, alignment: 'justify' }
    ] }))] : []),
    title('Anexos y verificación'),
    { text: `Anexos: ${annexLabel || 'Sin anexos registrados'}`, fontSize: 8.5, margin: [0, 0, 0, 4] },
    { text: `Elaborado a partir de la información radicada por: ${name}.`, fontSize: 8.5, margin: [0, 0, 0, 4] },
    { text: `ID de transacción: ${txId}`, fontSize: 7.5, color: '#64748b' },
    { text: 'Verificar la solicitud y su estado en SIAC UNICESMAG', link: verifyUrl, color: '#0b3a6f', decoration: 'underline', fontSize: 8.5, margin: [0, 4, 0, 0] }
  ];
  return {
    pageSize: 'LETTER', pageMargins: [48, 106, 48, 110],
    defaultStyle: { font, fontSize: 9, color: '#24364b', lineHeight: 1.15 },
    background: () => ({ image: path.join(__dirname, '../../assets/fr013-carta-bg.png'), width: 612, height: 792 }),
    header: (currentPage, pageCount) => ({ text: `UNICESMAG · SIAC · ${value(solicitud.consecutivo)} · Página ${currentPage} de ${pageCount}`, fontSize: 7, color: '#64748b', alignment: 'right', margin: [48, 87, 48, 0] }),
    content
  };
};

module.exports = { buildViaticosOficioDefinition };
