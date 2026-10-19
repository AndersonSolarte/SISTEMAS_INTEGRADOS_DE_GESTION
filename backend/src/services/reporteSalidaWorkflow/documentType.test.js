const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getReporteSalidaEmailLabel,
  isOficioSolicitud,
  isPendingReporteSalidaApproval
} = require('../../controllers/reporteSalidaController');
const {
  getOficioDuracionInfo,
  isOficioSalida
} = require('../reporteSalidaPdfService');

const docenteSolicitud = (duracionTipo, duracionDias, overrides = {}) => ({
  solicitante_snapshot: {
    cargo: 'Docente Tiempo Completo',
    vicerrectoria: 'Vicerrectoría Académica'
  },
  datos_formulario: {
    laboral: {
      cargo: 'Docente Tiempo Completo',
      vicerrectoria: 'Vicerrectoría Académica'
    },
    salida: {
      fecha: '2026-10-19',
      fechaRegreso: '2026-10-19',
      horaInicio: '08:00',
      horaFin: '18:00',
      duracionTipo,
      duracionDias
    },
    ...overrides
  },
  tiempo_solicitado_minutos: duracionDias * 480
});

test('docente de hasta un dia genera formato y no oficio', () => {
  const solicitud = docenteSolicitud('menos_media_jornada', 1);
  const salida = solicitud.datos_formulario.salida;

  assert.equal(isOficioSolicitud(solicitud), false);
  assert.equal(isOficioSalida(salida, solicitud), false);
  assert.equal(getReporteSalidaEmailLabel(solicitud), 'REPORTE DE SALIDA - HASTA 1 DÍA');
  assert.match(getOficioDuracionInfo(salida, solicitud).tipoDocumento, /^Formato de Reporte de Salida/);
});

test('docente de dos dias genera oficio', () => {
  const solicitud = docenteSolicitud('1_2_dias', 2);
  const salida = solicitud.datos_formulario.salida;

  assert.equal(isOficioSolicitud(solicitud), true);
  assert.equal(isOficioSalida(salida, solicitud), true);
  assert.equal(getReporteSalidaEmailLabel(solicitud), 'OFICIO DE SOLICITUD DE SALIDA - 2 DÍAS');
  assert.equal(getOficioDuracionInfo(salida, solicitud).tipoDocumento, 'Oficio de Solicitud (Hasta 2 días)');
});

test('docente de tres dias o mas genera oficio', () => {
  const solicitud = docenteSolicitud('3_mas_dias', 4);
  const salida = solicitud.datos_formulario.salida;

  assert.equal(isOficioSolicitud(solicitud), true);
  assert.equal(isOficioSalida(salida, solicitud), true);
});

test('el oficio usa la cantidad digitada y no calcula los dias con las fechas', () => {
  const solicitud = docenteSolicitud('3_mas_dias', 3);
  solicitud.datos_formulario.salida = {
    ...solicitud.datos_formulario.salida,
    cantidadDiasSolicitados: 3,
    fecha: '2026-10-20',
    fechaRegreso: '2026-10-23',
    horaInicio: '07:00',
    horaFin: '18:00'
  };

  const info = getOficioDuracionInfo(solicitud.datos_formulario.salida, solicitud);
  assert.equal(info.label, '3 d\u00edas');
  assert.equal(info.tipoDocumento, 'Oficio de Solicitud (3 d\u00edas en adelante)');
});

test('un dia para personal no docente conserva el oficio del flujo general', () => {
  const solicitud = {
    solicitante_snapshot: { cargo: 'Auxiliar administrativo' },
    datos_formulario: {
      laboral: {
        cargo: 'Auxiliar administrativo',
        vicerrectoria: 'Vicerrectoría Financiera y de Desarrollo Institucional'
      },
      salida: {
        fecha: '2026-10-19',
        fechaRegreso: '2026-10-19',
        horaInicio: '08:00',
        horaFin: '18:00',
        duracionTipo: '1_2_dias',
        duracionDias: 1
      }
    },
    tiempo_solicitado_minutos: 480
  };
  const salida = solicitud.datos_formulario.salida;

  assert.equal(isOficioSolicitud(solicitud), true);
  assert.equal(isOficioSalida(salida, solicitud), true);
  assert.equal(getOficioDuracionInfo(salida, solicitud).tipoDocumento, 'Oficio de Solicitud (1 o 2 días)');
});

test('los documentos temporales solo se habilitan durante la aprobacion del reporte', () => {
  assert.equal(isPendingReporteSalidaApproval('pendiente_aprobacion_jefe'), true);
  assert.equal(isPendingReporteSalidaApproval('pendiente_aprobacion_rectoria'), true);
  assert.equal(isPendingReporteSalidaApproval('pendiente_tecnico_contable'), false);
  assert.equal(isPendingReporteSalidaApproval('finalizada'), false);
  assert.equal(isPendingReporteSalidaApproval('no_aprobada'), false);
});
