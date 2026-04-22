const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:  { type: String, default: 'Untitled Note', trim: true },
  body:   { type: String, default: '' },
  category: { type: String, default: 'General', trim: true },
  pinned: { type: Boolean, default: false },
  color:  { type: String, default: 'violet', enum: ['violet', 'blue', 'green', 'amber', 'rose', 'cyan'] },
}, { timestamps: true });

// Supports the primary read path used by the notes list endpoint.
noteSchema.index({ userId: 1, pinned: -1, updatedAt: -1 });

module.exports = mongoose.model('Note', noteSchema);
