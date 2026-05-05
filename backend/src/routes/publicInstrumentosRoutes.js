const express = require('express');
const router = express.Router();
const controller = require('../controllers/instrumentosController');

router.get('/:code', controller.getPublicForm);
router.post('/:code/responses', controller.submitPublicResponse);

module.exports = router;
