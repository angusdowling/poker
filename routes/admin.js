/* Import node_modules */
var express = require('express');
var router = express.Router();

/* Import Controller */
var admin = require('../controllers/admin');

/**
 * Create new table form
 */
router.get('/table/new', admin.newTableForm);

/**
 * for create new table
 */
router.post('/table/new', admin.newTable);

module.exports = router;