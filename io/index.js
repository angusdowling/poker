var app = require('../app');
var tableController = require('../controllers/table');

/* Setup routes */
function io(server) {
    var io = require('socket.io')(server);

    io.use(function(socket, next) {
        app.session(socket.request, socket.request.res, next);
    });

    io.on('connection', function(socket){
        console.log('user connected'); 
        var user = {};

        if(typeof socket.request.session.passport !== "undefined"){
            user.username = socket.request.session.passport.user;
        }

        socket.on('disconnect', function(){
            console.log('user disconnected');
        });

        socket.on('seat action', function(req){
            req.user = user;

            if(typeof req.user.username !== "undefined"){
                tableController.action(req).then(function(table){
                    var res = tableController.data;

                    responsePlayer = {};
                    responsePlayer.player = res.player;
                    delete res.player;

                    socket.emit('player refresh', responsePlayer);
                    io.emit('table refresh', res);
                });

                
            }

            else {
                console.log("user not logged in!!!");
            }
        })
    });
}

module.exports = io;
