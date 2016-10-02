var app = require('../app');
var tableController = require('../controllers/table');

/* Setup routes */
function io(server) {
    var io      = require('socket.io')(server);
    var users   = {};
    var clients = {};

    io.use(function(socket, next) {
        app.session(socket.request, socket.request.res, next);
    });

    io.on('connection', function(socket){
        console.log('user connected'); 
        var user = {};
        var passport = socket.request.session.passport;

        if(typeof passport !== "undefined"){
            if("user" in passport){
                user.username        = socket.request.session.passport.user;
                users[user.username] = socket.id; // connected user with its socket.id
                clients[socket.id]   = socket; // add the client data to the hash
            }
        }

        socket.on('disconnect', function(){
            var passport = socket.request.session.passport;
            var user;

            console.log('user disconnected');
            if(typeof passport !== "undefined"){
                if("user" in passport){
                    user = socket.request.session.passport.user;

                    delete clients[socket.id]; // remove the client from the array
                    delete users[user]; // remove connected user & socket.i
                }
            }
        });

        socket.on('seat action', function(req){
            req.user = user;
            if(typeof req.user.username !== "undefined"){
                tableController.action(req).then(function(table){
                    var res   = tableController.data;
                    var seats = res.seats;
                    var player = res.player;

                    delete res.player;
                    delete res.seats;

                    for(var user in users) {
                        var client = clients[users[user]];
                        if(user in seats){
                            client.emit("player refresh", seats[user]);
                        }
                    }

                    tableController.logs(res.table).then(function(log){
                        console.log(log);
                    });

                    if(player.username in seats){
                        // TODO: Figure out how to make this work better
                    } else {
                        socket.emit("player refresh", player);
                    }

                    io.emit('table refresh', res);
                });

                // tableController.logs(table).then(function(logs){
                //     var res    = tableController.data;
                //     var table  = res.table;
                //     var seats  = res.seats;
                //     var player = res.player;
                // });
            }

            else {
                console.log("user not logged in!!!");
            }
        })
    });
}

module.exports = io;