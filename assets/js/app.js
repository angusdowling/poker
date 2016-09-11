var app = app || {};

app.config = {
    buttons: {
        seat: {
            post: '.seat .post'
        },

        table: {
            post: '.actions a'
        }
    }
}

app.init = function() {
    app.table.onLoad();
    app.listeners();
};

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

    hideActions: function() {

    }
};

app.player = {
    showHand: function(hand, seatid) {
        var str = "";

        for (var i = 0; i < hand.length; i++) {
            str += hand[i].value + hand[i].suit + " ";
        }

        $('.seat').eq(seatid).find('.player-hand').html(str);
    },

    hideOtherActions: function(seatid) {
        // Other seats
        var seat = $('.seat').not($('.seat').eq(seatid)[0]);
        var actions = seat.find('.actions');

        actions.addClass('hidden');

        // This seat
        $('.seat').eq(seatid).find('.actions .join').addClass('hidden');
    }
}

app.table = {
    onLoad: function() {
        app.table.getData(null, "refresh/");
    },

    getCards: function(table) {
        var cards = [table.flop, table.turn, table.river];

        for(var i = 0; i < cards.length; i++){
            var card = cards[i];

            if(typeof card !== "undefined"){
                if(card.length > 0){
                    var str = "";

                    for (var j = 0; j < card.length; j++) {
                        str += card[j].value + card[j].suit + " ";
                    }

                    $('#main .card-list').append('<li>'+str+'</li>');
                }
            }
        } 
    },

    getData: function(obj, url) {
        if (obj) {
            var url = obj.attr('href');
        }

        $.ajax({
            method: "POST",
            url: url,
            datatype: "json",
        }).success(function(data) {
            console.log(data);

            // Do stuff for player
            if (typeof data.player !== "undefined") {
                if (typeof data.player.hand !== "undefined") {
                    app.player.showHand(data.player.hand, data.player.seatid);
                    app.player.hideOtherActions(data.player.seatid);
                }
            }

            // Do stuff for table
            if (typeof data.table !== "undefined") {
                app.seat.hideActions(data.table);
                app.table.getCards(data.table);
            }
        });
    }
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
};

$(document).ready(function() {
    app.init();
});