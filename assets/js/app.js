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

var app = app || {};

app.config = {
    table: null,
    player: null,
    user: null,
    buttons: {
        seat: {
            post: '.seat .state',
            bet: '.bet',
            fold: '.fold',
            check: '.check'
        },

        table: {
            post: '.table-actions a'
        }
    }
}

app.init = function() {
    app.table.getData(null, "refresh/");
    app.listeners();
};

app.listeners = function() {
    $(app.config.buttons.seat.post).on('click', function(e) {
        app.seat.getData($(this));
        e.preventDefault();
    });

    $(app.config.buttons.table.post).on('click', function(e) {
        app.table.getData($(this));
        e.preventDefault();
    });

    $(app.config.buttons.seat.check).on('click', function(e) {
        if(app.config.player !== null){
            app.table.getData(false, "check/" + app.config.player.seatid);
        }

        return false;
    });

    $(app.config.buttons.seat.fold).on('click', function(e) {
        if(app.config.player !== null){
            app.table.getData(false, "fold/" + app.config.player.seatid);
        }
        
        return false;
    });

    $('#bet-form').on('submit', function(e){
        var bet = parseInt($('#amount').val(), 10);

        if(app.config.player !== null){
            app.table.getData(false, "bet/" + app.config.player.seatid + "/" + bet);
        }

        return false;
    });
};

/**
 * Seat methods
 * 
 * @namespace seat
 * 
 * @param getData
 *      Ajax post to fetch data related to the seat. (handles sitting down, leaving seat)
 * @param action
 *      ONLOAD: Show the appropriate seating action (leave / join)
 * @param toggleState
 *      On AJAX request: toggle state of seat (if user is seated or not, show relevant data)
 */

app.seat = {
    getData: function(obj) {
        var url = obj.attr('href');
        var seat = obj.closest('.seat');

        $.ajax({
            method: "POST",
            url: url,
            datatype: "json",
        }).success(function(data) {
            // Redirect if a redirect is assigned
            if (typeof data.redirect === "string") {
                return window.location.replace(window.location.protocol + "//" + window.location.host + data.redirect);
            }

            // Rework how this gets toggled
            if (data.success) {
                seat.toggleClass('seated');
            }
        });
    },

    action: function() {
        var table = app.config.table;
        
        for(var i = 0; i < table.seats.length; i++){
            if(app.config.user == null){
                return;
            }

            if(typeof app.config.player.seatid !== "undefined"){
                return;
            }

            var seat = table.seats[i];
            var leave = "leave/" + i;
            var join = "join/" + i;
            var state = $('.seat .player-actions .state').eq(i);

            if(seat.player == null){
                state.attr('href', join);
                state.html('Join');
            }
        }
    },

    setActive: function(){
        var seatList = app.config.table.seats;
        var seats = $('.seat');
        for(var i = 0; i < seatList.length; i++){
            var seat = seatList[i];
            
            if(seat.active){
                seats.eq(i).addClass('active');
            }
        }
    },

    toggleState: function() {
        
    }
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
    showHand: function(hand, seatid) {
        var cards = "";

        for (var i = 0; i < hand.length; i++) {
            cards += "<img class='card' src='/images/table/cards/"+ hand[i].suit + hand[i].value + ".png' alt="+ hand[i].suit + hand[i].value + ">" ;

        }

        $('.seat').eq(seatid).find('.player-hand').html(cards);
    }
}

/**
 * Table methods
 * 
 * @namespace table
 * 
 * @param getCards
 *      Turns the cards fetched from a JSON object into printable string to be inserted into the page
 * @param callback
 *      Function called after successful AJAX request
 * @param getData
 *      Fetch current table state when the page gets loaded (player hands, table cards, whos seated etc)
 * 
 */

app.table = {
    getCards: function(table) {
        var cards = [table.flop, table.turn, table.river];

        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];

            if (typeof card !== "undefined") {
                if (card.length > 0) {
                    var str = "";

                    for (var j = 0; j < card.length; j++) {
                        str += "<img class='card' src='/images/table/cards/"+ card[j].suit + card[j].value + ".png' alt="+ card[j].suit + card[j].value + ">";
                    }

                    $('.table .table-cards').append(str);
                }
            }
        }
    },

    callback: function(data){
        // Redirect if a redirect is assigned
        // if (typeof data.redirect === "string") {
        //     return window.location.replace(window.location.protocol + "//" + window.location.host + data.redirect);
        // }

        // Do stuff for player
        if (typeof data.player !== "undefined") {
            app.config.player = data.player;

            if (typeof data.player.hand !== "undefined") {
                app.player.showHand(data.player.hand, data.player.seatid);
            }
        }

        if(typeof data.user !== "undefined"){
            app.config.user = data.user;
        }

        // Do stuff for table
        if (typeof data.table !== "undefined") {
            app.config.table = data.table;
            app.table.getCards(data.table);
            app.seat.action();
            app.seat.setActive();
        }

        console.log(data);
    },

    getData: function(obj, url) {
        if (obj) {
            var url = obj.attr('href');
        }

        console.log(url);

        $.ajax({
            method: "POST",
            url: url,
            datatype: "json",
        }).success(function(data) {        
            app.table.callback(data);
        }).error(function(err){
            console.log(err);
        })
    }
};


$(document).ready(function() {
    app.init();
});