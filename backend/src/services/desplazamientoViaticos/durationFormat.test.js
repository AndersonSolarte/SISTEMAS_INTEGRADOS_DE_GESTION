const test = require('node:test');
const assert = require('node:assert/strict');

const { _internals } = require('../../controllers/desplazamientoViaticosController');
const {
  getOficioDuracionInfo,
  getViaticosDurationDays,
  isOficioSalida
} = require('../reporteSalidaPdfService');

const longTrip = {
  fecha: '2026-11-22',
  horaInicio: '09:00',
  fechaRegreso: '2026-11-29',
  horaFin: '17:00',
  duracionTipo: 'menos_media_jornada',
  duracionDias: 0
};

test('la duracion usa el numero de dias solicitado en el FR-004 y no recalcula por fechas', () => {
  const normalized = _internals.normalizeViaticosSalidaDuration(longTrip, {
    requiereViaticos: true,
    numeroDiasSolicitados: 10
  });

  assert.equal(normalized.duracionTipo, '3_mas_dias');
  assert.equal(normalized.duracionDias, 10);
});

test('dos dias de viaticos se clasifican como oficio de uno o dos dias', () => {
  const normalized = _internals.normalizeViaticosSalidaDuration({
    fecha: '2026-11-22',
    horaInicio: '08:00',
    fechaRegreso: '2026-11-23',
    horaFin: '17:00'
  }, { numeroDiasSolicitados: 2 });

  assert.equal(normalized.duracionTipo, '1_2_dias');
  assert.equal(normalized.duracionDias, 2);
});

test('los registros historicos de viaticos mal marcados se muestran y generan como oficio', () => {
  const solicitud = {
    datos_formulario: {
      viaticos: { requiereViaticos: true, numeroDiasSolicitados: 8 }
    },
    solicitante_snapshot: { cargo: 'Administrativo' }
  };

  assert.equal(getViaticosDurationDays(longTrip, solicitud), 8);
  assert.equal(isOficioSalida(longTrip, solicitud), true);
  const info = getOficioDuracionInfo(longTrip, solicitud);
  assert.equal(info.codigo, '3_mas_dias');
  assert.match(info.label, /8/);
});

test('las fechas solo se usan como respaldo si el registro no tiene numero de dias solicitado', () => {
  const solicitud = {
    datos_formulario: { viaticos: { requiereViaticos: true } },
    solicitante_snapshot: { cargo: 'Administrativo' }
  };

  assert.equal(getViaticosDurationDays(longTrip, solicitud), 8);
  assert.equal(isOficioSalida(longTrip, solicitud), true);
});
