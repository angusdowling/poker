/* Import node_modules */
var express = require('express');
var passport = require('passport');
var mongoose = require('mongoose');

var Account = require('../models/account');
var Table = require('../models/table');
var Seat = require('../models/seat');
var Deck = require('../models/deck');
var Card = require('../models/card');

/** 
 * New Table
 */
exports.newTableForm = function(req, res) {
    res.render('table/new', { title: 'Add Table' });
};

exports.newTable = function(req, res) {
    // Build table
    var newtable = new Table({
        name: req.body.name,
        seats: [],
        type: {},
        buyin: req.body.buyin,
        sblind: req.body.sblind,
        bblind: req.body.bblind,
        pot: 0,
        status: 'Open',
        deck: {}
    });


    // Add Some Seats
    var seats = [];

    for (var i = 0; i < req.body.seats; i++) {
        var seat = new Seat({
            player: null,
            active: false,
            dealer: false,
            actions: ["call", "fold", "allin", "check", "bet", "join", "exit"]
        });

        seats.push(seat);
    }

    newtable.seats = seats;

    // Create deck
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

    newtable.deck = deck;

    // Save the table
    newtable.save(function(err, newtable) {
        if (err) {
            return console.log(err);
        }

        res.redirect('/lobby');
    });
};