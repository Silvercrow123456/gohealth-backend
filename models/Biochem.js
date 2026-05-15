const mongoose = require('mongoose');
const biochemSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  sex: String, height: Number, weight: Number, waist: Number, hip: Number,
  creatinine: Number, BUN: Number, urineProtein: String, ast: Number, alt: Number,
  hba1c: Number, tc: Number, tg: Number, hdl: Number, ldl: Number
}, { timestamps: true });
module.exports = mongoose.model('Biochem', biochemSchema);