const express = require('express');
const router = express.Router();
const multer = require('multer');
const { importFromExcel, downloadTemplate } = require('../controllers/importController');
const { adminAuth } = require('../middlewares/auth');

const upload = multer({ dest: 'uploads/' });

router.post('/excel', adminAuth, upload.single('file'), importFromExcel);
router.get('/template', downloadTemplate);

module.exports = router;