/* Import node_modules */
var express = require('express');
var passport = require('passport');
var router = express.Router();

/* Import Controller */
var user = require('../controllers/user');

router.get('/register', user.registerForm);

router.post('/register', user.register);

router.get('/login', user.loginForm);

router.post('/login', passport.authenticate('local'), user.login);

router.get('/logout', user.logout);

module.exports = router;