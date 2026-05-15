const mongoose = require('mongoose');

const glucoseSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true // 為了區分不同使用者，這裡先簡單用 email 或 phone 代表 userId
  },
  value: {
    type: Number,
    required: true
  },
  measuredAt: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String,
    default: ''
  }
}, { timestamps: true }); // 自動產生 createdAt 和 updatedAt

module.exports = mongoose.model('Glucose', glucoseSchema);