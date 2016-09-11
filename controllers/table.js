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

app.config = {
    validBuyin: false
}

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
    },

    activeSeats: function(table) {
        var arr = [];

        for (var i = 0; i < table.seats.length; i++) {
            if (table.seats[i].active === true) {
                arr.push(i);
            }

            // TODO: Uncomment this when not testing
            // if (table.seats[i].dealer === true) {
            //     return false;
            // }
        }

        if (arr.length > 0) {
            return arr;
        }

        return false;
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

            // if (!table.deck) {
            //     console.log("Deck not found");
            // }

            // if (!table.deck.cards) {
            //     console.log("Cards not found");
            // }

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
    },

    updateChips: function(username, chips) {
        var query = { "username": username };

        Account.findOne(query, function(err, user) {
            if (err) {
                return console.log(err);
            }

            if (!user) {
                return console.log("No user found");
            }
        });
    },

    getBuyin: function(table, seat, callback) {
        var query = { "username": seat.player };
        app.config.validBuyin = false;

        Account.findOne(query, function(err, user) {
            if (err) {
                return console.log(err);
            }

            if (!user) {
                return console.log("No user found");
            }

            if (table.buyin > user.chips) {
                return console.log("Buyin failed: User does not have enough chips");
            }

            user.chips = user.chips - table.buyin;
            user.save();
        });
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

    start: function(table, user, response, res) {
        var activeSeats = app.helper.activeSeats(table);

        if (activeSeats) {
            table.status = "Started";

            // Get buyin
            for (var i = 0; i < table.seats.length; i++) {
                var seat = table.seats[i];
                if (seat.active) {
                    app.user.getBuyin(table, seat);

                    if (seat.chips !== table.buyin) {
                        seat.chips = table.buyin;
                    }
                }
            }

            table.markModified('seats');
            table.save();

            app.game.setDealer(table);
            app.game.deal(table, user, response, res);
        }

        response.response = "No seats filled";
        return res.send(response);
    }
};

app.game = {
    resetDeck: function(table) {
        var cardValues = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
        var cardSuits = ["H", "D", "C", "S"];
        var cards = [];

        for (var k = 0; k < cardSuits.length; k++) {
            for (var j = 0; j < cardValues.length; j++) {
                var card = new Card({
                    value: cardValues[j],
                    suit: cardSuits[k]
                });

                cards.push(card);
            }
        }

        var deck = new Deck({
            cards: cards
        });

        table.deck = deck;
        table.markModified('deck');
        table.save();
    },

    resetHand: function(table) {
        for (var i = 0; i < table.seats.length; i++) {
            table.seats[i].hand = [];
        }

        table.markModified('seats');
        table.save();
    },

    resetTable: function(table) {
        table.flop = [];
        table.turn = [];
        table.river = [];
        table.save();
    },

    setDealer: function(table) {
        var activeSeats = app.helper.activeSeats(table);
        // TODO: Turn floor into round
        var dealer = Math.floor(Math.random() * activeSeats.length);

        for (var i = 0; i < table.seats.length; i++) {
            table.seats[i].dealer = false;
        }

        table.seats[activeSeats[dealer]].dealer = true;

        table.markModified('seats');
        table.markModified('deck');
        table.save();
    },

    setBlinds: function(table) {
        for (var i = 0; i < table.seats.length; i++) {
            var seat = table.seats[i];

            if (typeof seat.player === "string") {
                if (seat.position === 1) {
                    app.seat.toPot(table, seat, table.sblind);
                }

                if (seat.position === 2) {
                    app.seat.toPot(table, seat, table.bblind);
                }
            }
        }
    },

    deal: function(table, user, response, res) {
        var activeSeats = app.helper.activeSeats(table);
        app.game.resetDeck(table);
        app.game.resetHand(table);
        app.game.resetTable(table);
        app.seat.setPosition(table);
        app.game.setBlinds(table);

        // Hands
        for (var i = 0; i < activeSeats.length; i++) {
            var seat = activeSeats[i];
            var cards = app.card.random(table, 2);
            var cardArr = [];

            if (cards.length > 0) {
                for (var j = 0; j < cards.length; j++) {
                    var cardObj = { value: cards[j].value, suit: cards[j].suit };
                    cardArr.push(cardObj);
                }
            }

            table.seats[seat].hand = cardArr;
        }

        table.markModified('seats');
        table.save();

        app.game.sendTableData(table, response);
        app.game.sendPlayerData(table, user, response);
    },

    flop: function(table, response, res) {
        // Check if flop is already defined
        if (table.flop.length > 0) {
            response = { response: "Flop fetched", success: true, flop: table.flop };
            return res.send(response);
        }

        var cards = app.card.random(table, 3);
        var cardArr = [];

        for (var j = 0; j < cards.length; j++) {
            var cardObj = { value: cards[j].value, suit: cards[j].suit };
            cardArr.push(cardObj);
        }

        table.flop = cardArr;
        table.save();

        response = { response: "Cards fetched", success: true, cards: cardArr };
        return res.send(response);
    },

    turn: function(table, response, res) {
        // Check if turn is already defined
        if (table.turn.length > 0) {
            response = { response: "Turn fetched", success: true, turn: table.turn };
            return res.send(response);
        }

        var cards = app.card.random(table, 1);
        var cardArr = [];

        for (var j = 0; j < cards.length; j++) {
            var cardObj = { value: cards[j].value, suit: cards[j].suit };
            cardArr.push(cardObj);
        }

        table.turn = cardArr;
        table.save();

        response = { response: "Turn fetched", success: true, turn: cardArr };
        return res.send(response);
    },

    river: function(table, response, res, type) {
        // Check if river is already defined
        if (table.river.length > 0) {
            response = { response: "River fetched", success: true, river: table.river };
            return res.send(response);
        }

        var cards = app.card.random(table, 1);
        var cardArr = [];

        for (var j = 0; j < cards.length; j++) {
            var cardObj = { value: cards[j].value, suit: cards[j].suit };
            cardArr.push(cardObj);
        }

        table.river = cardArr;
        table.save();

        response = { response: "River fetched", success: true, river: cardArr };
        return res.send(response);
    },

    kick: function() {
        // @TODO: kick player
    },

    winner: function() {
        // @TODO: Get the winner of the hand
    },

    sendTableData: function(table, response) {
        var seats = [];

        for (var i = 0; i < table.seats.length; i++) {
            var seat = {
                player: table.seats[i].player,
                dealer: table.seats[i].dealer,
                chips: table.seats[i].chips,
                position: table.seats[i].position
            }

            seats.push(seat);
        }

        var table = {
            seats: seats,
            flop: table.flop,
            turn: table.turn,
            river: table.river,
            status: table.status,
            pot: table.pot,
            sblind: table.sblind,
            bblind: table.bblind,
            buyin: table.buyin
        };

        response.table = table;
    },

    sendPlayerData: function(table, user, response) {
        var seatid;
        if (!user) {
            return response.player = 'No matching player found on table';
        }

        for (var i = 0; i < table.seats.length; i++) {
            var seat = table.seats[i];
            if (seat.player === user.username) {
                seatid = i;
            }
        }

        if (typeof seatid === "undefined") {
            return response.player = 'Player is not seated at the table';
        }

        var hand = table.seats[seatid].hand;
        var player = table.seats[seatid].player;

        if (user.username === player) {
            response.player = {
                hand: hand,
                seatid: seatid
            };
        }
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
    },

    toPot: function(table, seat, chips) {
        console.log("seat chips", seat.chips);
        console.log("seat usermnae", seat.player);
        console.log("chips", chips);

        if (seat.chips > chips) {
            console.log("Chips transferred to pot");
            seat.chips = seat.chips - chips;
            table.pot = table.pot + chips;
        } else {
            console.log("Seat does not have enough chips available for this transaction");
            // @TODO: Kick player from table or something?
        }

        table.markModified('seats');
        table.markModified('pot');
        table.save();
    },

    takePot: function(table, seat) {
        seat.chips = seat.chips + table.pot;
        table.pot = 0;

        table.markModified('seats');
        table.markModified('pot');
        table.save();
    },

    setPosition: function(table) {
        var counter = 0;

        for (var i = 0; i < table.seats.length; i++) {
            var seat = table.seats[i];
            var allowedPositions = [0, 2];

            if (typeof seat.player === "string") {
                if (seat.dealer === true) {
                    if (allowedPositions.indexOf(counter) === -1) {
                        return;
                    }

                    seat.position = counter;
                    counter++;

                    if (seat.position === 2) {
                        return;
                    }
                } else {
                    if (counter > 0) {
                        seat.position = counter;
                        counter++;
                    }
                }
            }

            if (i === table.seats.length - 1) {
                i = -1;
            }
        }

        table.markModified('seats');
        table.save();
    }
};

app.card = {
    random: function(table, amount) {
        var arr = [];

        for (var i = 0; i < amount; i++) {
            var getCardRand = Math.floor(Math.random() * table.deck.cards.length);
            var card = table.deck.cards[getCardRand];
            arr.push(card);
            table.deck.cards.splice(getCardRand, 1);
        }

        table.markModified('deck');
        table.save();

        return arr;
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
    var response = { response: "An unknown error has occurred", success: false };

    // if (!app.user.isLoggedIn(req, res)) {
    //     response.redirect = '/user/login';
    //     return res.send(response);
    // }

    Table.findOne(query, function(err, table) {
        if (app.state.isError(err, table)) {
            response.response = err;
            return res.send(response);
        }

        if (action === "join") {
            return app.table.join(table, seatid, user, response, res);
        }

        if (action === "leave") {
            return app.table.leave(table, seatid, user, response, res);
        }

        // if (action === "shuffle") {
        //     return app.table.shuffle(table, seatid, user, response, res);
        // }

        if (action === "start") {
            return app.table.start(table, user, response, res);
        }

        if (action === "refresh") {
            app.game.sendTableData(table, response);
            app.game.sendPlayerData(table, user, response);
        }

        // if (action === "gethand") {
        //     return app.seat.getHand(table, seatid, user, response, res);
        // }

        if (action === "flop") {
            return app.game.flop(table, response, res);
        }

        if (action === "turn") {
            return app.game.turn(table, response, res);
        }

        if (action === "river") {
            return app.game.river(table, response, res);
        }


        return res.send(response);
    });
};