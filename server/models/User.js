const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  bio: { type: String, default: '', trim: true, maxlength: 240 },
  picture: String,
  overlayEffect: { type: String, default: 'none', trim: true, lowercase: true },
  avatarEffect: { type: String, default: 'none', trim: true, lowercase: true },
  googleId: { type: String, required: true, unique: true },
  // Flexible object for evolving spaced-repetition analytics schema (v2+).
  stats: { type: Object, default: {} },
  // Persisted Pomodoro state backup for authenticated users.
  pomodoroState: { type: Object, default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
