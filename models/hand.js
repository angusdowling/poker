var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Hand = new Schema({
}, { strict: false });

module.exports = mongoose.model('Hand', Hand);