var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Table = new Schema({
    name: String,
    seats: Array,
    type: Object,
    buyin: Number,
    sblind: Number,
    bblind: Number,
    pot: Number,
    status: String,
    deck: Object
});

module.exports = mongoose.model('Table', Table);