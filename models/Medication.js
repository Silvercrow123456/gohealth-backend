const mongoose = require('mongoose');
const medSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  type: String, name: String, dose: String, freq: String,
  time: String, enableRemind: Boolean, leadMinutes: Number
});
module.exports = mongoose.model('Medication', medSchema);