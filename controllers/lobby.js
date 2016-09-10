/* Import node_modules */
var passport = require('passport');
var mongoose = require('mongoose');

/* Load models */
var Table = require('../models/table');

/** 
 * Index
 */
exports.index = function(req, res, next) {
    // Check if player is logged in
    if (typeof req.user === "undefined") {
        res.redirect('/user/login');
    }

    Table.find(function(err, tables) {
        if (err) {
            return console.error(err);
        }

        if (!tables) {
            return console.log("There are currently no tables");
        }

        res.render('lobby', { tables: tables });
    });
};