const mongoose = require('mongoose');
// 留言板
const msgSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  role: String, message: String, consultTime: String
}, { timestamps: true });
const ConsultMsg = mongoose.model('ConsultMsg', msgSchema);

// 預約設定
const reserveSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  need: Boolean, date: String, slot: String, consultTime: String
});
const Reservation = mongoose.model('Reservation', reserveSchema);

module.exports = { ConsultMsg, Reservation };