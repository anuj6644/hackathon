// models/Match.js
const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  startup: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  incubator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  compatibilityScore: Number,
  lastContacted: Date
}, { timestamps: true });

module.exports = mongoose.model('Match', matchSchema);

