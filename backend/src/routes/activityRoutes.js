const express = require('express');
const router  = express.Router();
const { auth } = require('../middlewares/auth');
const { getStats } = require('../controllers/activityController');

/* Only ADMINISTRADOR can access */
const onlyAdmin = (req, res, next) => {
  if (req.user?.role !== 'administrador') {
    return res.status(403).json({ success: false, message: 'Acceso restringido al administrador.' });
  }
  next();
};

router.get('/stats', auth, onlyAdmin, getStats);

module.exports = router;
