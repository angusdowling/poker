var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Table = new Schema({
    name: String,
    seats: Array,
    type: Schema.Types.Mixed,
    buyin: Number,
    sblind: Number,
    bblind: Number,
    pot: Number,
    status: String,
    deck: Schema.Types.Mixed,
    flop: Array,
    turn: Array,
    river: Array
}, { strict: false });

module.exports = mongoose.model('Table', Table);