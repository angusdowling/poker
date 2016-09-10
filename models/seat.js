var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Seat = new Schema({
    player: Object,
    active: Boolean,
    dealer: Boolean,
    actions: Array
});

module.exports = mongoose.model('Seat', Seat);