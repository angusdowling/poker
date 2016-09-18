/* Import node_modules */
var express = require('express');
var router = express.Router();

/* Import Controller */
var table = require('../controllers/table');

/**
 * Access the table
 */
router.get('/:id', table.index);

router.post('/:id/:action/', table.action);

router.post('/:id/:action/:seatid', table.action);

router.post('/:id/:action/:seatid/:chips', table.action);

module.exports = router;