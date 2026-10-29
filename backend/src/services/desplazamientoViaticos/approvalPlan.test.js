const test = require('node:test');
const assert = require('node:assert/strict');
const { _internals } = require('../../controllers/desplazamientoViaticosController');

const evangelizationLabor = {
  dependencia: 'Area de Deporte y Cultura',
  vicerrectoria: 'Vicerrectoría para la Evangelizacion de las Culturas',
  cargo: 'Instructora de Danzas'
};

test('Las distintas adscripciones usan las seis etapas y mantienen al Rector como jefe cuando corresponde', () => {
  for (const vicerrectoria of ['Rectoría', 'Vicerrectoría Académica', 'Vicerrectoría Financiera y de Desarrollo Institucional', 'Vicerrectoría de Investigación y Extensión']) {
    const { steps } = _internals.buildApprovalPlan({
      personal: { nombre: 'COLABORADOR DE PRUEBA', email: 'prueba@unicesmag.edu.co' },
      laboral: { dependencia: 'Dependencia de prueba', vicerrectoria, cargo: 'Profesional' },
      jefe: { nombre: 'Rector', email: 'rectoria@unicesmag.edu.co', cargo: 'Rector' }
    });
    assert.deepEqual(steps.map(step => step.key), ['jefe', 'financiera_previa', 'sst', 'gestion_humana', 'tecnico_contable', 'tesoreria']);
    assert.equal(steps[0].email, 'rectoria@unicesmag.edu.co');
  }
});

test('La validación del oficio de adscripción a Rectoría solo pide la firma del Rector', () => {
  const issues = _internals.validatePayload({ laboral: { dependencia: 'Planeación', vicerrectoria: 'Rectoría', cargo: 'Profesional' } });
  assert.ok(issues.includes('Debe adjuntar el oficio de autorización firmado por el Rector.'));
  assert.equal(issues.some(issue => issue.includes('firmado por el Rector y la Vicerrectoría')), false);
});

test('El oficio reemplaza las etapas adicionales de Vicerrectoría y Rectoría', () => {
  const { steps } = _internals.buildApprovalPlan({
    personal: { nombre: 'ANITA MAGALY ENRIQUEZ JURADO' },
    laboral: evangelizationLabor,
    jefe: {
      nombre: 'GERMAN ESTEBAN ENRIQUEZ RODRIGUEZ',
      email: 'geenriquez@unicesmag.edu.co',
      cargo: 'Docente Tiempo Completo'
    }
  });

  assert.deepEqual(steps.map((step) => step.key), [
    'jefe',
    'financiera_previa',
    'sst',
    'gestion_humana',
    'tecnico_contable',
    'tesoreria'
  ]);
  assert.equal(steps.some((step) => ['rectoria', 'vicerrectoria_dependencia'].includes(step.key)), false);
});

test('Evangelización no duplica la aprobación cuando la Vicerrectora es jefe inmediato', () => {
  const { steps } = _internals.buildApprovalPlan({
    personal: { nombre: 'COLABORADOR DE PRUEBA' },
    laboral: evangelizationLabor,
    jefe: {
      nombre: 'MARIA DEL PILAR AGREDA GUERRERO',
      email: 'vicebien@unicesmag.edu.co',
      cargo: 'Vicerrector para la Evangelización de las Culturas'
    }
  });

  assert.equal(steps.filter((step) => step.key === 'vicerrectoria_dependencia').length, 0);
});

test('Juan Carlos Nandar no puede revisar financieramente su propia solicitud', () => {
  const { steps } = _internals.buildApprovalPlan({
    personal: {
      nombre: 'JUAN CARLOS NANDAR LOPEZ',
      email: 'jcnandar@unicesmag.edu.co'
    },
    laboral: {
      dependencia: 'Vicerrectoria Financiera y de Desarrollo Institucional',
      vicerrectoria: 'Rectoria',
      cargo: 'Vicerrector Financiero y Desarrollo Institucional'
    },
    jefe: {
      nombre: 'LUIS EDUARDO RUBIANO GUAQUETA',
      email: 'rectoria@unicesmag.edu.co',
      cargo: 'Rector'
    }
  });

  assert.deepEqual(steps.map((step) => step.key), [
    'jefe',
    'sst',
    'gestion_humana',
    'tecnico_contable',
    'tesoreria'
  ]);
});

test('La revision financiera se conserva para los demas colaboradores', () => {
  const { steps } = _internals.buildApprovalPlan({
    personal: {
      nombre: 'OTRO COLABORADOR',
      email: 'colaborador@unicesmag.edu.co'
    },
    laboral: {
      dependencia: 'Dependencia de prueba',
      vicerrectoria: 'Rectoria',
      cargo: 'Profesional'
    },
    jefe: {
      nombre: 'LUIS EDUARDO RUBIANO GUAQUETA',
      email: 'rectoria@unicesmag.edu.co',
      cargo: 'Rector'
    }
  });

  assert.equal(steps.filter((step) => step.key === 'financiera_previa').length, 1);
});

test('Arquitectura recibe la aprobacion solo en el correo del programa', () => {
  const { steps } = _internals.buildApprovalPlan({
    personal: {
      nombre: 'ALVARO BAYARDO BOLANOS RUEDA',
      email: 'abbolanos@unicesmag.edu.co'
    },
    laboral: {
      dependencia: 'Programa Academico - Arquitectura',
      vicerrectoria: 'Vicerrectoria Academica',
      cargo: 'Docente Tiempo Completo'
    },
    jefe: {
      nombre: 'LILIAN MAGALI MARTINEZ CRESPO',
      email: 'lmmartinez@unicesmag.edu.co',
      cargo: 'Decano(a) de la Facultad de Arquitectura y Bellas Artes'
    }
  });

  const bossStep = steps.find((step) => step.key === 'jefe');
  assert.equal(bossStep.email, 'arquitectura@unicesmag.edu.co');
  assert.equal(bossStep.alternateApprovalEmail, '');
});

test('Diseno Grafico recibe la aprobacion solo en el correo del programa', () => {
  const { steps } = _internals.buildApprovalPlan({
    personal: {
      nombre: 'DOCENTE DE DISENO',
      email: 'docente.diseno@unicesmag.edu.co'
    },
    laboral: {
      dependencia: 'Programa Academico - Diseno Grafico',
      vicerrectoria: 'Vicerrectoria Academica',
      cargo: 'Docente Tiempo Completo'
    },
    jefe: {
      nombre: 'KAREN EUGENIA OCANA FIGUEROA',
      email: 'keocana@unicesmag.edu.co',
      cargo: 'Directora de Programa'
    }
  });

  const bossStep = steps.find((step) => step.key === 'jefe');
  assert.equal(bossStep.email, 'disenografico@unicesmag.edu.co');
  assert.equal(bossStep.alternateApprovalEmail, '');
});

test('La solicitud propia de la responsable no se envia al correo del programa restringido', () => {
  const { steps } = _internals.buildApprovalPlan({
    personal: {
      nombre: 'LILIAN MAGALI MARTINEZ CRESPO',
      email: 'lmmartinez@unicesmag.edu.co'
    },
    laboral: {
      dependencia: 'Programa Academico - Arquitectura',
      vicerrectoria: 'Vicerrectoria Academica',
      cargo: 'Decano(a)'
    },
    jefe: {
      nombre: 'SANDRA LUCIA BOLANOS DELGADO',
      email: 'sbolanos@unicesmag.edu.co',
      cargo: 'Vicerrectora Academica'
    }
  });

  const bossStep = steps.find((step) => step.key === 'jefe');
  assert.equal(bossStep.email, 'viceacad@unicesmag.edu.co');
  assert.equal(bossStep.alternateApprovalEmail, '');
});

test('Cuando la Vicerrectora Academica es jefe no se habilita la dependencia de la solicitante', () => {
  const { steps } = _internals.buildApprovalPlan({
    personal: {
      nombre: 'DIANA MARCELA VIVEROS ROJAS',
      email: 'dmviveros@unicesmag.edu.co'
    },
    laboral: {
      dependencia: 'Oficina de Relaciones Interinstitucionales',
      vicerrectoria: 'Vicerrectoria Academica',
      cargo: 'Jefe de Relaciones Interinstitucionales'
    },
    jefe: {
      nombre: 'SANDRA LUCIA BOLANOS DELGADO',
      email: 'sbolanos@unicesmag.edu.co',
      cargo: 'Vicerrector (a) Academico (a)'
    }
  });

  const bossStep = steps.find((step) => step.key === 'jefe');
  assert.equal(bossStep.email, 'viceacad@unicesmag.edu.co');
  assert.equal(bossStep.alternateApprovalEmail, '');
  assert.equal(steps.filter((step) => step.key === 'vicerrectoria_dependencia').length, 0);
});

test('No duplica la Vicerrectoria Financiera para sus colaboradores adscritos', () => {
  const { steps } = _internals.buildApprovalPlan({
    personal: {
      nombre: 'LUIS ALBERTO QUITIAQUEZ SEGURA',
      email: 'laquitiaquez@unicesmag.edu.co'
    },
    laboral: {
      dependencia: 'Oficina de Infraestructura Tecnologica',
      vicerrectoria: 'Vicerrectoria Financiera y de Desarrollo Institucional',
      cargo: 'Coordinador Centro de Datos'
    },
    jefe: {
      nombre: 'MANUEL JESUS ALIRIO VELASQUEZ CARDENAS',
      email: 'mjvelasquez@unicesmag.edu.co',
      cargo: 'Jefe de Infraestructura Tecnologica'
    }
  });

  assert.equal(steps.filter((step) => step.key === 'financiera_previa').length, 1);
  assert.equal(steps.filter((step) => step.key === 'vicerrectoria_dependencia').length, 0);
  assert.deepEqual(steps.map((step) => step.key), [
    'jefe',
    'financiera_previa',
    'sst',
    'gestion_humana',
    'tecnico_contable',
    'tesoreria'
  ]);
});
