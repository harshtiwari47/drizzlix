const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  id: { type: String, required: true },
  front: { type: String, required: true },
  back: { type: String, required: true },
  lastOpened: { type: Date, default: null },
  nextReview: { type: Date, default: null },
  interval: { type: Number, default: 0 },
  repetition: { type: Number, default: 0 },
  easeFactor: { type: Number, default: 2.5 }
});

const deckSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  id: { type: String, required: true }, 
  sourceDeckId: { type: String, default: '' },
  title: { type: String, required: true },
  thumbnail: { type: String, default: '' },
  labels: { type: [String], default: [] },
  cards: [cardSchema],
  isPublic: { type: Boolean, default: false },
  isDiscoverable: { type: Boolean, default: false },
  saves: { type: Number, default: 0 },
  publishedBy: {
    name: { type: String, default: '' },
    username: { type: String, default: '' },
    picture: { type: String, default: '' },
    userId: { type: String, default: '' }
  },
  discoverMetadata: {
    topic: { type: String, default: '' },
    level: { type: String, default: '' },
    language: { type: String, default: '' }
  }
}, { timestamps: true });

module.exports = mongoose.model('Deck', deckSchema);
