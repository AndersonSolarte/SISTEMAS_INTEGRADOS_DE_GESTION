const test = require('node:test');
const assert = require('node:assert/strict');
const controller = require('../../controllers/reporteSalidaController');
const routes = require('../../routes/reporteSalidaRoutes');
const models = require('../../models');

const createMockRes = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    this.payload = data;
    return this;
  }
});

test('serializeSolicitudForFormatStats conserva solo agregados generales y omite datos personales y sensibles', () => {
  const serialized = controller.serializeSolicitudForFormatStats({
    id: 42,
    consecutivo: 'THM-2026-0042',
    user_id: 99,
    estado: 'finalizada',
    created_at: null,
    tiempo_solicitado_minutos: 180,
    reposicion_aplica: true,
    reposicion_minutos: 180,
    reposicion_minutos_pagados: 180,
    reposicion_estado: 'cumplida',
    aprobacion_jefe_token_hash: 'secreto-hash',
    observacion_gestion_humana: 'Nota interna confidencial',
    jefe_snapshot: {
      nombre: 'Jefe Inmediato',
      email: 'jefe@unicesmag.edu.co'
    },
    solicitante_snapshot: {
      userId: 99,
      nombre: 'Laura Perez',
      email: 'laura@unicesmag.edu.co',
      username: '1085000111'
    },
    trazabilidad: [
      { event: 'radicacion', at: '2026-04-15T14:30:00.000Z', actor: 'Laura Perez' }
    ],
    datos_formulario: {
      tipo: 'diligencia_personal',
      personal: {
        documento: '1085000111',
        celular: '3001112233'
      },
      laboral: {
        dependencia: 'Planeacion',
        cargo: 'Profesional'
      },
      viaticos: {
        requiereViaticos: 'si',
        valorAnticipo: 500000
      },
      salida: {
        categoria: 'personales',
        tipo: 'diligencia_personal',
        fecha: '2026-04-16',
        horaInicio: '08:00',
        horaFin: '11:00',
        motivo: 'Diligencia bancaria',
        alcance: 'Local',
        municipio: 'Pasto',
        entidadDestino: 'Banco',
        especialidadMedica: '',
        campusSalida: 'Principal',
        campusDestino: 'Centro',
        adjunto_path: 'privado.pdf'
      }
    }
  });

  assert.equal(serialized.id, 42);
  assert.equal(serialized.estado, 'finalizada');
  assert.equal(serialized.created_at, '2026-04-15T14:30:00.000Z');
  assert.equal(serialized.reposicion_aplica, true);
  assert.equal(serialized.reposicion_minutos, 180);
  assert.equal(serialized.reposicion_minutos_pagados, 180);
  assert.equal(serialized.reposicion_estado, 'cumplida');
  assert.deepEqual(serialized.datos_formulario.salida, {
    categoria: 'personales',
    tipo: 'diligencia_personal',
    fecha: '2026-04-16'
  });

  assert.equal('solicitante' in serialized, false);
  assert.equal('consecutivo' in serialized, false);
  assert.equal('aprobacion_jefe_token_hash' in serialized, false);
  assert.equal('jefe_snapshot' in serialized, false);
  assert.equal('observacion_gestion_humana' in serialized, false);
  assert.equal('trazabilidad' in serialized, false);
  assert.equal('personal' in serialized.datos_formulario, false);
  assert.equal('laboral' in serialized.datos_formulario, false);
  assert.equal('viaticos' in serialized.datos_formulario, false);
  assert.equal('motivo' in serialized.datos_formulario.salida, false);
  assert.equal('municipio' in serialized.datos_formulario.salida, false);
  assert.equal('adjunto_path' in serialized.datos_formulario.salida, false);
});

test('getEstadisticasFormatos devuelve modo solo consulta sin exportacion y filtra por ano', async (t) => {
  const sampleRows = [
    {
      id: 1,
      estado: 'pendiente_aprobacion_jefe',
      created_at: '2026-02-10T15:00:00.000Z',
      tiempo_solicitado_minutos: 120,
      reposicion_aplica: false,
      reposicion_minutos: 0,
      reposicion_minutos_pagados: 0,
      reposicion_estado: 'no_aplica',
      datos_formulario: { salida: { tipo: 'cita_eps', categoria: 'salud', fecha: '2026-02-11' } },
      trazabilidad: []
    },
    {
      id: 2,
      estado: 'finalizada',
      created_at: '2025-11-20T16:00:00.000Z',
      tiempo_solicitado_minutos: 240,
      reposicion_aplica: true,
      reposicion_minutos: 240,
      reposicion_minutos_pagados: 240,
      reposicion_estado: 'cumplida',
      datos_formulario: { salida: { tipo: 'diligencia_personal', categoria: 'personales', fecha: '2025-11-21' } },
      trazabilidad: []
    }
  ];

  t.mock.method(models.ReporteSalidaSolicitud, 'findAll', async () => sampleRows);

  const resAll = createMockRes();
  await controller.getEstadisticasFormatos({ query: {}, user: { id: 1, role: 'administrador' } }, resAll);

  assert.equal(resAll.statusCode, 200);
  assert.equal(resAll.payload.success, true);
  assert.equal(resAll.payload.data.format_code, 'THM-DP-FR-002');
  assert.equal(resAll.payload.data.read_only, true);
  assert.equal(resAll.payload.data.allow_export, false);
  assert.deepEqual(resAll.payload.data.available_years, [2026, 2025]);
  assert.equal(resAll.payload.data.selected_year, null);
  assert.equal(resAll.payload.data.solicitudes.length, 2);

  const res2025 = createMockRes();
  await controller.getEstadisticasFormatos({ query: { year: '2025' }, user: { id: 1, role: 'gestion_por_procesos' } }, res2025);

  assert.equal(res2025.statusCode, 200);
  assert.deepEqual(res2025.payload.data.available_years, [2026, 2025]);
  assert.equal(res2025.payload.data.selected_year, 2025);
  assert.equal(res2025.payload.data.solicitudes.length, 1);
  assert.equal(res2025.payload.data.solicitudes[0].id, 2);
});

test('reporteSalidaRoutes registra GET /estadisticas-formatos', () => {
  const layer = routes.stack.find((item) => item.route?.path === '/estadisticas-formatos' && item.route?.methods?.get);
  assert.ok(layer, 'Debe registrar la ruta GET /estadisticas-formatos');
});
