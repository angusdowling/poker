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
var Solver = require('../assets/js/vendor/pokersolver.js');

var app = app || {};


/**
 * Application for Table
 * 
 * @namespace app
 * 
 * @param config
 *      Configuration settings for the application. Also stores app wide variables.
 */

app.config = {
    validBuyin: false
}

/**
 * Helper methods
 * 
 * @namespace helper
 * 
 * @param shuffleArray
 *      Shuffles a deck of cards (or any array).
 * 
 * @param filledSeats
 *      Find the seats that are occupied
 *      @return arr with seatid's (e.g [1, 5, 7])
 */

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

    filledSeats: function(table) {
        var arr = [];

        for (var i = 0; i < table.seats.length; i++) {
            if (table.seats[i].player !== null) {
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

/**
 * Table state methods
 * 
 * @namespace state
 * 
 * @param isError
 *      For when an error is thrown. prints the error out and exits the function.
 */

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

            return true;
        }

        return false;
    }
};

/**
 * User methods (Logged in player interacting with the table, but not a table player)
 * 
 * @namespace user
 * 
 * @param isLoggedIn
 *      Check if there is an active session
 * 
 *  @param isSeated
 *      Check if user is seated at the table
 * 
 *  @param isSeatPlayer
 *      Check if user is seated at specific seat (used for gathering sensitive data such as hands that other players shouldn't see)
 * 
 *  @param updateChips
 *      Update the real users total chips (For ring/sit&go tables only. Should not be used for tournament)
 * 
 *  @param getBuyin
 *      Subtract the buyin for the table from the users total chips.
 */

app.user = {
    isLoggedIn: function(req, res) {
        console.log('isloggedin');
        if (typeof req.user === "undefined") {
            return false;
        }

        return true;
    },

    isSeated: function(table, seatid, user) {
        console.log('isseated');
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
        console.log('isseatplayer');
        var seat = table.seats[seatid];

        if (seat.player !== user.username) {
            return false;
        }

        return true;
    },

    updateChips: function(username, chips) {
        console.log('updatechips');
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
        console.log('getbuyin');
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

/**
 * Table methods
 * 
 * @namespace table
 * 
 * @param join
 *      A player joining the table
 * 
 *  @param leave
 *      A player leaving the table
 * 
 *  @param shuffle
 *      Shuffle the deck
 * 
 *  @param start
 *      Start the game
 */

app.table = {
    join: function(table, seatid, user, response, res) {
        console.log('join');
        // TODO: Make it impossible to join a table if insufficent chips available
        if (app.user.isSeated(table, seatid, user)) {
            response.response = "Player is already seated at this table";
            return res.send(response);
        }

        var seat = table.seats[seatid];

        seat.player = user.username;
        table.markModified('seats');
        table.save();

        response = {
            response: user.username + ' has sat down in seat ' + seatid,
            success: true
        };

        return res.send(response);
    },

    leave: function(table, seatid, user, response, res) {
        console.log('leave');
        if (!app.user.isSeatPlayer(table, seatid, user)) {
            response.response = "Player does not match seat player";
            return res.send(response);
        }

        var seat = table.seats[seatid];

        seat.player = null;
        table.markModified('seats');
        table.save();

        response = {
            response: user.username + ' has left seat ' + seatid,
            success: true
        };

        return res.send(response);
    },

    shuffle: function(table, seatid, user, response, res) {
        console.log('shuffle');
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
        var filledSeats = app.helper.filledSeats(table);

        if (filledSeats.length > 0) {
            table.status = "Started";

            // Get buyin
            for (var i = 0; i < filledSeats.length; i++) {
                var seat = table.seats[filledSeats[i]];

                app.user.getBuyin(table, seat);

                if (seat.chips !== table.buyin) {
                    seat.chips = table.buyin;
                }

                seat.bet = 0;
            }

            table.markModified('seats');
            table.save();

            app.game.setDealer(table);
            app.game.deal(table, user, response, res);
        }

        else {
            response.response = "No seats filled";
        }

        
        return res.send(response);
    }
};

/**
 * Game methods (Handles when a game has already started and what methods might be associated with that)
 * 
 * @namespace game
 * 
 * @param resetDeck
 *      Get a new deck (regenerate all 52 cards)
 * 
 *  @param resetHand
 *      PER HAND: Reset player hand cards.
 * 
 *  @param resetTable
 *      PER HAND: Reset table cards (flop, turn, river).
 * 
 *  @param setDealer
 *      PER HAND: Set the dealer
 * 
 *  @param setBlinds
 *      PER HAND: set blinds
 * 
 *  @param deal
 *      PER HAND: deal cards
 * 
 *  @param flop
 *      PER HAND: get flop cards
 * 
 *  @param turn
 *      PER HAND: get turn card
 * 
 *  @param river
 *      PER HAND: get river card
 * 
 *  @param kick
 *      Kick a player
 * 
 *  @param winner
 *      PER HAND: Find winner
 * 
 *  @param sendTableData
 *      Populate table variable to be sent to the frontend
 * 
 *  @param sendPlayerData
 *      Populate player variable to be sent to the frontend
 */

app.game = {
    resetDeck: function(table) {
        console.log('resetdeck');

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
        // TODO: rename.. turning more into a "resetPlayer".

        for (var i = 0; i < table.seats.length; i++) {
            table.seats[i].active = false;
            table.seats[i].hand = [];
            table.seats[i].bet = 0;
            table.seats[i].last = null;
        }

        table.markModified('seats');
        table.save();
    },

    resetTable: function(table) {
        console.log('resettable');

        table.flop = [];
        table.turn = [];
        table.river = [];
        table.save();
    },

    setDealer: function(table) {
        console.log('setdealer');

        var filledSeats = app.helper.filledSeats(table);
        // TODO: Turn floor into round
        var dealer = Math.floor(Math.random() * filledSeats.length);

        for (var i = 0; i < table.seats.length; i++) {
            table.seats[i].dealer = false;
        }

        table.seats[filledSeats[dealer]].dealer = true;

        table.markModified('seats');
        table.markModified('deck');
        table.save();
    },

    setBlinds: function(table) {                                                                 
        for (var i = 0; i < table.seats.length; i++) {
            var seat = table.seats[i];

            if (typeof seat.player === "string") {
                var config;

                if (seat.position === 1) {
                    config = {
                        chips: table.sblind,
                        pot: false,
                        blind: true
                    }
                }

                if (seat.position === 2) {     
                    config = {
                        chips: table.bblind,
                        pot: false,
                        blind: true
                    }

                    var nextSeat = app.seat.nextSeat(table, seat);
                    app.game.setActiveSeat(table, nextSeat);
                }

                if(seat.position === 1 | seat.position === 2){
                    app.seat.bet(table, seat, config);
                }
            }
        }
    },

    setActiveSeat: function(table, seat){
        var filledSeats = app.helper.filledSeats(table);
        
        seat.active = true;

        table.markModified('active');
        table.save();
    },

    deal: function(table, user, response, res) {
        console.log('deal');

        var filledSeats = app.helper.filledSeats(table);
        app.game.resetDeck(table);
        app.game.resetHand(table);
        app.game.resetTable(table);
        app.seat.setPosition(table);
        app.game.setBlinds(table); 

        // Hands
        for (var i = 0; i < filledSeats.length; i++) {
            var seat = filledSeats[i];
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
        // var winner = Solver.Hand.winners([hand1, hand2]); // hand2
    },

    sendTableData: function(table, response) {
        var seats = [];

        for (var i = 0; i < table.seats.length; i++) {
            var seat = {
                player: table.seats[i].player,
                dealer: table.seats[i].dealer,
                chips: table.seats[i].chips,
                position: table.seats[i].position,
                active: table.seats[i].active,
                bet: table.seats[i].bet
            }

            seats.push(seat);
        }

        var table = {
            id: table._id,
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

        else {
            response.user = user.username;
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
        var active = table.seats[seatid].active;
        var player = table.seats[seatid].player;
        var solvedhand = [];

        if(hand.length > 0){
            for(var i = 0; i < hand.length; i++){
                var card = hand[i].value + hand[i].suit.toLowerCase();
                solvedhand.push(card);
            }
        }

        if(table.flop.length > 0){
            for(var i = 0; i < table.flop.length; i++){
                var card = table.flop[i].value + table.flop[i].suit.toLowerCase();
                solvedhand.push(card);
            }
        }
        
        if(table.turn.length > 0){
            var card = table.turn[0].value + table.turn[0].suit.toLowerCase();
            solvedhand.push(card);
        }

        if(table.river.length > 0){
            var card = table.river[0].value + table.river[0].suit.toLowerCase();
            solvedhand.push(card);
        }

        if(solvedhand.length > 0){
            solvedhand = Solver.Hand.solve(solvedhand).descr;
        }

        if (user.username === player) { 
            response.player = {
                hand: hand,
                solved: solvedhand,
                seatid: seatid,
                active: active
            };
        }

        response.response = "Data fetched";
    }
};

/**
 * Seat methods (Player actions of a seated user)
 * 
 * @namespace seat
 * 
 * @param call
 *      Match the current bet
 * 
 *  @param fold
 *      Fold hand
 * 
 *  @param allin
 *      Push all of the seat chips into the pot
 * 
 *  @param check
 *      Check the current bet
 * 
 *  @param bet
 *      Raise the bet by a specific amount
 * 
 *  @param toPot
 *      Send chips to pot
 * 
 *  @param takePot
 *      Take the pot chips (from winning hand, usually)
 * 
 *  @param setPosition
 *      Set position in relation to the dealer
 */

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

    bet: function(table, seat, config) {
        var chips = config.chips;
        var blind = config.blind;
        var pot   = config.pot;

        if(!seat.active && !blind){
            return console.log("User is not active");
        }

        if (seat.chips > chips) {
            seat.chips = seat.chips - chips;
            
            if(pot){
                table.pot = table.pot + chips;      
            }

            else {
                seat.bet = parseInt(seat.bet, 10) + parseInt(chips, 10);
            }

        } else {
            console.log("Seat does not have enough chips available for this transaction");
            // @TODO: Kick player from table or something?
        }

        if(!blind){
            var nextSeat = app.seat.nextSeat(table, seat);
            seat.active = false;
            app.game.setActiveSeat(table, nextSeat);
        }

        table.markModified('seats');
        table.markModified('pot');
        table.save();
    },

    takePot: function(table, seat) {
        console.log('take pot');
        seat.chips = seat.chips + table.pot;
        table.pot = 0;

        table.markModified('seats');
        table.markModified('pot');
        table.save();
    },

    highestBet: function(table){
        var highest = 0;

        for(var i = 0; i < table.seats.length; i++){
            var seat = table.seats[i];

            if(seat.bet > highest){
                highest = seat.bet;
            }
        }

        return highest;
    },

    playerAction: function(table, response, res, seatid, chips, action){
        var seat = table.seats[seatid];
        var highestBet = app.seat.highestBet(table);
        var allowedActions = [];

        if(seat.last !== null){
            if(highestBet > seat.bet){
                allowedActions = ["bet", "fold"];
            }

            else if(highestBet === seat.bet) {
                // TODO: End round
            }
        }

        else {
            if(highestBet > seat.bet){
                allowedActions = ["bet", "fold"];
            }

            else if(highestBet === seat.bet) {
                allowedActions = ["bet", "fold", "check"];
            }
        }

        console.log("highest bet", highestBet);
        console.log("allowedActions",  allowedActions);
        console.log(seat.last !== null);
        console.log(highestBet > seat.bet);
        console.log(highestBet === seat.bet);


        if(allowedActions.indexOf(action) !== -1){
            seat.last = action;

            if(action === "bet"){
                config = { chips: chips, pot: false, blind: false };
                app.seat.bet(table, seat, config);
            }

            table.markModified('seats');
            table.save();
        }

        else {
            console.log("Unable to perform action");
        }
    },

    setPosition: function(table) {
        console.log('set position');
        var counter = 0;

        for (var i = 0; i < table.seats.length; i++) {
            var seat = table.seats[i];

            // Allowed position for the dealer button
            var allowedPositions = [0, 2];

            if (typeof seat.player === "string") {
                if (seat.dealer === true) {

                    // If this is not an allowed position for the dealer, end loop here.
                    if (allowedPositions.indexOf(counter) === -1) {
                        return;
                    }

                    seat.position = counter;
                    counter++;

                    // If the dealer has been set to position 2, this means there's less than 3 players. End loop here.
                    if (seat.position === 2) {
                        return;
                    }
                } else {
                    // If not dealer, and not position 1 (reserved for dealer only), then set position of seat.
                    if (counter > 0) {
                        seat.position = counter;
                        counter++;
                    }
                }
            }

            // Reset loop if we haven't finished
            if (i === table.seats.length - 1) {
                i = -1;
            }
        }

        table.markModified('seats');
        table.save();
    },

    nextSeat: function(table, seat){
        var filledSeats = app.helper.filledSeats(table);

        for(var i = 0; i < filledSeats.length; i++){
            var filledseat = filledSeats[i];
            if(seat.index == filledseat){
                if(typeof filledSeats[i+1] !== "undefined"){
                    return table.seats[filledSeats[i+1]];
                }

                else {
                    return table.seats[filledSeats[0]];
                }
            }
        }
    }
};

/**
 * Card methods
 * 
 * @namespace card
 * 
 * @param random
 *      Take a random card from the deck, remove it from the deck, and return an array of the cards taken.
 */

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
    var chips = req.params['chips'];
    var seatid = req.params['seatid'];
    var user = req.user;
    var query = { "_id": id };
    var response = { response: "An unknown error has occurred", success: false };

    if (!app.user.isLoggedIn(req, res)) {
        response.redirect = '/user/login';
        return res.send(response);
    }

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

        if (action === "bet") {
            return app.seat.playerAction(table, response, res, seatid, chips, action);
        }

        // if (action === "winner") {
        //     return app.game.rankPokerHand(table, response, res);
        // }


        return res.send(response);
    });
};