const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const {
  bossScopeWhere,
  isAssignedBoss,
  isAcademicAuthorityAssignment,
  isReposicionEligibleSalida,
  resolveHoraCatedraDuration,
  resolveReposicionLaboralProfile,
  resolveReposicionValues,
  resolveReposicionAbono
} = require('../../controllers/reporteSalidaController');
const {
  getReposicionPdfInfo,
  buildReposicionPdfSection
} = require('../reporteSalidaPdfService');

test('la reposicion aplica exclusivamente a diligencia personal', () => {
  const duraciones = ['menos_media_jornada', '1_2_dias', '3_mas_dias'];
  for (const duracionTipo of duraciones) {
    assert.equal(isReposicionEligibleSalida({
      categoria: 'personales',
      tipo: 'diligencia_personal',
      duracionTipo
    }), true);
    assert.equal(isReposicionEligibleSalida({
      categoria: 'salud',
      tipo: 'cita_eps',
      duracionTipo
    }), false);
    assert.equal(isReposicionEligibleSalida({
      categoria: 'propias_cargo',
      tipo: 'ponencia',
      duracionTipo
    }), false);
  }
});

test('hora catedra clasifica la duración usando jornada y horas solicitadas', () => {
  assert.deepEqual(resolveHoraCatedraDuration({ dailyMinutes: 240, requestedMinutes: 150 }), {
    valid: true, durationType: 'menos_media_jornada', durationDays: 0
  });
  assert.deepEqual(resolveHoraCatedraDuration({ dailyMinutes: 240, requestedMinutes: 360 }), {
    valid: true, durationType: '1_2_dias', durationDays: 2
  });
  assert.deepEqual(resolveHoraCatedraDuration({ dailyMinutes: 240, requestedMinutes: 720 }), {
    valid: true, durationType: '3_mas_dias', durationDays: 3
  });
});

const solicitudAcademica = {
  jefe_inmediato_user_id: 44,
  jefe_snapshot: {
    nombre: 'SANDRA LUCIA BOLAÑOS DELGADO',
    email: 'sbolanos@unicesmag.edu.co'
  }
};

test('la cuenta institucional de Académica administra la reposición asignada a la Vicerrectora', () => {
  assert.equal(isAcademicAuthorityAssignment(solicitudAcademica), true);
  assert.equal(isAssignedBoss(solicitudAcademica, { id: 99, email: 'viceacad@unicesmag.edu.co' }), true);
});

test('la cuenta personal de Sandra no administra la bandeja institucional de reposiciones', () => {
  assert.equal(isAssignedBoss(solicitudAcademica, { id: 44, email: 'sbolanos@unicesmag.edu.co' }), false);
  assert.deepEqual(bossScopeWhere({ id: 44, email: 'sbolanos@unicesmag.edu.co' }), { id: -1 });
});

test('la consulta institucional contempla solicitudes históricas enviadas a ambos correos', () => {
  const scope = bossScopeWhere({ id: 99, email: 'viceacad@unicesmag.edu.co' }, [44]);
  const alternatives = scope[Op.or];
  assert.equal(alternatives.length, 3);
  assert.equal(alternatives[0].jefe_snapshot[Op.contains].email, 'viceacad@unicesmag.edu.co');
  assert.equal(alternatives[1].jefe_snapshot[Op.contains].email, 'sbolanos@unicesmag.edu.co');
  assert.deepEqual(alternatives[2].jefe_inmediato_user_id[Op.in], [44]);
});

test('una solicitud histórica sin correo se reconoce por el id de la jefa inmediata', () => {
  const historical = { jefe_inmediato_user_id: 44, jefe_snapshot: {} };
  assert.equal(isAssignedBoss(historical, { id: 99, email: 'viceacad@unicesmag.edu.co' }, [44]), true);
  assert.equal(isAssignedBoss(historical, { id: 100, email: 'otro@unicesmag.edu.co' }, [44]), false);
});

test('Diseño Gráfico gestiona las reposiciones exclusivamente desde el correo del programa', () => {
  const solicitud = {
    jefe_inmediato_user_id: 71,
    jefe_snapshot: {
      nombre: 'KAREN EUGENIA OCAÑA FIGUEROA',
      email: 'keocana@unicesmag.edu.co'
    }
  };
  assert.equal(isAssignedBoss(solicitud, { id: 501, email: 'disenografico@unicesmag.edu.co' }, [71]), true);
  assert.equal(isAssignedBoss(solicitud, { id: 71, email: 'keocana@unicesmag.edu.co' }, [71]), false);
  const alternatives = bossScopeWhere({ id: 501, email: 'disenografico@unicesmag.edu.co' }, [71])[Op.or];
  assert.equal(alternatives[0].jefe_snapshot[Op.contains].email, 'disenografico@unicesmag.edu.co');
  assert.equal(alternatives[1].jefe_snapshot[Op.contains].email, 'keocana@unicesmag.edu.co');
  assert.deepEqual(alternatives[2].jefe_inmediato_user_id[Op.in], [71]);
});

test('Arquitectura gestiona las reposiciones exclusivamente desde el correo del programa', () => {
  const solicitud = {
    jefe_inmediato_user_id: 72,
    jefe_snapshot: {
      nombre: 'LILIAN MAGALI MARTINEZ CRESPO',
      email: 'lmmartinez@unicesmag.edu.co'
    }
  };
  assert.equal(isAssignedBoss(solicitud, { id: 502, email: 'arquitectura@unicesmag.edu.co' }, [72]), true);
  assert.equal(isAssignedBoss(solicitud, { id: 72, email: 'lmmartinez@unicesmag.edu.co' }, [72]), false);
  const alternatives = bossScopeWhere({ id: 502, email: 'arquitectura@unicesmag.edu.co' }, [72])[Op.or];
  assert.equal(alternatives[0].jefe_snapshot[Op.contains].email, 'arquitectura@unicesmag.edu.co');
  assert.equal(alternatives[1].jefe_snapshot[Op.contains].email, 'lmmartinez@unicesmag.edu.co');
  assert.deepEqual(alternatives[2].jefe_inmediato_user_id[Op.in], [72]);
});

test('Juan Carlos Nandar y el correo de Vicerrectoría Financiera comparten la gestión de reposiciones', () => {
  const solicitud = {
    jefe_inmediato_user_id: 81,
    jefe_snapshot: {
      nombre: 'JUAN CARLOS NANDAR LÓPEZ',
      email: 'jcnandar@unicesmag.edu.co'
    }
  };
  assert.equal(isAssignedBoss(solicitud, { id: 81, email: 'jcnandar@unicesmag.edu.co' }, [81, 82]), true);
  assert.equal(isAssignedBoss(solicitud, { id: 82, email: 'viceadfin@unicesmag.edu.co' }, [81, 82]), true);
  const alternatives = bossScopeWhere({ id: 82, email: 'viceadfin@unicesmag.edu.co' }, [81, 82])[Op.or];
  assert.equal(alternatives[0].jefe_snapshot[Op.contains].email, 'jcnandar@unicesmag.edu.co');
  assert.equal(alternatives[1].jefe_snapshot[Op.contains].email, 'viceadfin@unicesmag.edu.co');
  assert.deepEqual(alternatives[2].jefe_inmediato_user_id[Op.in], [81, 82]);
});

test('Javier Jiménez y el correo de Vicerrectoría de Investigación gestionan únicamente su equipo', () => {
  const solicitudInvestigacion = {
    jefe_inmediato_user_id: 91,
    jefe_snapshot: {
      nombre: 'JAVIER ALEJANDRO JIMENEZ TOLEDO',
      email: 'jajimenez@unicesmag.edu.co'
    }
  };
  const solicitudAjena = {
    jefe_inmediato_user_id: 99,
    jefe_snapshot: {
      nombre: 'OTRO JEFE',
      email: 'otro.jefe@unicesmag.edu.co'
    }
  };
  assert.equal(isAssignedBoss(solicitudInvestigacion, { id: 91, email: 'jajimenez@unicesmag.edu.co' }, [91, 92]), true);
  assert.equal(isAssignedBoss(solicitudInvestigacion, { id: 92, email: 'viceinvestiga@unicesmag.edu.co' }, [91, 92]), true);
  assert.equal(isAssignedBoss(solicitudAjena, { id: 92, email: 'viceinvestiga@unicesmag.edu.co' }, [91, 92]), false);
  const alternatives = bossScopeWhere({ id: 92, email: 'viceinvestiga@unicesmag.edu.co' }, [91, 92])[Op.or];
  assert.equal(alternatives[0].jefe_snapshot[Op.contains].email, 'jajimenez@unicesmag.edu.co');
  assert.equal(alternatives[1].jefe_snapshot[Op.contains].email, 'viceinvestiga@unicesmag.edu.co');
  assert.deepEqual(alternatives[2].jefe_inmediato_user_id[Op.in], [91, 92]);
});

test('Rectoría gestiona exclusivamente la reposición del personal adscrito al Rector', () => {
  const solicitudRectoria = {
    jefe_inmediato_user_id: 216,
    jefe_snapshot: {
      nombre: 'LUIS EDUARDO RUBIANO GUAQUETA',
      email: 'rectoria@unicesmag.edu.co'
    }
  };
  const solicitudAjena = {
    jefe_inmediato_user_id: 300,
    jefe_snapshot: {
      nombre: 'OTRO JEFE',
      email: 'otro.jefe@unicesmag.edu.co'
    }
  };
  const rectoria = { id: 216, email: 'rectoria@unicesmag.edu.co' };
  assert.equal(isAssignedBoss(solicitudRectoria, rectoria, [216]), true);
  assert.equal(isAssignedBoss(solicitudAjena, rectoria, [216]), false);
  const alternatives = bossScopeWhere(rectoria, [216])[Op.or];
  assert.equal(alternatives[0].jefe_snapshot[Op.contains].email, 'rectoria@unicesmag.edu.co');
  assert.deepEqual(alternatives[1].jefe_inmediato_user_id[Op.in], [216]);
});

test('María del Pilar y el correo de Evangelización gestionan únicamente su personal a cargo', () => {
  const solicitudEvangelizacion = {
    jefe_inmediato_user_id: 111,
    jefe_snapshot: {
      nombre: 'MARIA DEL PILAR AGREDA GUERRERO',
      email: 'mpagreda@unicesmag.edu.co'
    }
  };
  const solicitudOtroJefe = {
    jefe_inmediato_user_id: 120,
    jefe_snapshot: {
      nombre: 'JEFE DE OTRA DEPENDENCIA',
      email: 'otro.jefe@unicesmag.edu.co'
    }
  };
  assert.equal(isAssignedBoss(solicitudEvangelizacion, { id: 111, email: 'mpagreda@unicesmag.edu.co' }, [111, 112]), true);
  assert.equal(isAssignedBoss(solicitudEvangelizacion, { id: 112, email: 'vicebien@unicesmag.edu.co' }, [111, 112]), true);
  assert.equal(isAssignedBoss(solicitudOtroJefe, { id: 112, email: 'vicebien@unicesmag.edu.co' }, [111, 112]), false);
  const alternatives = bossScopeWhere({ id: 112, email: 'vicebien@unicesmag.edu.co' }, [111, 112])[Op.or];
  assert.equal(alternatives[0].jefe_snapshot[Op.contains].email, 'mpagreda@unicesmag.edu.co');
  assert.equal(alternatives[1].jefe_snapshot[Op.contains].email, 'vicebien@unicesmag.edu.co');
  assert.deepEqual(alternatives[2].jefe_inmediato_user_id[Op.in], [111, 112]);
});

test('un jefe inmediato común solo consulta y gestiona las reposiciones de su propio equipo', () => {
  const jefe = { id: 701, email: 'jefe.programa@unicesmag.edu.co' };
  const solicitudPropia = {
    jefe_inmediato_user_id: 701,
    jefe_snapshot: { nombre: 'JEFE DEL PROGRAMA', email: 'jefe.programa@unicesmag.edu.co' }
  };
  const solicitudOtraDependencia = {
    jefe_inmediato_user_id: 702,
    jefe_snapshot: { nombre: 'JEFE DE OTRA DEPENDENCIA', email: 'otro.jefe@unicesmag.edu.co' }
  };
  assert.equal(isAssignedBoss(solicitudPropia, jefe), true);
  assert.equal(isAssignedBoss(solicitudOtraDependencia, jefe), false);
  const alternatives = bossScopeWhere(jefe)[Op.or];
  assert.deepEqual(alternatives[0], { jefe_inmediato_user_id: 701 });
  assert.equal(alternatives[1].jefe_snapshot[Op.contains].email, 'jefe.programa@unicesmag.edu.co');
});

test('las salidas entre uno y dos dias generan reposicion con el tiempo calculado', () => {
  assert.deepEqual(resolveReposicionValues({
    isOficio: true,
    requestedMinutes: 960,
    bodyMinutes: 0,
    durationDays: 2
  }), { minutes: 1040, applies: true });
});

test('las salidas de tres o mas dias generan reposicion con el tiempo calculado', () => {
  assert.deepEqual(resolveReposicionValues({
    isOficio: true,
    requestedMinutes: 1440,
    bodyMinutes: 0,
    durationDays: 3
  }), { minutes: 1560, applies: true });
});

test('docente tiempo completo conserva las horas realmente solicitadas', () => {
  const profile = resolveReposicionLaboralProfile({
    teacherRow: { tipo_vinculacion: 'Tiempo Completo', total_horas: 40 },
    cargo: 'Docente'
  });
  assert.equal(profile.key, 'docente_tiempo_completo');
  assert.deepEqual(resolveReposicionValues({
    isOficio: true,
    durationDays: 2,
    bodyMinutes: 600,
    laboralProfile: profile
  }), { minutes: 600, applies: true });
});

test('docente medio tiempo conserva las horas realmente solicitadas', () => {
  const profile = resolveReposicionLaboralProfile({
    teacherRow: { tipo_vinculacion: 'Medio Tiempo', total_horas: 20 },
    cargo: 'Docente'
  });
  assert.equal(profile.key, 'docente_medio_tiempo');
  assert.deepEqual(resolveReposicionValues({
    isOficio: true,
    durationDays: 3,
    bodyMinutes: 650,
    laboralProfile: profile
  }), { minutes: 650, applies: true });
});

test('docente hora catedra conserva el total de horas solicitado', () => {
  const profile = resolveReposicionLaboralProfile({
    teacherRow: { tipo_vinculacion: 'Hora Catedra', total_horas: 12 },
    cargo: 'Docente'
  });
  assert.equal(profile.key, 'docente_hora_catedra');
  assert.equal(profile.manualTime, true);
  assert.deepEqual(resolveReposicionValues({
    isOficio: true,
    durationDays: 3,
    bodyMinutes: 645,
    laboralProfile: profile
  }), { minutes: 645, applies: true });
});

test('administrativo conserva el total de horas realmente solicitado', () => {
  const profile = resolveReposicionLaboralProfile({ cargo: 'Profesional universitario' });
  assert.equal(profile.key, 'administrativo');
  assert.deepEqual(resolveReposicionValues({
    isOficio: true,
    durationDays: 2,
    bodyMinutes: 600,
    laboralProfile: profile
  }), { minutes: 600, applies: true });
});

test('todo cargo de Decano o Decana se clasifica como administrativo', () => {
  const teacherRow = {
    tipo_vinculacion: 'HORA CATEDRA',
    cargo: 'ADMINISTRATIVO',
    total_horas: 44
  };
  for (const cargo of ['Decano (a) Facultad de Ingenieria', 'Decana Facultad de Educación']) {
    const profile = resolveReposicionLaboralProfile({ teacherRow, cargo });
    assert.equal(profile.key, 'administrativo');
    assert.equal(profile.minutesPerDay, 520);
    assert.equal(profile.totalContractHours, 40);
    assert.equal(profile.administrativeOverride, 'decanatura');
  }
});

test('un dia de reposicion equivale a ocho horas y cuarenta minutos', () => {
  assert.equal(resolveReposicionAbono({ unidadReposicion: 'dias', diasAbonados: 1 }).minutes, 520);
});

test('el abono diario respeta la jornada del docente de tiempo completo', () => {
  assert.equal(resolveReposicionAbono(
    { unidadReposicion: 'dias', diasAbonados: 1 },
    resolveReposicionLaboralProfile({ cargo: 'Docente tiempo completo' })
  ).minutes, 480);
});

test('el abono diario respeta la jornada del docente de medio tiempo', () => {
  assert.equal(resolveReposicionAbono(
    { unidadReposicion: 'dias', diasAbonados: 1 },
    resolveReposicionLaboralProfile({ cargo: 'Docente medio tiempo' })
  ).minutes, 240);
});

test('hora catedra no permite registrar reposicion por dias', () => {
  const result = resolveReposicionAbono(
    { unidadReposicion: 'dias', diasAbonados: 1 },
    resolveReposicionLaboralProfile({ cargo: 'Docente hora catedra' })
  );
  assert.equal(result.valid, false);
  assert.match(result.message, /horas y minutos/i);
});

test('el abono por tiempo combina horas y minutos', () => {
  assert.equal(resolveReposicionAbono({
    unidadReposicion: 'tiempo',
    horasAbonadas: 2,
    minutosAbonados: 35
  }).minutes, 155);
});

test('rechaza minutos adicionales mayores que cincuenta y nueve', () => {
  assert.equal(resolveReposicionAbono({
    unidadReposicion: 'tiempo',
    horasAbonadas: 1,
    minutosAbonados: 60
  }).valid, false);
});

test('el PDF conserva la parametrizacion completa de una salida con reposicion', () => {
  const solicitud = {
    tiempo_solicitado_minutos: 500,
    reposicion_aplica: true,
    reposicion_minutos: 500,
    reposicion_minutos_pagados: 150,
    reposicion_minutos_por_dia: 480,
    reposicion_tipo_vinculacion: 'DOCENTE',
    reposicion_nivel_contratacion: 'TIEMPO COMPLETO',
    reposicion_perfil_laboral: { key: 'DOCENTE_TIEMPO_COMPLETO', label: 'Docente tiempo completo' },
    reposicion_estado: 'pendiente',
    observacion_gestion_humana: 'Abono validado por Gestion Humana.',
    datos_formulario: {
      adjunto_path: 'soporte-permiso.pdf',
      salida: { duracionTipo: '1_2_dias' },
      reposicion: { observacion: 'Reposicion acordada con el jefe inmediato.' }
    }
  };
  const info = getReposicionPdfInfo(solicitud);
  assert.equal(info.total, 500);
  assert.equal(info.paid, 150);
  assert.equal(info.pending, 350);
  assert.equal(info.daily, 480);
  assert.equal(info.attachmentName, 'soporte-permiso.pdf');
  assert.equal(info.durationLabel, 'Entre 1 y 2 dias');
  const section = buildReposicionPdfSection(solicitud);
  assert.equal(section.length, 2);
  assert.match(JSON.stringify(section), /Seguimiento de reposicion/);
  assert.match(JSON.stringify(section), /soporte-permiso\.pdf/);
});

test('el PDF no agrega el bloque de reposicion a otros tipos de salida', () => {
  assert.deepEqual(buildReposicionPdfSection({ reposicion_aplica: false }), []);
});

test('Vicerrectoría Financiera envía la aprobación de autoridad a viceadfin@unicesmag.edu.co y no a viceacadémica', () => {
  const workflowEngine = require('./index');
  const helpers = {
    getSolicitudLaboral: (s) => s.datos_formulario?.laboral || {},
    getSolicitudSalida: (s) => s.datos_formulario?.salida || {},
    getSolicitudVicerrectoria: (s) => s.datos_formulario?.laboral?.vicerrectoria || '',
    isOficioSolicitud: () => true,
    isPermisoElectoralSinVicerrectoria: () => false,
    isVicerrectoriaAcademica: (v) => String(v || '').toLowerCase().includes('academica'),
    isFinancieraVicerrectoria: (v) => String(v || '').toLowerCase().includes('financiera'),
    isEvangelizacionVicerrectoria: (v) => String(v || '').toLowerCase().includes('evangelizacion'),
    isInvestigacionVicerrectoria: (v) => String(v || '').toLowerCase().includes('investigacion'),
    isRectoriaAuthority: (v) => String(v || '').toLowerCase().includes('rectoria')
  };

  const solicitud = {
    datos_formulario: {
      laboral: {
        dependencia: 'Oficina de Medios Educativos',
        vicerrectoria: 'Vicerrectoria Financiera y de Desarrollo Institucional',
        cargo: 'Auxiliar de Medios Educativos'
      },
      salida: {
        categoria: 'propias_cargo',
        duracionTipo: 'jornada_completa'
      }
    }
  };

  const authority = workflowEngine.getAuthorityAfterBoss(solicitud, helpers);
  assert.ok(authority);
  assert.equal(authority.email, 'viceadfin@unicesmag.edu.co');
  assert.notEqual(authority.email, 'viceacad@unicesmag.edu.co');
  assert.equal(authority.name, 'Vicerrectoria Financiera y de Desarrollo Institucional');
});

test('salida grupal de Arquitectura envía aprobación exclusivamente al correo del programa arquitectura@unicesmag.edu.co', () => {
  const { getGroupInitialApprovalRecipients } = require('../../controllers/reporteSalidaController');
  const groupSolicitudes = [
    {
      datos_formulario: {
        is_leader: true,
        personal: { nombre: 'JUAN CARLOS MARQUEZ CORDOBA' },
        laboral: { dependencia: 'Programa Academico - Arquitectura', cargo: 'Docente Medio Tiempo' }
      },
      jefe_snapshot: { nombre: 'LILIAN MAGALI MARTINEZ CRESPO', email: 'lmmartinez@unicesmag.edu.co' }
    },
    {
      datos_formulario: {
        personal: { nombre: 'ANGELA JANNETH HIDALGO MELO' },
        laboral: { dependencia: 'Programa Academico - Arquitectura', cargo: 'Docente Tiempo Completo' }
      },
      jefe_snapshot: { nombre: 'LILIAN MAGALI MARTINEZ CRESPO', email: 'lmmartinez@unicesmag.edu.co' }
    }
  ];

  const recipients = getGroupInitialApprovalRecipients(groupSolicitudes);
  assert.deepEqual(recipients, ['arquitectura@unicesmag.edu.co']);
  assert.equal(recipients.includes('lmmartinez@unicesmag.edu.co'), false);
});

test('salida grupal de Diseño Gráfico envía aprobación exclusivamente a disenografico@unicesmag.edu.co', () => {
  const { getGroupInitialApprovalRecipients } = require('../../controllers/reporteSalidaController');
  const groupSolicitudes = [
    {
      datos_formulario: {
        is_leader: true,
        personal: { nombre: 'DOCENTE DISENO' },
        laboral: { dependencia: 'Programa Academico - Diseño Grafico', cargo: 'Docente' }
      },
      jefe_snapshot: { nombre: 'KAREN EUGENIA OCANA FIGUEROA', email: 'kocana@unicesmag.edu.co' }
    }
  ];

  const recipients = getGroupInitialApprovalRecipients(groupSolicitudes);
  assert.deepEqual(recipients, ['disenografico@unicesmag.edu.co']);
  assert.equal(recipients.includes('kocana@unicesmag.edu.co'), false);
});

test('salida grupal de otros programas académicos envía a ambos: correo del programa y correo del director/jefe', () => {
  const { getGroupInitialApprovalRecipients } = require('../../controllers/reporteSalidaController');
  const groupSolicitudes = [
    {
      datos_formulario: {
        is_leader: true,
        personal: { nombre: 'DOCENTE DERECHO' },
        laboral: { dependencia: 'Programa Academico - Derecho', cargo: 'Docente' }
      },
      jefe_snapshot: { nombre: 'DIRECTOR DERECHO', email: 'director.derecho@unicesmag.edu.co' }
    }
  ];

  const recipients = getGroupInitialApprovalRecipients(groupSolicitudes);
  assert.ok(recipients.includes('dir.derecho@unicesmag.edu.co'));
  assert.ok(recipients.includes('director.derecho@unicesmag.edu.co'));
});

test('isSingleHomogeneousGroup reconoce grupos de un solo programa o jefe vs grupos heterogéneos', () => {
  const { isSingleHomogeneousGroup } = require('../../controllers/reporteSalidaController');

  // Grupo 1: Mismo programa (Arquitectura)
  const groupMismoPrograma = [
    { datos_formulario: { laboral: { dependencia: 'Programa Academico - Arquitectura' } }, jefe_snapshot: { nombre: 'LILIAN MARTINEZ' } },
    { datos_formulario: { laboral: { dependencia: 'Programa Academico - Arquitectura' } }, jefe_snapshot: { nombre: 'LILIAN MARTINEZ' } }
  ];
  assert.equal(isSingleHomogeneousGroup(groupMismoPrograma), true);

  // Grupo 2: Misma jefatura aunque cargos diferentes
  const groupMismoJefe = [
    { datos_formulario: { laboral: { dependencia: 'Oficina A' } }, jefe_snapshot: { nombre: 'JEFE CENTRAL', email: 'jefe@unicesmag.edu.co' } },
    { datos_formulario: { laboral: { dependencia: 'Oficina B' } }, jefe_snapshot: { nombre: 'JEFE CENTRAL', email: 'jefe@unicesmag.edu.co' } }
  ];
  assert.equal(isSingleHomogeneousGroup(groupMismoJefe), true);

  // Grupo 3: Diversos programas con diferentes jefaturas (Heterogéneo -> directo a Gestión Humana)
  const groupHeterogeneo = [
    { datos_formulario: { laboral: { dependencia: 'Programa Academico - Arquitectura' } }, jefe_snapshot: { nombre: 'LILIAN MARTINEZ', email: 'lmmartinez@unicesmag.edu.co' } },
    { datos_formulario: { laboral: { dependencia: 'Programa Academico - Derecho' } }, jefe_snapshot: { nombre: 'DIRECTOR DERECHO', email: 'dir.derecho@unicesmag.edu.co' } },
    { datos_formulario: { laboral: { dependencia: 'Oficina de Infraestructura' } }, jefe_snapshot: { nombre: 'JEFE INFRA', email: 'infra@unicesmag.edu.co' } }
  ];
  assert.equal(isSingleHomogeneousGroup(groupHeterogeneo), false);
});


