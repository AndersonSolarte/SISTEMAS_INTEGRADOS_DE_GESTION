const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

const { Documento, PlanMejoramientoAsignacion, PlanMejoramientoActividadAsignacion, UserModulePermission } = require('../models');
const { buildPlanMejoramientoWorkbook, readInstitutionalPolicies, mergeLeaderExecutionContent, ensureAccess, planStateForAssignment } = require('./planMejoramientoController');

const samplePlan = () => ({
  programa: 'PROGRAMA DE PRUEBA',
  periodo_inicio: 2026,
  periodo_fin: 2028,
  contenido: {
    objetivos: [{
      codigo: 'OPM_01',
      factor: 'F3. Profesores',
      caracteristica: 'C11. Desarrollo profesoral',
      aspectosAutoevaluacion: [
        { aspecto: 'A21. Primer aspecto', calificacion: 3.8 },
        { aspecto: 'A22. Segundo aspecto', calificacion: 3.5 }
      ],
      tipoAccion: 'Mejoramiento',
      objetivo: 'Fortalecer el desarrollo profesoral',
      actividades: [{
        nombre: 'Actividad uno',
        descripcion: 'Descripción completa',
        indicador: 'Indicador uno',
        meta: 2,
        fechaInicio: '2026-02-01',
        fechaFin: '2026-11-30',
        recursos: 'Talento humano',
        procesoResponsable: 'DOCENCIA',
        cargoResponsable: 'Director de programa',
        alcance: 'PROGRAMA',
        ejeEstrategico: 'DOCENCIA',
        objetivoEstrategico: 'OE2',
        proyectoPdi: 'Proyecto institucional',
        politicasInstitucionales: ['Política institucional de calidad'],
        lineasAccionPolitica: ['Fortalecer la mejora continua'],
        metaAlcanzada: 1,
        fechaSeguimiento: '2026-06-30',
        evidencia: 'https://drive.example/evidencia',
        observaciones: 'Avance verificado'
      }]
    }],
    presupuesto: [{
      categoria: 'personal',
      subcategoria: 'docente_tc',
      codigoObjetivo: 'OPM_01',
      concepto: 'Hora docente',
      descripcion: 'Acompañamiento académico',
      cantidad: 2,
      valorUnitario: 1000
    }]
  }
});

test('genera la plantilla institucional diligenciada sin perder sus fórmulas', async () => {
  const workbook = await buildPlanMejoramientoWorkbook(samplePlan());
  const planSheet = workbook.getWorksheet('PM');

  assert.equal(planSheet.getCell('E5').value, '2026 - 2028');
  assert.equal(planSheet.getCell('E7').value, 'PROGRAMA DE PRUEBA');
  assert.equal(planSheet.getCell('B11').value, 'OPM_01');
  assert.equal(planSheet.getCell('E11').value, 'A21. Primer aspecto\nA22. Segundo aspecto');
  assert.equal(planSheet.getCell('F11').value, '3.8 / 3.5');
  assert.equal(planSheet.getCell('I11').value, 'Actividad uno');
  assert.equal(planSheet.getCell('V10').value, 'LINEAMIENTO ESTRATÉGICO');
  assert.match(planSheet.getCell('P11').value.formula, /^SUMIF\(PERSONAL!/);
  assert.equal(planSheet.getCell('P11').value.result, 3037.04);
  assert.match(planSheet.getCell('P12').value.formula, /^SUMIF\(PERSONAL!/);
  assert.equal(Number(planSheet.getCell('P12').value.result || 0), 0);

  const personal = workbook.getWorksheet('PERSONAL');
  assert.equal(personal.getCell('C17').value, 'Hora docente');
  assert.equal(personal.getCell('E17').value, 2);
  assert.equal(personal.getCell('G17').value.result, 3037.04);

  assert.equal(workbook.getWorksheet('Listas').state, 'hidden');
  assert.equal(workbook.getWorksheet('2025').state, 'hidden');
  assert.equal(workbook.getWorksheet('SEGUIMIENTO').getCell('C2').value, 'Actividad uno');
  assert.equal(workbook.getWorksheet('RESUMEN PRESUPUESTO').getCell('B2').value, 3037.04);
  assert.equal(workbook.getWorksheet('POLÍTICAS Y LÍNEAS').getCell('E2').value, 'Política institucional de calidad');
  assert.equal(workbook.getWorksheet('POLÍTICAS Y LÍNEAS').getCell('F2').value, 'Fortalecer la mejora continua');

  const buffer = await workbook.xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer);
  assert.equal(reopened.getWorksheet('PM').getCell('B11').value, 'OPM_01');
  assert.match(reopened.getWorksheet('PM').getCell('P11').value.formula, /^SUMIF\(PERSONAL!/);
});

test('agrupa únicamente las líneas de acción de cada política institucional', async () => {
  const originalFindAll = Documento.findAll;
  Documento.findAll = async () => [{
    titulo: 'Política de calidad',
    estado: 'vigente',
    datos_originales: {
      hoja: 'POLÍTICAS',
      linea_de_accion: 'Primera línea; Segunda línea'
    }
  }, {
    titulo: 'Política de inclusión',
    estado: 'vigente',
    datos_originales: {
      hoja: 'POLÍTICAS',
      linea_de_accion_1: 'Línea inclusiva'
    }
  }];
  try {
    assert.deepEqual(await readInstitutionalPolicies(), [{
      name: 'Política de calidad',
      actionLines: ['Primera línea', 'Segunda línea']
    }, {
      name: 'Política de inclusión',
      actionLines: ['Línea inclusiva']
    }]);
  } finally {
    Documento.findAll = originalFindAll;
  }
});

test('el director asignado puede formular objetivos, actividades y presupuesto sin alterar los insumos de autoevaluación', () => {
  const opportunities = [{ id: 91, aspecto: 'Aspecto transferido', calificacion: 3.7 }];
  const result = mergeLeaderExecutionContent({
    origen: 'autoevaluacion',
    oportunidadesAutoevaluacion: opportunities,
    objetivos: [],
    presupuesto: []
  }, {
    origen: 'modificado',
    oportunidadesAutoevaluacion: [{ id: 999 }],
    objetivos: [{ codigo: 'OPM_01', objetivo: 'Objetivo formulado', actividades: [{ nombre: 'Actividad del director' }] }],
    presupuesto: [{ codigoObjetivo: 'OPM_01', cantidad: 1, valorUnitario: 5000 }]
  });

  assert.equal(result.origen, 'autoevaluacion');
  assert.deepEqual(result.oportunidadesAutoevaluacion, opportunities);
  assert.equal(result.objetivos[0].actividades[0].nombre, 'Actividad del director');
  assert.equal(result.presupuesto[0].valorUnitario, 5000);
});

test('Administrador y Autoevaluación administran; el director asignado ingresa como ejecutor', async () => {
  const managerRequest = { user: { id: 10, role: 'autoevaluacion' } };
  let managerNext = false;
  await ensureAccess(managerRequest, {}, () => { managerNext = true; });
  assert.equal(managerNext, true);
  assert.equal(managerRequest.planMejoramientoManager, true);

  const adminRequest = { user: { id: 11, role: 'administrador' } };
  let adminNext = false;
  await ensureAccess(adminRequest, {}, () => { adminNext = true; });
  assert.equal(adminNext, true);
  assert.equal(adminRequest.planMejoramientoManager, true);

  const originalPermissions = UserModulePermission.findAll;
  const originalAssignments = PlanMejoramientoAsignacion.count;
  const originalTasks = PlanMejoramientoActividadAsignacion.count;
  UserModulePermission.findAll = async () => [];
  PlanMejoramientoAsignacion.count = async () => 1;
  PlanMejoramientoActividadAsignacion.count = async () => 0;
  const directorRequest = { user: { id: 20, role: 'consulta' } };
  let directorNext = false;
  try {
    await ensureAccess(directorRequest, {}, () => { directorNext = true; });
    assert.equal(directorNext, true);
    assert.equal(directorRequest.planExecutionOnly, true);
    assert.equal(Boolean(directorRequest.planMejoramientoManager), false);
    assert.equal(directorRequest.planCollaboratorOnly, false);
  } finally {
    UserModulePermission.findAll = originalPermissions;
    PlanMejoramientoAsignacion.count = originalAssignments;
    PlanMejoramientoActividadAsignacion.count = originalTasks;
  }
});

test('el estado general depende de la asignación principal del plan', () => {
  assert.equal(planStateForAssignment('en_ejecucion', null), 'borrador');
  assert.equal(planStateForAssignment('en_ejecucion', { user_id: 20, usuario: null, estado_flujo: 'asignado' }), 'borrador');
  assert.equal(planStateForAssignment('borrador', { user_id: 20, usuario: { id: 20 }, estado_flujo: 'asignado' }), 'en_ejecucion');
  assert.equal(planStateForAssignment('borrador', { user_id: 20, usuario: { id: 20 }, estado_flujo: 'en_revision' }), 'en_ejecucion');
  assert.equal(planStateForAssignment('en_ejecucion', { user_id: 20, usuario: { id: 20 }, estado_flujo: 'en_firme' }), 'cerrado');
});
