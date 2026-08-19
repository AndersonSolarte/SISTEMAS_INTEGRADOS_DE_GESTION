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
  });

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
