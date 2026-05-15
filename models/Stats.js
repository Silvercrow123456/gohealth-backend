const mongoose = require('mongoose');
const statsSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  totalUsedSec: Number,
  eduWatchSec: Number,
  countMsg: Number,
  countGlu: Number
});
module.exports = mongoose.model('Stats', statsSchema);