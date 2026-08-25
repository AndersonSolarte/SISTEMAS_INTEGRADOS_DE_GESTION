const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const cronogramaMovilidadController = require('../controllers/cronogramaMovilidadController');

// Rutas de búsqueda y consulta docente (Públicas/Protegidas por Token)
router.get('/estudiantes/buscar', auth, cronogramaMovilidadController.buscarEstudiantesMatriculados);
router.get('/responsables/buscar', auth, cronogramaMovilidadController.buscarResponsables);
router.get('/mis-actividades', auth, cronogramaMovilidadController.misActividadesAsignadas);

// CRUD Cronogramas
router.post('/', auth, cronogramaMovilidadController.crearOBorrador);
router.get('/', auth, cronogramaMovilidadController.obtenerCronogramas);
router.get('/:id', auth, cronogramaMovilidadController.obtenerPorId);
router.put('/:id', auth, cronogramaMovilidadController.actualizarCronograma);
router.delete('/:id', auth, cronogramaMovilidadController.eliminarCronograma);

// Flujo de Aprobación
router.post('/:id/radicar', auth, cronogramaMovilidadController.radicarCronograma);
router.post('/:id/visto-bueno-academica', auth, cronogramaMovilidadController.vistoBuenoAcademica);
router.post('/:id/devolver-correccion', auth, cronogramaMovilidadController.devolverACorreccion);
router.post('/:id/aprobar-financiera', auth, cronogramaMovilidadController.aprobarFinanciera);
router.post('/actividades/:id/cumplir', auth, cronogramaMovilidadController.marcarActividadCumplida);

module.exports = router;
