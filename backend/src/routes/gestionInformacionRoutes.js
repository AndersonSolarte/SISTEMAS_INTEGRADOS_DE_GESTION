const express = require('express');
const router = express.Router();
const { auth, hasAnyRole, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const {
  getEstadisticas,
  getMatriculadosIncidencias,
  getResumen,
  getCargues,
  createEstadistica,
  updateEstadistica,
  deleteEstadistica,
  downloadTemplate,
  downloadContextoExternoNormalizado,
  downloadCargueErrores,
  downloadCargueBase,
  getDivipolaIncidencias,
  resolveDivipolaIncidencia,
  importFromExcel,
  clearByCategoria,
  exportPlanAccionInstitucional,
  exportActaInstitucional,
  sugerirIndicadorPlanAccion
} = require('../controllers/gestionInformacionController');
const { ROLES } = require('../constants/roles');
const { createExcelUpload } = require('../middlewares/excelUpload');
const upload = createExcelUpload('uploads/temp/');

const canViewEstadisticaInstitucional = hasAnyRole(
  ROLES.ADMINISTRADOR,
  ROLES.PLANEACION_ESTRATEGICA,
  ROLES.PLANEACION_EFECTIVIDAD,
  ROLES.AUTOEVALUACION,
  ROLES.GESTION_INFORMACION,
  ROLES.GESTION_PROCESOS
);

const canViewEstadisticaInstitucionalByPermission = hasAnyRoleOrModulePermission({
  roles: [
    ROLES.ADMINISTRADOR,
    ROLES.PLANEACION_ESTRATEGICA,
    ROLES.PLANEACION_EFECTIVIDAD,
    ROLES.AUTOEVALUACION,
    ROLES.GESTION_INFORMACION,
    ROLES.GESTION_PROCESOS
  ],
  moduleKeys: [
    'gestion_informacion',
    'estadistica_institucional',
    'gestion_bases_datos',
    'poblacional',
    'biblioteca',
    'medios_educativos',
    'internacionalizacion',
    'investigacion',
    'proyectos_convenios',
    'recurso_humano',
    'saber_pro',
    'gestion_procesos',
    'estadistica_documental',
    'plan_accion'
  ]
});

const canManageBasesByPermission = hasAnyRoleOrModulePermission({
  roles: [
    ROLES.ADMINISTRADOR,
    ROLES.PLANEACION_ESTRATEGICA
  ],
  moduleKeys: [
    'gestion_informacion',
    'gestion_bases_datos',
    'poblacional',
    'saber_pro',
    'plan_accion'
  ]
});

router.get('/', auth, canViewEstadisticaInstitucionalByPermission, getEstadisticas);
router.get('/matriculados-incidencias', auth, canViewEstadisticaInstitucionalByPermission, getMatriculadosIncidencias);
router.get('/resumen', auth, canViewEstadisticaInstitucionalByPermission, getResumen);
router.get('/cargues', auth, canManageBasesByPermission, getCargues);
router.get('/template', auth, canManageBasesByPermission, downloadTemplate);
router.get('/contexto-externo/export', auth, canManageBasesByPermission, downloadContextoExternoNormalizado);
router.get('/cargues/errors/export', auth, canManageBasesByPermission, downloadCargueErrores);
router.get('/cargues/base/export', auth, canManageBasesByPermission, downloadCargueBase);
router.get('/divipola/incidencias', auth, canViewEstadisticaInstitucionalByPermission, getDivipolaIncidencias);
router.put('/divipola/incidencias/:id', auth, canViewEstadisticaInstitucionalByPermission, resolveDivipolaIncidencia);
router.post('/plan-accion/export', auth, canManageBasesByPermission, exportPlanAccionInstitucional);
router.post('/plan-accion/acta/export', auth, canManageBasesByPermission, exportActaInstitucional);
router.post('/plan-accion/sugerir-indicador', auth, canManageBasesByPermission, sugerirIndicadorPlanAccion);
router.post('/import', auth, canManageBasesByPermission, upload.single('file'), importFromExcel);
router.delete('/clear', auth, canManageBasesByPermission, clearByCategoria);
router.post('/', auth, canManageBasesByPermission, createEstadistica);
router.put('/:id', auth, canManageBasesByPermission, updateEstadistica);
router.delete('/:id', auth, canManageBasesByPermission, deleteEstadistica);

module.exports = router;
