var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Seat = new Schema({
    player: Schema.Types.Mixed,
    active: Boolean,
    dealer: Boolean,
    actions: Array,
    hand: Array,
    chips: Number,
    position: Number,
    index: Number,
    bet: Number,
    last: String
}, { strict: false });

module.exports = mongoose.model('Seat', Seat);