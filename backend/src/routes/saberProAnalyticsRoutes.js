const express = require('express');
const router = express.Router();
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');
const {
  getSaberProFiltros,
  getSaberProOverview,
  getSaberProCharts,
  getSaberProTable,
  getSaberProControlChart
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
router.post('/overview', auth, canViewEstadisticaInstitucional, getSaberProOverview);
router.post('/charts', auth, canViewEstadisticaInstitucional, getSaberProCharts);
router.post('/table', auth, canViewEstadisticaInstitucional, getSaberProTable);
router.post('/control-chart', auth, canViewEstadisticaInstitucional, getSaberProControlChart);

module.exports = router;
