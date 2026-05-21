const mongoose = require('mongoose');

const ttmSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  scores: [Number],       // 記錄各題分數 [1, 3, 5, 4, 5, 2]
  totalScore: Number,     // 總分
  stage: String,          // TTM 階段
  group: String           // 後台專用分組：A, B, or C (不回傳給病患)
}, { timestamps: true });

module.exports = mongoose.model('Ttm', ttmSchema);