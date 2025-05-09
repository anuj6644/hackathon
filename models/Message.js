// models/Message.js

const mongoose = require('mongoose');


const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: String,
  read: { type: Boolean, default: false }
}, { timestamps: true });