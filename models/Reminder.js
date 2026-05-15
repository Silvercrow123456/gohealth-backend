const mongoose = require('mongoose');
const reminderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  tPreMeal: String, tPostMeal: String, tBedtime: String, nextAppt: String
});
module.exports = mongoose.model('Reminder', reminderSchema);