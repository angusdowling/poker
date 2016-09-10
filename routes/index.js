/* Import routes */
var user = require('./user');
var home = require('./home');
var lobby = require('./lobby');
var table = require('./table');
var admin = require('./admin');

/* Define variables */
var router;


/* Setup routes */
function routes(app) {
    app.use('/', home);
    app.use('/user', user);
    app.use('/lobby', lobby);
    app.use('/table', table);
    app.use('/admin', admin);
}

module.exports = routes;