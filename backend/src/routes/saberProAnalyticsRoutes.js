const express = require('express');
const router = express.Router();
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');
const {
  getSaberProFiltros,
  getSaberProFiltrosCascade,
  getSaberProOverview,
  getSaberProCharts,
  getSaberProTable,
  getResultadosDestacados,
  getSaberProControlChart,
  getValueAddedIndividual,
  getValueAddedGeneral,
  getValueAddedStats,
  getValueAddedNbc,
  getResultadosNbc,
  getResultadosNbcDetalle,
  getResultadosProgramas,
  getResultadosProgramaDetalle,
  getResultadosInstitucional,
  getResultadosComparativaS11Spr,
  getDocumentosEstudiantes,
  getComparativaEstudianteDetalle,
  getTablaModulosAnio,
  getResultadosDestacadosMejores
} = require('../controllers/saberProAnalyticsController');

const SABER_PRO_ANALYTICS_MODULE_KEYS = [
  'gestion_informacion',
  'saber_pro',
  'saber_pro_individuales_general',
  'saber_pro_individuales_saber_pro',
  'saber_pro_individuales_tyt',
  'saber_pro_individuales_destacados',
  'saber_pro_individuales_competencias',
  'saber_pro_individuales_becas',
  'saber_pro_agregados_general',
  'saber_pro_agregados_competencias_especificas',
  'saber_pro_agregados_competencias_genericas',
  'saber_pro_agregados_comparativo_general',
  'saber_pro_agregados_comparativo_especificas',
  'saber_pro_valor_agregado_individual',
  'saber_pro_valor_agregado_resultado_general',
  'saber_pro_valor_agregado_estadistica_general',
  'saber_pro_valor_agregado_nbc'
];

const canViewEstadisticaInstitucional = hasAnyRoleOrModulePermission({
  roles: [
    ROLES.ADMINISTRADOR,
    ROLES.PLANEACION_ESTRATEGICA,
    ROLES.PLANEACION_EFECTIVIDAD,
    ROLES.AUTOEVALUACION,
    ROLES.GESTION_INFORMACION
  ],
  moduleKeys: SABER_PRO_ANALYTICS_MODULE_KEYS
});

router.get('/filtros', auth, canViewEstadisticaInstitucional, getSaberProFiltros);
router.post('/filtros/cascade', auth, canViewEstadisticaInstitucional, getSaberProFiltrosCascade);
router.post('/overview', auth, canViewEstadisticaInstitucional, getSaberProOverview);
router.post('/charts', auth, canViewEstadisticaInstitucional, getSaberProCharts);
router.post('/table', auth, canViewEstadisticaInstitucional, getSaberProTable);
router.post('/resultados/destacados', auth, canViewEstadisticaInstitucional, getResultadosDestacados);
router.post('/control-chart', auth, canViewEstadisticaInstitucional, getSaberProControlChart);
router.post('/value-added/individual', auth, canViewEstadisticaInstitucional, getValueAddedIndividual);
router.post('/value-added/general', auth, canViewEstadisticaInstitucional, getValueAddedGeneral);
router.post('/value-added/stats', auth, canViewEstadisticaInstitucional, getValueAddedStats);
router.post('/value-added/nbc', auth, canViewEstadisticaInstitucional, getValueAddedNbc);
router.post('/resultados/nbc', auth, canViewEstadisticaInstitucional, getResultadosNbc);
router.post('/resultados/nbc/detalle', auth, canViewEstadisticaInstitucional, getResultadosNbcDetalle);
router.post('/resultados/programas', auth, canViewEstadisticaInstitucional, getResultadosProgramas);
router.post('/resultados/programas/detalle', auth, canViewEstadisticaInstitucional, getResultadosProgramaDetalle);
router.post('/resultados/institucional', auth, canViewEstadisticaInstitucional, getResultadosInstitucional);
router.post('/resultados/comparativa-s11-spr', auth, canViewEstadisticaInstitucional, getResultadosComparativaS11Spr);
router.post('/resultados/documentos-estudiantes', auth, canViewEstadisticaInstitucional, getDocumentosEstudiantes);
router.post('/resultados/comparativa-estudiante', auth, canViewEstadisticaInstitucional, getComparativaEstudianteDetalle);
router.post('/resultados/individuales/tabla-modulos', auth, canViewEstadisticaInstitucional, getTablaModulosAnio);
router.post('/resultados/individuales/destacados', auth, canViewEstadisticaInstitucional, getResultadosDestacadosMejores);

module.exports = router;
