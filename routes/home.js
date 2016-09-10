/* Import node_modules */
var express = require('express');
var router = express.Router();

/* Import Controller */
var home = require('../controllers/home');

/** 
 * # Define routes
 */
router.get('/', home.index);

module.exports = router;