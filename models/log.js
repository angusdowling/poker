var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Log = new Schema({
    table: Object,
    user: Object,
    hand: Object,
    content: String,
    date: Date
}, { strict: false });

module.exports = mongoose.model('Log', Log);