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
    validBuyin: false,
    response  : { response: "An unknown error has occurred", success: false },
    action    : "undefined",
    id        : "undefined",
    chips     : "undefined",
    seatid    : "undefined",
    user      : "undefined"
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
            app.config.response.response = err;
            return true;
        }

        if (!table || !table.deck || !table.deck.cards) {
            if (!table) {
                app.config.response.response = "Table not found";
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
    isLoggedIn: function(req) {
        if (typeof req.user === "undefined") {
            return false;
        }

        return true;
    },

    isSeated: function(table) {
        var seat = table.seats[app.config.seatid];

        for (var i = 0; i < table.seats.length; i++) {
            var singleseat = table.seats[i];
            if (singleseat.player === app.config.user.username) {
                return true;
            }
        }

        return false;
    },

    isSeatPlayer: function(table) {
        var seat = table.seats[app.config.seatid];

        if (seat.player !== app.config.user.username) {
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
    join: function(table) {
        // TODO: Make it impossible to join a table if insufficent chips available
        if (app.user.isSeated(table)) {
            app.config.response.response = "Player is already seated at this table";
        }

        var seat = table.seats[app.config.seatid];

        seat.player = app.config.user.username;
        table.markModified('seats');
        table.save();

        app.config.response.response = app.config.user.username + ' has sat down in seat ' + app.config.seatid;
        app.config.response.success = true;
    },

    leave: function(table) {
        if (!app.user.isSeatPlayer(table)) {
            app.config.response.response = "Player does not match seat player";
        }

        var seat = table.seats[app.config.seatid];

        seat.player = null;
        table.markModified('seats');
        table.save();

        app.config.response.response = app.config.user.username + ' has left seat ' + app.config.seatid;
        app.config.response.success = true;
    },

    shuffle: function(table) {
        table.deck.cards = app.helper.shuffleArray(table.deck.cards);

        table.markModified('deck');
        table.save();

        app.config.response.response ="Deck shuffled";
        app.config.response.success = true;
    },

    start: function(table) {
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
            app.game.deal(table);
        }

        else {
            app.config.response.response ="No seats filled";
        }
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
        table.flop = [];
        table.turn = [];
        table.river = [];
        table.round = 0;
        table.save();
    },

    setDealer: function(table) {
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
            var nextSeat = app.seat.nextSeat(table, seat);

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

    setRound: function(table){
        var action = [
            null,
            "flop",
            "turn",
            "river"
        ]

        if(table.round < 3){
            table.round = table.round + 1;
            table.save();

            switch(action[table.round]){
                case "flop":
                    app.game.flop(table);
                    break;
                
                case "turn":
                    app.game.turn(table);
                    break;

                case "river":
                    app.game.river(table);
                    break;
            }
        }

        else {
            table.round = 0;
            table.save();
            app.game.winner(table);
            // Show cards
            // Move dealer button 1 up
            // Start next round
        } 
    },

    endRound: function(table, seat){
        var highestBet = app.seat.highestBet(table);
        var playersInHand = app.seat.playersInHand(table);

        app.seat.betsToPot(table);
        
        // Check if there's at least 2 players still in the hand
        if(playersInHand < 2){
            app.game.setRound(table);
        }

        else {
            // Give pot to last player in hand
        }
    },

    deal: function(table) {
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

        app.game.sendTableData(table);
        app.game.sendPlayerData(table);
    },

    flop: function(table) {
        // Check if flop is already defined
        if (table.flop.length > 0) {
            app.config.response.response = "Flop fetched";
            app.config.response.success = true;
            app.config.response.flop = table.flop;
        }

        var cards = app.card.random(table, 3);
        var cardArr = [];

        for (var j = 0; j < cards.length; j++) {
            var cardObj = { value: cards[j].value, suit: cards[j].suit };
            cardArr.push(cardObj);
        }

        table.flop = cardArr;
        table.save();

        app.config.response.response = "Cards fetched";
        app.config.response.success = true;
        app.config.response.flop = cardArr;
    },

    turn: function(table) {
        // Check if turn is already defined
        if (table.turn.length > 0) {
            app.config.response.response = "Turn fetched";
            app.config.response.success = true;
            app.config.response.flop = table.turn;
        }

        var cards = app.card.random(table, 1);
        var cardArr = [];

        for (var j = 0; j < cards.length; j++) {
            var cardObj = { value: cards[j].value, suit: cards[j].suit };
            cardArr.push(cardObj);
        }

        table.turn = cardArr;
        table.save();

        app.config.response.response = "Turn fetched";
        app.config.response.success = true;
        app.config.response.flop = cardArr;
    },

    river: function(table) {
        // Check if river is already defined
        if (table.river.length > 0) {
            app.config.response.response = "River fetched";
            app.config.response.success = true;
            app.config.response.flop = table.river;
        }

        var cards = app.card.random(table, 1);
        var cardArr = [];

        for (var j = 0; j < cards.length; j++) {
            var cardObj = { value: cards[j].value, suit: cards[j].suit };
            cardArr.push(cardObj);
        }

        table.river = cardArr;
        table.save();

        app.config.response.response = "River fetched";
        app.config.response.success = true;
        app.config.response.flop = cardArr;
    },

    kick: function() {
        // @TODO: kick player
    },

    winner: function(table) {
        var filledSeats = app.helper.filledSeats(table);
        var hands = [];
        var tableCards = [];

        // Get flop cards
        if(table.flop.length > 0){
            for(var i = 0; i < table.flop.length; i++){
                var card = table.flop[i].value + table.flop[i].suit.toLowerCase();
                tableCards.push(card);
            }
        }
        
        // Get turn card
        if(table.turn.length > 0){
            var card = table.turn[0].value + table.turn[0].suit.toLowerCase();
            tableCards.push(card);
        }

        // Get river card
        if(table.river.length > 0){
            var card = table.river[0].value + table.river[0].suit.toLowerCase();
            tableCards.push(card);
        }

        // Get player cards
        for(var i = 0; i < filledSeats.length; i++){
            var seat = table.seats[filledSeats[i]];

            // Create instance of table cards in hand.
            var hand = tableCards;

            for(var j = 0; seat.hand.length; j++){
                var card = seat.hand[j].value; seat.hand[j].suit.toLowerCase();
                hand.push(card);
            }

            // Push to hands
            hands.push(hand);
        }

        var winner = Solver.Hand.winners(hands);
    },

    sendTableData: function(table) {
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

        app.config.response.table = table;
    },

    sendPlayerData: function(table) {
        var seatid;

        if (!app.config.user) {
            app.config.response.player = 'No matching player found on table';
            return;
        }

        else {
            app.config.response.user = app.config.user.username;
        }

        for (var i = 0; i < table.seats.length; i++) {
            var seat = table.seats[i];
            if (seat.player === app.config.user.username) {
                seatid = i;
            }
        }

        var hand = table.seats[seatid].hand;
        var active = table.seats[seatid].active;
        var player = table.seats[seatid].player;
        var solvedhand = [];

        if (typeof seatid === "undefined") {
            app.config.response.player = 'Player is not seated at the table';
            return;
        }        

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

        if (app.config.user.username === player) { 
            app.config.response.player = {
                hand: hand,
                solved: solvedhand,
                seatid: seatid,
                active: active
            };
        }

        app.config.response.response = "Data fetched";
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
        var nextSeat = app.seat.nextSeat(table, seat);
        var highestBet = app.seat.highestBet(table);

        if(!seat.active && !blind){
            app.config.response.response = "User is not active";
            return;
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
            if(nextSeat.last !== null){
                if(highestBet === nextSeat.bet){
                    app.game.endRound(table, nextSeat);
                }
            }

            else {
                seat.active = false;
                app.game.setActiveSeat(table, nextSeat);
            }
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

    betsToPot: function(table){
        var filledSeats = app.helper.filledSeats(table);

        for(var i = 0; i < filledSeats.length; i++){
            var seat = table.seats[filledSeats[i]];

            table.pot = table.pot + seat.bet;

            seat.bet = 0;
        }

        table.markModified('seats');
        table.markModified('pot');
        table.save();
    },

    playersInHand: function(table){
        var filledSeats = app.helper.filledSeats(table);
        var playersInHand = 0;

        for(var i = 0; i < filledSeats.length; i++){
            var seat = table.seats[filledSeats[i]];

            if(seat.inhand){
                playersinHand += 1;
            }
        }

        return playersInHand;
    },

    playerAction: function(table){
        var seat = table.seats[app.config.seatid];
        var highestBet = app.seat.highestBet(table);
        var allowedActions = ["fold"];
        

        if(highestBet === seat.bet) {
            allowedActions = ["bet", "fold", "check"];
        }

        else if(highestBet > seat.bet){
            allowedActions = ["bet", "fold"];
        }

        if(allowedActions.indexOf(app.config.action) !== -1){
            seat.last = app.config.action;

            if(app.config.action === "bet"){
                config = { chips: app.config.chips, pot: false, blind: false };
                app.seat.bet(table, seat, config);
            }

            if(app.config.action === "fold"){
                seat.inhand = false;
            }

            if(app.config.action === "check" || app.config.action === "fold"){
                seat.active = false;
                var nextSeat = app.seat.nextSeat(table, seat);
                app.game.setActiveSeat(table, nextSeat);
            }

            table.markModified('seats');
            table.save();
        }

        else {
            app.config.response.response = "Unable to perform action";
        }
    },

    setPosition: function(table) {
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
    app.config.response.response = "Failed to open table";
    app.config.response.success = false;

    Table.findOne(query, function(err, table) {
        if (app.state.isError(err, table)) {
            app.config.response.err = err;
            return res.send(app.config.response);
        }

        res.render('table/table', { "table": table, "seats": table.seats });
    });
};

exports.action = function(req, res) {
    app.config.action   = req.params['action'];
    app.config.id       = req.params['id'];
    app.config.chips    = req.params['chips'];
    app.config.seatid   = req.params['seatid'];
    app.config.user     = req.user;

    var query = { "_id": app.config.id };

    if (!app.user.isLoggedIn(req)) {
        app.config.response.response = "User is not logged in";
        return res.send(app.config.response);
    }

    Table.findOne(query, function(err, table) {
        if (app.state.isError(err, table)) {
            
            return console.log(err);
        }
        if (app.config.action === "join") {
            app.table.join(table);
            return res.send(app.config.response);
        }

        if (app.config.action === "leave") {
            app.table.leave(table);
            return res.send(app.config.response);
        }

        if (app.config.action === "start") {
            app.table.start(table);
            return res.send(app.config.response);
        }

        if (app.config.action === "refresh") {
            app.game.sendTableData(table);
            app.game.sendPlayerData(table);
            return res.send(app.config.response);
        }

        if (app.config.action === "bet" || app.config.action === "fold" || app.config.action === "check") {
            app.seat.playerAction(table);
            return res.send(app.config.response);
        }

        return res.send(app.config.response);
    });
};