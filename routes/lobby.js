/* Import node_modules */
var express = require('express');
var router = express.Router();

/* Import Controller */
var lobby = require('../controllers/lobby');

/** 
 * # Define routes
 */
router.get('/', lobby.index);

module.exports = router;