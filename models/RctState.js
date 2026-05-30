const mongoose = require('mongoose');

const rctStateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // 例如: 'block_4'
  sequence: { type: [String], default: [] }            // 存放抽出來的陣列，例如 ['control', 'experimental', ...]
});

module.exports = mongoose.model('RctState', rctStateSchema);