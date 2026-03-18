const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { listFavorites, listFavoriteIds, addFavorite, removeFavorite } = require('../controllers/favoritoController');

router.get('/', auth, listFavorites);
router.get('/ids', auth, listFavoriteIds);
router.post('/:documentoId', auth, addFavorite);
router.delete('/:documentoId', auth, removeFavorite);

module.exports = router;
