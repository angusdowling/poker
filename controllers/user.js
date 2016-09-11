/* Import node_modules */
var express = require('express');
var passport = require('passport');
var mongoose = require('mongoose');

var Account = require('../models/account');

/** 
 * Index
 */
exports.registerForm = function(req, res) {
    res.render('user/register', {});
};

exports.register = function(req, res) {
    // @TODO: Change chips down to 0 after testing
    Account.register(new Account({ username: req.body.username, chips: 99999, banned: false, apikey: req.body.apikey, groups: [] }), req.body.password, function(err, account) {
        if (err) {
            return res.render('register', { account: account });
        }

        passport.authenticate('local')(req, res, function() {
            res.redirect('/lobby');
        });
    });
};

exports.loginForm = function(req, res) {
    res.render('user/login', { user: req.user });
};

exports.login = function(req, res) {
    res.redirect('/lobby');
};

exports.logout = function(req, res) {
    req.logout();
    res.redirect('/lobby');
};