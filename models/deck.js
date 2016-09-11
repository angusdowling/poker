var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Deck = new Schema({
    cards: Array
}, { strict: false });

module.exports = mongoose.model('Deck', Deck);