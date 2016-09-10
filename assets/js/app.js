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
    app.listeners();
};

app.seat = {};
app.seat.post = function(obj) {
    var url = obj.attr('href');
    var seat = obj.closest('.seat');

    $.ajax({
        method: "POST",
        url: url,
        datatype: "json",
    }).success(function(data) {
        if (typeof data.redirect === "string") {
            window.location.replace(window.location.protocol + "//" + window.location.host + data.redirect);
        }

        if (typeof data.response === "string") {
            console.log(data.response);
        }

        if (data.success) {
            seat.toggleClass('seated');
        }
    });
};

app.table = {};
app.table.post = function(obj) {
    var url = obj.attr('href');

    $.ajax({
        method: "POST",
        url: url,
        datatype: "json",
    }).success(function(data) {
        if (typeof data.response === "string") {
            console.log(data.response);
        }
    });
}

app.listeners = function() {
    $(app.config.buttons.seat.post).on('click', function(e) {
        app.seat.post($(this));
        e.preventDefault();
    });

    $(app.config.buttons.table.post).on('click', function(e) {
        app.table.post($(this));
        e.preventDefault();
    });
};

$(document).ready(function() {
    app.init();
});