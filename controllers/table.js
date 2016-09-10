/* Import node_modules */
var express = require('express');
var passport = require('passport');
var mongoose = require('mongoose');

/* Load models */
var Account = require('../models/account');
var Table = require('../models/table');
var Seat = require('../models/seat');
var Deck = require('../models/deck');
var Card = require('../models/card');

var app = app || {};

app.helper = {
    shuffleArray: function(array) {
        var i = 0;
        var j = 0;
        var temp = null;

        for (i = array.length - 1; i > 0; i -= 1) {
            j = Math.floor(Math.random() * (i + 1));
            temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }

        return array;
    }
};

app.state = {
    isError: function(err, table) {
        if (err) {
            console.log(err);
            return true;
        }

        if (!table || !table.deck || !table.deck.cards) {
            if (!table) {
                console.log("Table not found");
            }

            if (!table.deck) {
                console.log("Deck not found");
            }

            if (!table.deck.cards) {
                console.log("Cards not found");
            }

            return true;
        }

        return false;
    }
};

app.user = {
    isLoggedIn: function(req, res) {
        if (typeof req.user === "undefined") {
            return false;
        }

        return true;
    },

    isSeated: function(table, seatid, user) {
        var seat = table.seats[seatid];

        for (var i = 0; i < table.seats.length; i++) {
            var singleseat = table.seats[i];
            if (singleseat.player === user.username) {
                return true;
            }
        }

        return false;
    },

    isSeatPlayer: function(table, seatid, user) {
        var seat = table.seats[seatid];

        if (seat.player !== user.username) {
            return false;
        }

        return true;
    }
};

app.table = {
    join: function(table, seatid, user, response, res) {
        if (app.user.isSeated(table, seatid, user)) {
            response.response = "Player is already seated at this table";
            return res.send(response);
        }

        var seat = table.seats[seatid];

        seat.player = user.username;
        seat.active = true;
        table.markModified('seats');
        table.save();

        response = {
            response: user.username + ' has sat down in seat ' + seatid,
            success: true
        };

        return res.send(response);
    },

    leave: function(table, seatid, user, response, res) {
        if (!app.user.isSeatPlayer(table, seatid, user)) {
            response.response = "Player does not match seat player";
            return res.send(response);
        }

        var seat = table.seats[seatid];

        seat.player = null;
        seat.active = false;
        table.markModified('seats');
        table.save();

        response = {
            response: user.username + ' has left seat ' + seatid,
            success: true
        };

        return res.send(response);
    },

    shuffle: function(table, seatid, user, response, res) {
        table.deck.cards = app.helper.shuffleArray(table.deck.cards);

        table.markModified('deck');
        table.save();

        if (typeof res !== "undefined") {
            response = {
                response: "Deck shuffled",
                success: true
            };

            return res.send(response);
        }
    },

    start: function(table, seatid, user, response, res) {
        function activeSeats(table) {
            var arr = [];

            for (var i = 0; i < table.seats.length; i++) {
                if (table.seats[i].active === true) {
                    arr.push(i);
                }

                if (table.seats[i].Dealer === true) {
                    return false;
                }
            }

            if (arr.length > 0) {
                return arr;
            }

            return false;
        }

        var activeSeats = activeSeats(table);

        if (activeSeats) {
            table.status = "Started";
            // @TODO: Shuffle deck here a few times;

            // @TODO: Change to Math.Round
            var dealer = Math.floor(Math.random() * activeSeats.length);

            table.seats[activeSeats[dealer]].dealer = true;

            table.markModified('seats');
            table.save();

            response = {
                response: "Game started",
                success: true
            };
        } else {
            response.response = "No seats filled";
        }

        return res.send(response);
    }
};

app.game = {
    deal: function() {
        // @TODO: Deal cards
    },

    flop: function() {
        // @TODO: Show flop
    },

    turn: function() {
        // @TODO: Show turn card
    },

    river: function() {
        // @TODO: Show river
    },

    kick: function() {
        // @TODO: kick player
    },

    winner: function() {
        // @TODO: Get the winner of the hand
    }
};

app.seat = {
    call: function() {
        // @TODO: Call current bet
    },

    fold: function() {
        // @TODO: Fold hand
    },

    allin: function() {
        // @TODO: Push all in
    },

    check: function() {
        // @TODO: Check current bet
    },

    bet: function() {
        // @TODO: Raise bet
    },

    evaluate: function() {
        // @TODO: Evaluate the hand
    }
};

/** 
 * Index
 */
exports.index = function(req, res) {
    var id = req.params['id'];
    var query = { "_id": id };
    var response = { response: "Failed to open table", success: false };

    Table.findOne(query, function(err, table) {
        if (app.state.isError(err, table)) {
            response.err = err;
            return res.send(response);
        }

        res.render('table/table', { "table": table, "seats": table.seats });
    });
};

exports.action = function(req, res) {
    var action = req.params['action'];
    var id = req.params['id'];
    var seatid = req.params['seatid'];
    var user = req.user;
    var query = { "_id": id };
    var response = { response: "Failed to join table", success: false };

    if (!app.user.isLoggedIn(req, res)) {
        response.redirect = '/user/login';
        return res.send(response);
    }

    Table.findOne(query, function(err, table) {
        if (app.state.isError(err, table)) {
            return res.send(response);
        }

        if (action === "join") {
            return app.table.join(table, seatid, user, response, res);
        }

        if (action === "leave") {
            return app.table.leave(table, seatid, user, response, res);
        }

        if (action === "shuffle") {
            return app.table.shuffle(table, seatid, user, response, res);
        }

        if (action === "start") {
            return app.table.start(table, seatid, user, response, res);
        }

        return res.send(response);
    });
};