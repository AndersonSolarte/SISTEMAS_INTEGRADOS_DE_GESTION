const test = require('node:test');
const assert = require('node:assert/strict');

const { _internals } = require('../../controllers/desplazamientoViaticosController');
const { buildLiquidationDefinition } = require('./pdfService');

test('la interfaz del técnico reproduce el FR-004 con datos reales y formato institucional', () => {
  const html = _internals.liquidationRequestDocumentHtml({
    consecutivo: 'ADF-PP-FR-004-2026-0042',
    created_at: new Date('2026-08-13T12:00:00-05:00'),
    solicitante_snapshot: {
      nombre: 'COLABORADOR DE PRUEBA',
      documento: '1085000123',
      email: 'colaborador@unicesmag.edu.co'
    },
    datos_laborales: {
      dependencia: 'Dirección de Planeación',
      cargo: 'Profesional universitario'
    },
    datos_salida: {
      fecha: '2026-08-20',
      horaInicio: '08:15',
      fechaRegreso: '2026-08-22',
      horaFin: '18:30'
    },
    datos_viaticos: {
      numeroDiasSolicitados: 3,
      lugarVisitar: 'Bogotá D. C.',
      fechaEvento: '2026-08-20',
      objetoComision: 'Comisión institucional',
      centroCosto: '101444',
      alojamiento: 'Hotel',
      transporte: 'Aéreo',
      tipoCuenta: 'Ahorros',
      entidadBancaria: 'Bancolombia',
      numeroCuenta: '123456789'
    }
  }, { currentStepKey: 'tecnico_contable', formId: 'liquidacion-form', isTechnician: true });

  assert.match(html, /logo-formatos\.jpg/);
  assert.match(html, /SOLICITUD DE DESPLAZAMIENTO/);
  assert.match(html, /CÓDIGO: ADF-PP-FR-004/);
  assert.match(html, /COLABORADOR DE PRUEBA/);
  assert.match(html, /8:15 a\. m\./);
  assert.match(html, /6:30 p\. m\./);
  assert.match(html, /Bancolombia/);
  assert.match(html, /fr004-span-4 fr004-emphasis[^>]*><span>Objeto de la comisión/);
  assert.match(html, /fr004-span-4[^>]*><span>Observaciones especiales/);
  assert.match(html, /name="centroCosto"/);
  assert.match(html, /form="liquidacion-form"/);
  assert.match(html, /centroCosto[^>]+required/);
  assert.doesNotMatch(html, /Consecutivo institucional/);
  assert.match(html, /\.brand-bar\{display:block/);
  assert.match(html, /\.institutional-image,\.page-title,\.institutional-signature\{display:none\}/);
  assert.match(html, /\.fr004-field\{display:flex;min-width:0;min-height:36px;padding:6px 9px/);
  assert.match(html, /input\.fr004-editable:required:invalid\{border-color:#dc2626/);
  assert.match(html, /\.fr004-section-title\{[^}]+border-left:4px solid #1d4ed8/);
  assert.match(html, /\.fr004-authorization\{[^}]+border-left:3px solid #059669/);
});

test('el colaborador puede radicar sin conocer el centro de costos', () => {
  const issues = _internals.validatePayload({
    documentoId: 1,
    isSalidaMultiple: false,
    jefeInmediato: { email: 'jefe@unicesmag.edu.co' },
    laboral: {
      dependencia: 'Dirección de Planeación',
      cargo: 'Profesional universitario',
      vicerrectoria: 'Rectoría'
    },
    salida: {
      categoria: 'propias_cargo',
      alcance: 'Nacional',
      fecha: '2026-08-20',
      horaInicio: '08:00',
      fechaRegreso: '2026-08-22',
      horaFin: '18:00'
    },
    viaticos: {
      requiereViaticos: true,
      lugarVisitar: 'Bogotá D. C.',
      fechaEvento: '2026-08-20',
      numeroDiasSolicitados: 3,
      objetoComision: 'Comisión institucional',
      centroCosto: '',
      alojamiento: 'Hotel',
      transporte: 'Terrestre',
      tipoCuenta: 'Ahorros',
      entidadBancaria: 'Bancolombia',
      numeroCuenta: '123456789',
      autorizacionAceptada: true,
      soporteAdjunto: { filename: 'oficio_aprobado.pdf' }
    }
  });

  assert.deepEqual(issues, []);
});

test('exige oficio debidamente firmado por rector, vicerrectoria y jefe si no es oficina de comunicaciones', () => {
  const issues = _internals.validatePayload({
    documentoId: 1,
    isSalidaMultiple: false,
    jefeInmediato: { email: 'jefe@unicesmag.edu.co' },
    laboral: {
      dependencia: 'Facultad de Ingeniería',
      cargo: 'Docente',
      vicerrectoria: 'Vicerrectoría Académica'
    },
    salida: {
      categoria: 'propias_cargo',
      alcance: 'Nacional',
      fecha: '2026-08-20',
      horaInicio: '08:00',
      fechaRegreso: '2026-08-22',
      horaFin: '18:00'
    },
    viaticos: {
      requiereViaticos: true,
      lugarVisitar: 'Cali',
      fechaEvento: '2026-08-20',
      numeroDiasSolicitados: 3,
      objetoComision: 'Ponencia en congreso',
      alojamiento: 'Hotel',
      transporte: 'Terrestre',
      tipoCuenta: 'Ahorros',
      entidadBancaria: 'Bancolombia',
      numeroCuenta: '123456789',
      autorizacionAceptada: true
    }
  });

  assert.ok(issues.includes('Debe adjuntar el oficio debidamente firmado por Rector, Vicerrectoría a la que pertenece y Jefe Inmediato.'));
});

test('permite radicar viaticos sin oficio adjunto a la Oficina de Comunicaciones y Mercadeo', () => {
  const issues = _internals.validatePayload({
    documentoId: 1,
    isSalidaMultiple: false,
    jefeInmediato: { email: 'jefe@unicesmag.edu.co' },
    laboral: {
      dependencia: 'Oficina de Comunicaciones y Mercadeo',
      cargo: 'Comunicador',
      vicerrectoria: 'Rectoría'
    },
    salida: {
      categoria: 'propias_cargo',
      alcance: 'Nacional',
      fecha: '2026-08-20',
      horaInicio: '08:00',
      fechaRegreso: '2026-08-22',
      horaFin: '18:00'
    },
    viaticos: {
      requiereViaticos: true,
      lugarVisitar: 'Ipiales',
      fechaEvento: '2026-08-20',
      numeroDiasSolicitados: 2,
      objetoComision: 'Cobertura fotográfica y de medios',
      alojamiento: 'Hotel',
      transporte: 'Terrestre',
      tipoCuenta: 'Ahorros',
      entidadBancaria: 'Bancolombia',
      numeroCuenta: '987654321',
      autorizacionAceptada: true
    }
  });

  assert.deepEqual(issues, []);
});

test('el PDF final de liquidación conserva toda la información del desplazamiento', () => {
  const definition = buildLiquidationDefinition({
    consecutivo: 'ADF-PP-FR-004-2026-0042',
    created_at: new Date('2026-08-13T12:00:00-05:00'),
    solicitante_snapshot: {
      nombre: 'COLABORADOR COMPLETO',
      documento: '1085000123',
      email: 'colaborador@unicesmag.edu.co'
    },
    datos_laborales: { dependencia: 'Dirección de Planeación', cargo: 'Profesional' },
    datos_salida: { fecha: '2026-08-20', horaInicio: '08:15', fechaRegreso: '2026-08-22', horaFin: '18:30' },
    datos_viaticos: {
      lugarVisitar: 'Bogotá D. C.', fechaEvento: '2026-08-20', numeroDiasSolicitados: 3,
      objetoComision: 'Objeto completo', observacionesEspeciales: 'Observación completa',
      centroCosto: 'CC-5018', alojamiento: 'Hotel', transporte: 'Aéreo', tipoCuenta: 'Ahorros',
      entidadBancaria: 'Bancolombia', numeroCuenta: '123456789', autorizacionAceptada: true
    },
    liquidacion: {
      detalles: [{ detalle: 'Manutención', valorDiario: 100000, dias: 3, valorTotal: 300000 }],
      totalAnticipo: 300000,
      observaciones: 'Liquidación revisada'
    },
    plan_aprobacion: [],
    trazabilidad: []
  });
  const content = JSON.stringify(definition.content);

  [
    'colaborador@unicesmag.edu.co', '20/8/2026', 'CC-5018', 'Hotel / Aéreo',
    'Ahorros', 'Bancolombia · 123456789', 'Objeto completo', 'Observación completa',
    'Aceptada electrónicamente', 'Manutención', 'Liquidación revisada'
  ].forEach((expected) => assert.ok(content.includes(expected), `Falta en el PDF: ${expected}`));
});

test('parseLiquidationBody procesa correctamente conceptos diligenciados e ignora conceptos en cero', () => {
  const result = _internals.parseLiquidationBody({
    liquidationRowsVersion: '2',
    baseIncluded0: '1',
    valorDiario0: '50000',
    dias0: '1',
    baseIncluded1: '1',
    valorDiario1: '0',
    dias1: '0',
    baseIncluded2: '1',
    valorDiario2: '0',
    dias2: '0',
    observaciones: 'Pago único'
  });

  assert.equal(result.error, undefined);
  assert.equal(result.totalAnticipo, 50000);
  assert.equal(result.detalles.length, 1);
  assert.equal(result.detalles[0].detalle, 'Manutención');
  assert.equal(result.detalles[0].valorTotal, 50000);
});

test('rechaza una fila con valor diario pero sin número de días en lugar de guardarla en cero', () => {
  const result = _internals.parseLiquidationBody({
    liquidationRowsVersion: '2',
    baseIncluded0: '1',
    valorDiario0: '43000',
    dias0: '0'
  });

  assert.match(result.error, /Complete el valor diario y el número de días para "Manutención"/);
});

const actionFormSolicitud = {
  id: 42,
  consecutivo: 'ADF-PP-FR-004-2026-0042',
  created_at: new Date('2026-08-13T12:00:00-05:00'),
  estado: 'pendiente',
  solicitante_snapshot: { nombre: 'COLABORADOR DE PRUEBA', documento: '1085000123', email: 'colaborador@unicesmag.edu.co' },
  datos_laborales: { dependencia: 'Planeación', cargo: 'Profesional' },
  datos_salida: { fecha: '2026-08-20', horaInicio: '08:00', fechaRegreso: '2026-08-21', horaFin: '18:00' },
  datos_viaticos: { lugarVisitar: 'Bogotá', alojamiento: 'Hotel', transporte: 'Aéreo', tipoCuenta: 'Ahorros', entidadBancaria: 'Bancolombia', numeroCuenta: '123456789' },
  liquidacion: { detalles: [{ detalle: 'Manutención', valorDiario: 50000, dias: 1, valorTotal: 50000 }], totalAnticipo: 50000 },
  plan_aprobacion: [],
  trazabilidad: []
};

test('todos los botones de visto bueno envían las acciones que acepta el backend', () => {
  const html = _internals.approvalForm(actionFormSolicitud, { key: 'jefe', label: 'Jefe inmediato' }, 'token-aprobacion');

  assert.match(html, /action="\/api\/desplazamientos-viaticos\/accion\/token-aprobacion"/);
  assert.match(html, /name="accion" value="aprobar" type="submit">Dar visto bueno<\/button>/);
  assert.match(html, /name="accion" value="rechazar" type="submit" formnovalidate>No aprobar<\/button>/);
  assert.doesNotMatch(html, /Signatures\(solicitud, currentStepKey\)/);
});

test('el rechazo delegado conserva obligatoria la observación', () => {
  const step = {
    key: 'jefe',
    label: 'Jefe inmediato',
    alternateAccessSource: 'programa_alterno',
    alternateApprovalLabel: 'Programa académico'
  };
  const html = _internals.approvalForm(actionFormSolicitud, step, 'token-delegado', { accessSource: 'programa_alterno' });

  assert.match(html, /textarea name="observacion"[^>]+ required/);
  assert.match(html, /name="accion" value="rechazar" type="submit">No aprobar<\/button>/);
});

test('liquidación usa valores nativos de botón y permite rechazar sin bloquearse por campos requeridos', () => {
  const html = _internals.liquidacionForm(actionFormSolicitud, 'token-liquidacion', 'nonce');

  assert.match(html, /name="accion" value="liquidar">Enviar liquidación a Tesorería<\/button>/);
  assert.match(html, /name="accion" value="rechazar" formnovalidate>Rechazar financiación<\/button>/);
  assert.doesNotMatch(html, /id="form-accion"/);
  assert.doesNotMatch(html, /onclick="document\.getElementById\('form-accion'\)/);
  assert.match(html, /function suggestRequestedDays\(target\)/);
  assert.match(html, /daysInput\.value = '2'/);
  assert.match(html, /Al ingresar un valor se propondrán 2 día\(s\)/);
});

test('las dos modalidades de prueba de liquidación envían una sola acción válida', () => {
  const technicianHtml = _internals.liquidacionForm(actionFormSolicitud, 'token-demo-tecnico', 'nonce', { demo: true, demoCanSubmit: true, demoTechnicianOnly: true });
  const treasuryHtml = _internals.liquidacionForm(actionFormSolicitud, 'token-demo-tesoreria', 'nonce', { demo: true, demoCanSubmit: true });

  assert.equal((technicianHtml.match(/name="accion"/g) || []).length, 1);
  assert.equal((treasuryHtml.match(/name="accion"/g) || []).length, 1);
  assert.match(technicianHtml, /name="accion" value="liquidar">Procesar liquidación de prueba<\/button>/);
  assert.match(treasuryHtml, /name="accion" value="liquidar">Enviar liquidación de prueba a Tesorería<\/button>/);
});

test('Tesorería puede autorizar o rechazar aunque existan campos editables requeridos', () => {
  const html = _internals.treasuryForm(actionFormSolicitud, 'token-tesoreria');

  assert.match(html, /name="accion" value="autorizar_pago" type="submit">Autorizar pago<\/button>/);
  assert.match(html, /name="accion" value="rechazar_pago" type="submit" formnovalidate>No autorizar pago<\/button>/);
  assert.match(html, /name="numeroCuenta"[^>]+required/);
});

test('el flujo anterior de Tesorería conserva su acción tramitar', () => {
  const html = _internals.legacyTreasuryForm(actionFormSolicitud, 'token-anterior');

  assert.match(html, /name="accion" value="tramitar" type="submit">Tramitar solicitud<\/button>/);
});

test('la trazabilidad resume la entrega primaria y alterna del enlace de aprobación', () => {
  const summary = _internals.summarizeStageEmailResult({
    key: 'financiera_previa',
    email: 'jcnandar@unicesmag.edu.co',
    alternateApprovalEmail: 'viceadfin@unicesmag.edu.co',
    alternateAccessSource: 'vicerrectoria_financiera_institucional'
  }, {
    success: true,
    primary: { success: true, messageId: 'mensaje-primario' },
    alternate: { success: true, messageId: 'mensaje-alterno' }
  });

  assert.equal(summary.success, true);
  assert.deepEqual(summary.destinatarios, ['jcnandar@unicesmag.edu.co', 'viceadfin@unicesmag.edu.co']);
  assert.equal(summary.entregas[0].messageId, 'mensaje-primario');
  assert.equal(summary.entregas[1].source, 'vicerrectoria_financiera_institucional');
});

test('la trazabilidad identifica un fallo de correo sin perder la solicitud', () => {
  const summary = _internals.summarizeStageEmailResult({
    key: 'jefe',
    email: 'jefe@unicesmag.edu.co'
  }, {
    success: false,
    error: 'SMTP temporalmente no disponible'
  });

  assert.equal(summary.success, false);
  assert.equal(summary.entregas[0].recipient, 'jefe@unicesmag.edu.co');
  assert.match(summary.entregas[0].error, /SMTP/);
});
