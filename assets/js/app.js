/**
 * Application for Space Poker
 * 
 * @namespace app
 * 
 * @param config
 *      Configuration variables
 * @param init
 *      Initialize the application
 * @param listeners
 *      Event listeners
 * 
 */

var socket = io();

var app = app || {};

app.config = {
    table: {},
    player: {},
    user: {},
    buttons: {
        seat: {
            post: '.seat .state',
            bet: '#bet-form',
            fold: '.fold',
            check: '.check'
        },

        table: {
            post: '.table-actions .start'
        }
    }
}

app.init = function() {
    app.table.refresh();
    app.listeners();
};

app.listeners = function() {
    var button = app.config.buttons;

    $(button.table.post).on('click', function(e){
        var action = $(this).attr('action');
        app.table.update(action);
    });

    $(button.seat.post).on('click', function(e){
        var url    = $(this).attr('action').split("/")
        var action = url[0];
        var config = {};
            config.seatid = url[1];

        app.table.update(action, config);

        return false;
    });

    $(button.seat.check).on('click', function(e) {
        app.table.update('check');

        return false;
    });

    $(button.seat.fold).on('click', function(e) {
        app.table.update('fold');
        
        return false;
    });

    $(button.seat.bet).on('submit', function(e){
        var config = {};
            config.bet = parseInt($('#amount').val(), 10);

        app.table.update('bet', config);

        return false;
    });

    socket.on('table refresh', function(req){
        app.table.callback(req);
    });

    socket.on('player refresh', function(req){
        app.player.callback(req); 
    });
};

/**
 * Player methods
 * 
 * @namespace player
 * 
 * @param showHand
 *      Turns JSON object into printable string to be inserted into the page
 * 
 */

app.player = {
    callback: function(req){

        if(typeof req.player === "object"){
            app.config.player = req.player;
        }

        else if(typeof req.player === "string") {
            app.config.player = req;
        }

        else if(typeof req.seats !== "undefined") {
            app.config.player = req.seats;
        }

        else if(typeof req.username === "string"){
            app.config.player = req.username;
        }
        
        if(typeof app.config.player === "object"){
            if ("hand" in app.config.player && "seatid" in app.config.player) {
                app.player.showHand(app.config.player.hand, app.config.player.seatid);
            }
        }
    },

    showHand: function(hand, seatid) {
        var cards = "";

        for (var i = 0; i < hand.length; i++) {
            cards += "<img class='card' src='/images/table/cards/"+ hand[i].suit + hand[i].value + ".png' alt="+ hand[i].suit + hand[i].value + ">" ;

        }

        $('.seat').eq(seatid).find('.player-hand').html(cards);
    }
};

/**
 * Table methods
 * 
 * @namespace table
 * 
 * @param getCards
 *      Turns the cards fetched from a JSON object into printable string to be inserted into the page
 * @param callback
 *      Function called after successful AJAX request
 * @param update
 *      Fetch current table state when the page gets loaded (player hands, table cards, whos seated etc)
 * 
 */

app.table = {
    callback: function(req){
        app.config.table  = (typeof req.table !== "undefined") ? req.table : {};
        app.config.log    = (typeof req.log !== "undefined") ? req.log : "";

        app.game.setCards();
        app.game.seats();
        app.game.setPot();
        app.log.print();
    },

    refresh: function() {
        $.ajax({
            method: "POST",
            url: 'refresh/',
            datatype: "json"
        })

        .success(function(data) {
            app.player.callback(data);
            app.table.callback(data);
        })
        
        .error(function(err){
            // console.log(err);
        });
    },

    update: function(action, config){
        var ident   = $('.table').attr('ident');
        var request = {};
        request.id  = ident;

        if(typeof action !== "undefined"){
            request.action = action;
        }

        if(typeof config !== "undefined"){
            if(typeof config.bet !== "undefined"){
                request.chips  = config.bet;
            }

            if(typeof config.seatid !== "undefined"){
                request.seatid  = config.seatid;
            }
        }

        

        socket.emit('seat action', request);
    }
};

app.game = {
    setDealer: function(seat, actual){
        var seats = $('.seat');
        if(seat.dealer){
            seats.removeClass('dealer');
            actual.addClass('dealer');
        }
    },

    seats: function(){
        var table = app.config.table;

        for(var i = 0; i < table.seats.length; i++){
            var seat = table.seats[i];
            var actual = $('.seat[index="'+i+'"]');

            app.game.setPlayers(seat, actual);
            app.game.sitToggle(seat, actual, i);
            app.game.setChips(seat, actual);
            app.game.setBet(seat, actual);
            app.game.setActive(seat, actual);
            app.game.setDealer(seat, actual);
        }
    },

    setChips: function(seat, actual){
        var chipHolder = actual.find('.chips');
        
        if(seat.chips > 0){
            if(seat.player !== null){
                return chipHolder.html(seat.chips);
            }
        }

        return chipHolder.html(' ');
    },

    setPlayers: function(seat, actual){
        var username = actual.find('.username');

        if(seat.player === null){
            return username.html(" ");
        }

        return username.html(seat.player);
    },

    setBet: function(seat, actual){
        var betHolder = actual.find('.bet');
        
        if(seat.bet > 0){
            if(seat.player !== null){
                return betHolder.html(seat.bet);
            }
        }

        return betHolder.html(' ');
    },

    setCards: function() {
        var tableBoard   =  $('.table .table-cards');
        var cardsOnTable = tableBoard.find('.card').length;
        var table        = app.config.table;
        var cardsToShow  = [table.flop, table.turn, table.river];
        var cardList     = "";

        for (var i = 0; i < cardsToShow.length; i++) {
            var card = cardsToShow[i];
            var str = "";

            if (
                typeof card === "undefined" ||
                card.length < 0
            ) {
                continue;
            }

            for (var j = 0; j < card.length; j++) {
                str += "<img class='card' src='/images/table/cards/"+ card[j].suit + card[j].value + ".png' alt="+ card[j].suit + card[j].value + ">";
            }

            cardList += str;            
        }

        tableBoard.html(cardList);
    },

    setPot: function(){
        var pot = $('.table-pot');

        if(app.config.table.pot > 0){
            pot.html("POT: <strong>"+app.config.table.pot+"</strong>");
        }

        else {
            pot.html(" ");
        }
    },

    setCardBacks: function(){
        // @OTOD: set card backs for other players
    },

    resetTable: function(){
        // Reset table state
    },

    setActive: function(seat, actual){
        var seats = $('.seat');

        if(seat.active){
            seats.removeClass('active');
            actual.addClass('active');
        }
    },

    sitToggle: function(seat, actual, index) {
        var leave = "leave/" + index;
        var join  = "join/" + index;
        var state = actual.find('.state'); 
        var chips = actual.find('.chips');

        // If user isn't logged in, don't show seats
        if(app.config.player == null){
            return;
        }

        if(typeof app.config.player.seatid === "undefined"){
            if(seat.player == null){
                state.attr('action', join);
                state.html('Join');
            }
        }

        else {
            if(seat.player === app.config.player.username){
                state.attr('action', leave);
                state.html('Leave');
            } else {
                state.html("");
            }
        }  
    }
};

app.log = {
    print: function(){
        var content = $('.table-history .table-history--content');

        if(app.config.log !== ""){
            content.append('<p>' + app.config.log + '</p>');
        }
    }
}


$(document).ready(function() {
    app.init();
});