const mongoose = require('mongoose');

const medSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  type: String, 
  name: String, 
  dose: String, 
  freq: String,
  time: String, 
  enableRemind: Boolean, 
  leadMinutes: Number,
  
  // 🟢 新增這兩個欄位來記錄星期幾
  cycle: { type: String, default: 'daily' }, // 'daily' 或 'weekly'
  days: { type: [Number], default: [] }      // 記錄星期幾 [0, 1, 2...] (0是星期日，1是星期一)
});

module.exports = mongoose.model('Medication', medSchema);