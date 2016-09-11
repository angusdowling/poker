var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Card = new Schema({
    value: String,
    suit: String
}, { strict: false });

module.exports = mongoose.model('Card', Card);