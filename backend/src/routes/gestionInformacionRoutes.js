const express = require('express');
const router = express.Router();
const { auth, hasAnyRole, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const fs = require('fs');
const path = require('path');
const {
  uploadAuditorioFoto,
  getEstadisticas,
  getMatriculadosIncidencias,
  getResumen,
  getCargues,
  createEstadistica,
  updateEstadistica,
  createAutoevaluacionParticipante,
  createAutoevaluacionPrograma,
  updateAutoevaluacionAspecto,
  updateAutoevaluacionParticipante,
  updateAutoevaluacionPrograma,
  deleteAutoevaluacionParticipante,
  deleteEstadistica,
  downloadTemplate,
  downloadContextoExternoNormalizado,
  downloadCargueErrores,
  downloadCargueBase,
  getRegistrosCalificadosEvidencias,
  getDivipolaIncidencias,
  resolveDivipolaIncidencia,
  importFromExcel,
  clearByCategoria,
  exportPlanAccionInstitucional,
  exportActaInstitucional,
  sugerirIndicadorPlanAccion,
  getInfraestructuras,
  createInfraestructura,
  updateInfraestructura,
  deleteInfraestructura,
  uploadInfraestructuraTemplate,
  getEdificacionesReferencia,
  createEdificacionReferencia,
  updateEdificacionReferencia,
  deleteEdificacionReferencia
} = require('../controllers/gestionInformacionController');
const { ROLES } = require('../constants/roles');
const { createExcelUpload } = require('../middlewares/excelUpload');
const {
  getDatabaseHealth,
  getSystemTablesCatalog,
  exportTableData,
  downloadDatabaseDump,
  restoreDatabaseDump,
  getBackupMonitor,
  runAutomaticBackupNow,
  pauseAutomaticBackups,
  resumeAutomaticBackups
} = require('../controllers/databaseCenterController');
const upload = createExcelUpload('uploads/temp/');

const multer = require('multer');
const docxUpload = multer({
  dest: process.env.EXCEL_UPLOAD_TMP_DIR || 'uploads/temp/',
  limits: {
    fileSize: Number(process.env.DOCX_UPLOAD_MAX_MB || 25) * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const mime = String(file?.mimetype || '').toLowerCase();
    const ext = path.extname(String(file?.originalname || '')).toLowerCase();
    if (
      ext === '.docx' &&
      (
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mime === 'application/octet-stream'
      )
    ) {
      return cb(null, true);
    }
    return cb(new Error('Archivo no permitido. Solo se admiten plantillas Word .docx.'));
  }
});
const databaseRestoreUpload = multer({
  dest: process.env.DATABASE_RESTORE_TMP_DIR || 'uploads/temp/',
  limits: { fileSize: Number(process.env.DATABASE_RESTORE_MAX_GB || 10) * 1024 * 1024 * 1024, files: 1 }
});

const auditorioFotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/auditorios/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'auditorio-' + uniqueSuffix + ext);
  }
});

const auditorioFotoUpload = multer({
  storage: auditorioFotoStorage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

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
    ROLES.REGISTROS_CALIFICADOS,
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
    'plan_accion',
    'autoevaluacion',
    'registros_calificados_acreditacion',
    'registros_calificados_y_acreditacion',
    'infraestructura_fisica.ver',
    'infraestructura_fisica.gestionar'
  ]
});

const canManageBasesByPermission = hasAnyRoleOrModulePermission({
  roles: [
    ROLES.ADMINISTRADOR,
    ROLES.PLANEACION_ESTRATEGICA,
    ROLES.AUTOEVALUACION,
    ROLES.REGISTROS_CALIFICADOS,
    ROLES.GESTION_PROCESOS
  ],
  moduleKeys: [
    'gestion_informacion',
    'gestion_bases_datos',
    'gestion_procesos',
    'estadistica_documental',
    'poblacional',
    'saber_pro',
    'plan_accion',
    'autoevaluacion',
    'registros_calificados_acreditacion',
    'registros_calificados_y_acreditacion',
    'infraestructura_fisica.gestionar'
  ]
});

// El Centro de Bases de Datos se deniega por defecto. Fuera del administrador,
// cada capacidad requiere una asignación explícita en Gestión de Usuarios.
const canAccessDatabaseCenter = hasAnyRoleOrModulePermission({
  roles: [ROLES.ADMINISTRADOR],
  moduleKeys: [
    'gestion_bases_datos',
    'gestion_bases_datos.respaldo_descargar',
    'gestion_bases_datos.restaurar',
    'gestion_bases_datos.datos_exportar',
    'gestion_bases_datos.importar'
  ]
});
const canDownloadDatabaseBackup = hasAnyRoleOrModulePermission({
  roles: [ROLES.ADMINISTRADOR],
  moduleKeys: ['gestion_bases_datos.respaldo_descargar']
});
const canRestoreDatabaseBackup = hasAnyRoleOrModulePermission({
  roles: [ROLES.ADMINISTRADOR],
  moduleKeys: ['gestion_bases_datos.restaurar']
});
const canExportDatabaseTables = hasAnyRoleOrModulePermission({
  roles: [ROLES.ADMINISTRADOR],
  moduleKeys: ['gestion_bases_datos.datos_exportar']
});
const canImportDatabaseData = hasAnyRoleOrModulePermission({
  roles: [ROLES.ADMINISTRADOR],
  moduleKeys: ['gestion_bases_datos.importar']
});

const canViewInfraestructura = hasAnyRoleOrModulePermission({
  roles: [ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA],
  moduleKeys: ['infraestructura_fisica', 'infraestructura_fisica.ver', 'infraestructura_fisica.gestionar']
});

const canManageInfraestructura = hasAnyRoleOrModulePermission({
  roles: [ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA],
  moduleKeys: ['infraestructura_fisica.gestionar']
});

router.get('/', auth, canViewEstadisticaInstitucionalByPermission, getEstadisticas);
router.get('/matriculados-incidencias', auth, canViewEstadisticaInstitucionalByPermission, getMatriculadosIncidencias);
router.get('/resumen', auth, canViewEstadisticaInstitucionalByPermission, getResumen);
router.get('/cargues', auth, canImportDatabaseData, getCargues);
router.get('/template', auth, canImportDatabaseData, downloadTemplate);
router.get('/contexto-externo/export', auth, canImportDatabaseData, downloadContextoExternoNormalizado);
router.get('/cargues/errors/export', auth, canImportDatabaseData, downloadCargueErrores);
router.get('/cargues/base/export', auth, canImportDatabaseData, downloadCargueBase);
router.get('/database/health', auth, canAccessDatabaseCenter, getDatabaseHealth);
router.get('/database/tables-catalog', auth, canExportDatabaseTables, getSystemTablesCatalog);
router.get('/database/export-table', auth, canExportDatabaseTables, exportTableData);
router.post('/database/backup-dump', auth, canDownloadDatabaseBackup, downloadDatabaseDump);
router.post('/database/restore-dump', auth, canRestoreDatabaseBackup, databaseRestoreUpload.single('backup'), restoreDatabaseDump);
router.get('/database/backup-monitor', auth, canDownloadDatabaseBackup, getBackupMonitor);
router.post('/database/backup-monitor/run', auth, hasAnyRole(ROLES.ADMINISTRADOR), runAutomaticBackupNow);
router.post('/database/backup-monitor/pause', auth, hasAnyRole(ROLES.ADMINISTRADOR), pauseAutomaticBackups);
router.post('/database/backup-monitor/resume', auth, hasAnyRole(ROLES.ADMINISTRADOR), resumeAutomaticBackups);
router.get('/registros-calificados/:id/evidencias', auth, canViewEstadisticaInstitucionalByPermission, getRegistrosCalificadosEvidencias);
router.get('/divipola/incidencias', auth, canViewEstadisticaInstitucionalByPermission, getDivipolaIncidencias);
router.put('/divipola/incidencias/:id', auth, canViewEstadisticaInstitucionalByPermission, resolveDivipolaIncidencia);
router.post('/plan-accion/export', auth, hasAnyRole(ROLES.ADMINISTRADOR, ROLES.PLANEACION_EFECTIVIDAD, ROLES.PLANEACION_ESTRATEGICA, ROLES.CONSULTA), exportPlanAccionInstitucional);
router.post('/plan-accion/acta/export', auth, hasAnyRole(ROLES.ADMINISTRADOR, ROLES.PLANEACION_EFECTIVIDAD, ROLES.PLANEACION_ESTRATEGICA, ROLES.CONSULTA), exportActaInstitucional);
router.post('/plan-accion/sugerir-indicador', auth, hasAnyRole(ROLES.ADMINISTRADOR, ROLES.PLANEACION_EFECTIVIDAD, ROLES.PLANEACION_ESTRATEGICA, ROLES.AUTOEVALUACION), sugerirIndicadorPlanAccion);
router.post('/autoevaluacion/participantes', auth, canManageBasesByPermission, createAutoevaluacionParticipante);
router.post('/autoevaluacion/programas', auth, canManageBasesByPermission, createAutoevaluacionPrograma);
router.put('/autoevaluacion/aspectos/:id', auth, canManageBasesByPermission, updateAutoevaluacionAspecto);
router.put('/autoevaluacion/participantes/:id', auth, canManageBasesByPermission, updateAutoevaluacionParticipante);
router.delete('/autoevaluacion/participantes/:id', auth, canManageBasesByPermission, deleteAutoevaluacionParticipante);
router.put('/autoevaluacion/programas/:id', auth, canManageBasesByPermission, updateAutoevaluacionPrograma);
router.post('/import', auth, canImportDatabaseData, upload.single('file'), importFromExcel);
router.delete('/clear', auth, canImportDatabaseData, clearByCategoria);
router.post('/', auth, canManageBasesByPermission, createEstadistica);
router.put('/:id', auth, canManageBasesByPermission, updateEstadistica);
router.delete('/:id', auth, canManageBasesByPermission, deleteEstadistica);

// Rutas para Infraestructura Física
router.get('/infraestructura', auth, canViewInfraestructura, getInfraestructuras);
router.post('/infraestructura', auth, canManageInfraestructura, createInfraestructura);
router.put('/infraestructura/:id', auth, canManageInfraestructura, updateInfraestructura);
router.delete('/infraestructura/:id', auth, canManageInfraestructura, deleteInfraestructura);
router.post('/infraestructura/upload-template', auth, canViewInfraestructura, docxUpload.single('file'), uploadInfraestructuraTemplate);
router.post('/infraestructura/auditorios/foto', auth, canManageInfraestructura, auditorioFotoUpload.single('foto'), uploadAuditorioFoto);

// Rutas para Edificaciones de Referencia
router.get('/infraestructura/edificaciones-referencia', auth, canViewInfraestructura, getEdificacionesReferencia);
router.post('/infraestructura/edificaciones-referencia', auth, canManageInfraestructura, createEdificacionReferencia);
router.put('/infraestructura/edificaciones-referencia/:id', auth, canManageInfraestructura, updateEdificacionReferencia);
router.delete('/infraestructura/edificaciones-referencia/:id', auth, canManageInfraestructura, deleteEdificacionReferencia);

module.exports = router;
