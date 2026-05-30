const mongoose = require('mongoose');

const rctGroupSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    unique: true // 確保一個病患只會被分組一次
  },
  assignedGroup: { 
    type: String, 
    enum: ['control', 'experimental'], 
    required: true 
  }
}, { timestamps: true });

module.exports = mongoose.model('RctGroup', rctGroupSchema);