const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const User = require('./models/User');
const Deck = require('./models/Deck');
const Task = require('./models/Task');
const Note = require('./models/Note');

const app = express();

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
if (process.env.VERCEL === '1' || IS_PRODUCTION) {
  app.set('trust proxy', 1);
}

const coopPolicy = IS_PRODUCTION ? 'same-origin-allow-popups' : 'unsafe-none';

const REQUIRED_AUTH_ENV = ['GOOGLE_CLIENT_ID', 'JWT_SECRET'];
const missingAuthEnv = REQUIRED_AUTH_ENV.filter((key) => !process.env[key]);
if (missingAuthEnv.length > 0) {
  console.error(`Missing required auth environment variables: ${missingAuthEnv.join(', ')}`);
}

app.use(helmet({
  crossOriginOpenerPolicy: { policy: coopPolicy },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Configuration
const configuredAppOrigin = normalizeString(process.env.APP_ORIGIN, 250, '');
const developmentWhitelist = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173'
];
const productionWhitelist = [
  configuredAppOrigin || 'https://drizzlix.vercel.app'
];
const whitelist = IS_PRODUCTION
  ? productionWhitelist
  : [...developmentWhitelist, ...productionWhitelist];
const allowedOrigins = new Set(whitelist);
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) {
      return callback(null, !IS_PRODUCTION);
    }

    if (allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS Not Allowed'));
    }
  },
  credentials: true
}));

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  message: { msg: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// Specific Auth Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 login attempts per window
  message: { msg: 'Too many authentication attempts, please try again later.' },
});

app.use(express.json({ limit: '2mb' }));

const MAX_STATS_PAYLOAD_BYTES = 100 * 1024;
const MAX_POMODORO_PAYLOAD_BYTES = 50 * 1024;
const MAX_DECK_CARDS = 500;
const MAX_DECK_LABELS = 30;
const MAX_SUBTASKS = 100;
const VALID_TASK_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const VALID_TASK_STATUSES = new Set(['todo', 'in-progress', 'done']);
const VALID_NOTE_COLORS = new Set(['violet', 'blue', 'green', 'amber', 'rose', 'cyan']);

const VALID_OVERLAY_EFFECTS = new Set([
  'none', 'meteors', 'rain', 'wind', 'snow', 'aurora', 'lightning', 'embers', 'fireflies', 'nebula', 'matrixrain'
]);

const VALID_AVATAR_EFFECTS = new Set([
  'none', 'angel', 'flame', 'lightning', 'vortex', 'glitch', 'solarstorm'
]);

const client = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value, maxLength = 255, fallback = '') {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  if (!normalized) return fallback;
  return normalized.slice(0, maxLength);
}

function escapeRegexForQuery(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeStringArray(value, maxItems = 10, maxLength = 60) {
  if (!Array.isArray(value)) return [];
  const deduped = [];
  for (const item of value) {
    const normalized = normalizeString(item, maxLength, '');
    if (!normalized) continue;
    if (!deduped.includes(normalized)) deduped.push(normalized);
    if (deduped.length >= maxItems) break;
  }
  return deduped;
}

function normalizeDateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function getPayloadSizeBytes(payload) {
  try {
    return Buffer.byteLength(JSON.stringify(payload), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function sanitizePictureSource(value) {
  const cleaned = normalizeString(value, 2_000_000, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('data:image/')) return cleaned;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return null;
}

function sanitizeDeckInput(rawDeck) {
  if (!isPlainObject(rawDeck)) {
    return { ok: false, msg: 'Invalid deck payload.' };
  }

  const id = normalizeString(rawDeck.id, 100, '');
  const sourceDeckId = normalizeString(rawDeck.sourceDeckId, 100, '');
  const title = normalizeString(rawDeck.title, 160, '');
  if (!id || !title) {
    return { ok: false, msg: 'Deck id and title are required.' };
  }

  if (!Array.isArray(rawDeck.cards) || rawDeck.cards.length === 0) {
    return { ok: false, msg: 'Deck must include at least one card.' };
  }
  if (rawDeck.cards.length > MAX_DECK_CARDS) {
    return { ok: false, msg: `Deck exceeds ${MAX_DECK_CARDS} cards limit.` };
  }

  const cards = rawDeck.cards.map((card, index) => {
    const cardId = normalizeString(card?.id, 120, `${id}-${index + 1}`);
    const front = normalizeString(card?.front, 3000, '');
    const back = normalizeString(card?.back, 6000, '');

    return {
      id: cardId,
      front,
      back,
      lastOpened: normalizeDateOrNull(card?.lastOpened),
      nextReview: normalizeDateOrNull(card?.nextReview),
      interval: clampNumber(card?.interval, 0, 36500, 0),
      repetition: clampNumber(card?.repetition, 0, 500, 0),
      easeFactor: clampNumber(card?.easeFactor, 1.3, 5, 2.5)
    };
  });

  const hasInvalidCard = cards.some((card) => !card.front || !card.back);
  if (hasInvalidCard) {
    return { ok: false, msg: 'Each card must include non-empty front and back fields.' };
  }

  const discoverMetadata = isPlainObject(rawDeck.discoverMetadata)
    ? {
      topic: normalizeString(rawDeck.discoverMetadata.topic, 80, ''),
      level: normalizeString(rawDeck.discoverMetadata.level, 40, ''),
      language: normalizeString(rawDeck.discoverMetadata.language, 40, '')
    }
    : { topic: '', level: '', language: '' };

  return {
    ok: true,
    value: {
      id,
      sourceDeckId,
      title,
      thumbnail: normalizeString(rawDeck.thumbnail, 2_000_000, ''),
      labels: normalizeStringArray(rawDeck.labels, MAX_DECK_LABELS, 40),
      cards,
      isPublic: Boolean(rawDeck.isPublic),
      isDiscoverable: Boolean(rawDeck.isDiscoverable),
      discoverMetadata
    }
  };
}

function sanitizeTaskPayload(rawTask, { partial = false } = {}) {
  if (!isPlainObject(rawTask)) {
    return { ok: false, msg: 'Invalid task payload.' };
  }

  const updates = {};

  if (!partial || rawTask.title !== undefined) {
    const title = normalizeString(rawTask.title, 140, '');
    if (!title) return { ok: false, msg: 'Task title is required.' };
    updates.title = title;
  }

  if (rawTask.description !== undefined) {
    updates.description = normalizeString(rawTask.description, 4000, '');
  }

  if (rawTask.priority !== undefined) {
    const priority = normalizeString(rawTask.priority, 20, '').toLowerCase();
    if (!VALID_TASK_PRIORITIES.has(priority)) {
      return { ok: false, msg: 'Invalid task priority.' };
    }
    updates.priority = priority;
  }

  if (rawTask.status !== undefined) {
    const status = normalizeString(rawTask.status, 20, '').toLowerCase();
    if (!VALID_TASK_STATUSES.has(status)) {
      return { ok: false, msg: 'Invalid task status.' };
    }
    updates.status = status;
  }

  if (rawTask.dueDate !== undefined) {
    updates.dueDate = rawTask.dueDate ? normalizeDateOrNull(rawTask.dueDate) : null;
    if (rawTask.dueDate && !updates.dueDate) {
      return { ok: false, msg: 'Invalid task dueDate.' };
    }
  }

  if (rawTask.tags !== undefined) {
    updates.tags = normalizeStringArray(rawTask.tags, 25, 40);
  }

  if (rawTask.subtasks !== undefined) {
    if (!Array.isArray(rawTask.subtasks)) {
      return { ok: false, msg: 'Subtasks must be an array.' };
    }
    updates.subtasks = rawTask.subtasks.slice(0, MAX_SUBTASKS).map((subtask) => ({
      title: normalizeString(subtask?.title, 120, ''),
      done: Boolean(subtask?.done)
    })).filter((subtask) => subtask.title);
  }

  if (rawTask.pinned !== undefined) {
    updates.pinned = Boolean(rawTask.pinned);
  }

  if (partial && Object.keys(updates).length === 0) {
    return { ok: false, msg: 'No valid task fields provided.' };
  }

  return { ok: true, value: updates };
}

function sanitizeNotePayload(rawNote, { partial = false } = {}) {
  if (!isPlainObject(rawNote)) {
    return { ok: false, msg: 'Invalid note payload.' };
  }

  const updates = {};

  if (!partial || rawNote.title !== undefined) {
    updates.title = normalizeString(rawNote.title, 180, 'Untitled Note');
  }

  if (rawNote.body !== undefined) {
    updates.body = normalizeString(rawNote.body, 30000, '');
  }

  if (rawNote.category !== undefined) {
    updates.category = normalizeString(rawNote.category, 80, 'General');
  }

  if (rawNote.pinned !== undefined) {
    updates.pinned = Boolean(rawNote.pinned);
  }

  if (rawNote.color !== undefined) {
    const color = normalizeString(rawNote.color, 20, 'violet').toLowerCase();
    if (!VALID_NOTE_COLORS.has(color)) {
      return { ok: false, msg: 'Invalid note color.' };
    }
    updates.color = color;
  }

  if (partial && Object.keys(updates).length === 0) {
    return { ok: false, msg: 'No valid note fields provided.' };
  }

  return { ok: true, value: updates };
}

// MongoDB Connect
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected via Mongoose'))
    .catch(err => console.log('MongoDB Connection Failed:', err.message));
} else {
  console.log('MongoDB Connection Skipped: MONGO_URI is undefined. Vercel deployment requires Environment Variables to be configured.');
}

// Middleware to verify JWT
const authenticate = (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ msg: 'Authentication is not configured on the server.' });
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'No token' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) return res.status(401).json({ msg: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Contains { id: userId }
    next();
  } catch (e) {
    res.status(401).json({ msg: 'Token invalid' });
  }
};

const authenticateOptional = (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    req.user = null;
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  try {
    const token = authHeader.slice(7).trim();
    if (!token) {
      req.user = null;
      return next();
    }
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    req.user = null;
  }
  next();
};

// Route: Google OAuth Handshake
app.post('/api/auth/google', authLimiter, async (req, res) => {
  try {
    if (!client || !process.env.JWT_SECRET) {
      return res.status(503).json({ msg: 'Google authentication is not configured.' });
    }

    const credential = normalizeString(req.body?.credential, 6000, '');
    if (!credential) {
      return res.status(400).json({ msg: 'Google credential is required.' });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload?.email || payload.email_verified === false) {
      return res.status(401).json({ msg: 'Google account verification failed.' });
    }

    // Identity Synchronization
    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      user = new User({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture
      });
      await user.save();
    } else {
      const updates = {};
      if (payload.email && user.email !== payload.email) updates.email = payload.email;
      if (payload.name && user.name !== payload.name) updates.name = payload.name;
      if (payload.picture && user.picture !== payload.picture) updates.picture = payload.picture;
      if (Object.keys(updates).length > 0) {
        user = await User.findByIdAndUpdate(user._id, updates, { new: true });
      }
    }

    // Forge Session Token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const responseUser = {
      _id: user._id,
      email: user.email,
      name: user.name,
      username: user.username,
      picture: user.picture,
      overlayEffect: user.overlayEffect,
      avatarEffect: user.avatarEffect
    };
    res.json({ token, user: responseUser, msg: 'Authentication sequence complete' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Google Auth Negotiation Failed.' });
  }
});

// Route: Retrieve Global Stats
app.get('/api/stats', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user.stats || {});
  } catch (err) {
    console.error('API /stats GET error:', err);
    res.status(500).json({ msg: 'Database Retrieval Error' });
  }
});

// Route: Mutate Global Stats
app.post('/api/stats', authenticate, async (req, res) => {
  try {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ msg: 'Invalid stats payload.' });
    }
    if (getPayloadSizeBytes(req.body) > MAX_STATS_PAYLOAD_BYTES) {
      return res.status(413).json({ msg: 'Stats payload too large.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found.' });
    user.stats = req.body;
    user.markModified('stats'); // Override mixed object checks
    await user.save();
    res.json(user.stats);
  } catch (err) {
    console.error('API /stats POST error:', err);
    res.status(500).json({ msg: 'Database Injection Error' });
  }
});

// Route: Retrieve persisted Pomodoro state
app.get('/api/pomodoro-state', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('pomodoroState');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ state: user?.pomodoroState || null });
  } catch (err) {
    console.error('API /pomodoro-state GET error:', err);
    res.status(500).json({ msg: 'Pomodoro state retrieval failed' });
  }
});

// Route: Persist Pomodoro state
app.post('/api/pomodoro-state', authenticate, async (req, res) => {
  try {
    const incomingState = req.body?.state;
    const requestId = req.body?.requestId;

    if (!isPlainObject(incomingState)) {
      return res.status(400).json({ msg: 'Invalid pomodoro state payload' });
    }
    if (getPayloadSizeBytes(incomingState) > MAX_POMODORO_PAYLOAD_BYTES) {
      return res.status(413).json({ msg: 'Pomodoro state payload too large' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found.' });

    // 1. Idempotency Check with Log
    const MAX_LOG = 20;

    if (requestId && user.pomodoroState?.requestLog?.includes(requestId)) {
      return res.json({ ok: true, state: user.pomodoroState });
    }

    const existing = user.pomodoroState || {};

    // 3. Stale State Rejection (SEQ CHECK)
    if (
      existing.seq !== undefined &&
      incomingState.seq !== undefined &&
      incomingState.seq < existing.seq
    ) {
      return res.json({ ok: true, state: existing });
    }

    // 2. Field-Level Merge
    function mergeById(arr1 = [], arr2 = []) {
      const map = new Map();

      [...arr1, ...arr2].forEach(item => {
        const prev = map.get(item.id);
        if (!prev || (item.updatedAt || 0) > (prev.updatedAt || 0)) {
          map.set(item.id, item);
        }
      });

      return Array.from(map.values());
    }

    const historyClearedAt = Math.max(incomingState.historyClearedAt || 0, existing.historyClearedAt || 0);

    const mergedState = {
      ...existing,
      ...incomingState,
      historyClearedAt,

      tasks: mergeById(existing.tasks, incomingState.tasks),
      history: mergeById(existing.history, incomingState.history).filter(
        h => (h.updatedAt || h.createdAt || 0) >= historyClearedAt
      ),
    };

    // 4. Server-Authoritative Timestamps
    const serverTime = Date.now();

    mergedState.updatedAt = serverTime;

    mergedState.tasks = (mergedState.tasks || []).map(t => ({
      ...t,
      updatedAt: Math.min(t.updatedAt || serverTime, serverTime)
    }));

    mergedState.history = (mergedState.history || []).map(h => ({
      ...h,
      updatedAt: Math.min(h.updatedAt || serverTime, serverTime)
    }));

    // 5. Final Write
    const newLog = [...new Set([
      requestId,
      ...(user.pomodoroState?.requestLog || [])
    ])].filter(Boolean).slice(0, MAX_LOG);

    user.pomodoroState = {
      ...mergedState,
      requestLog: newLog,
      syncedAt: new Date().toISOString(),
    };

    user.markModified('pomodoroState');
    await user.save();

    res.json({ ok: true, state: user.pomodoroState });
  } catch (err) {
    console.error('API /pomodoro-state POST error:', err);
    res.status(500).json({ msg: 'Pomodoro state persistence failed' });
  }
});

// Route: Retrieve Neural Decks
app.get('/api/decks', authenticate, async (req, res) => {
  try {
    const decks = await Deck.find({ userId: req.user.id });
    res.json(decks);
  } catch (err) {
    console.error('API /decks GET error:', err);
    res.status(500).json({ msg: 'Database Retrieval Error' });
  }
});

// Route: Access check for a deck ID (used by study route for owner warnings)
app.get('/api/decks/:id/access', authenticate, async (req, res) => {
  try {
    const ownerDeck = await Deck.findOne({ id: req.params.id, userId: req.user.id }).select('id isPublic title');
    if (ownerDeck) {
      return res.json({ status: 'owner', isPublic: Boolean(ownerDeck.isPublic), title: ownerDeck.title });
    }

    const deckExists = await Deck.exists({ id: req.params.id });
    if (!deckExists) {
      return res.status(404).json({ status: 'not_found', msg: 'Deck not found.' });
    }

    return res.status(403).json({
      status: 'not_owner',
      msg: 'This deck belongs to another user and cannot be opened in Study mode.'
    });
  } catch (err) {
    console.error('API /decks/:id/access error:', err);
    res.status(500).json({ status: 'error', msg: 'Access check failed.' });
  }
});

// Route: Sync Neural Deck (Create or Update)
app.post('/api/decks', authenticate, async (req, res) => {
  try {
    const sanitizedDeckResult = sanitizeDeckInput(req.body);
    if (!sanitizedDeckResult.ok) {
      return res.status(400).json({ msg: sanitizedDeckResult.msg });
    }

    const deckData = sanitizedDeckResult.value;
    const setPayload = {
      sourceDeckId: deckData.sourceDeckId || '',
      title: deckData.title,
      thumbnail: deckData.thumbnail,
      labels: deckData.labels,
      cards: deckData.cards,
      isPublic: Boolean(deckData.isPublic),
      discoverMetadata: {
        topic: deckData?.discoverMetadata?.topic || '',
        level: deckData?.discoverMetadata?.level || '',
        language: deckData?.discoverMetadata?.language || ''
      }
    };

    if (typeof deckData.isDiscoverable === 'boolean') {
      setPayload.isDiscoverable = deckData.isDiscoverable;
    }

    // Attempt Atomic Overwrite to completely bypass VersionError triggers
    let deck = await Deck.findOneAndUpdate(
      { userId: req.user.id, id: deckData.id },
      { $set: setPayload },
      { new: true, runValidators: true }
    );

    if (deck) {
      return res.json(deck);
    }

    // If deck does not exist natively in MongoDB, initiate Document Synthesis
    const newDeck = new Deck({
      userId: req.user.id,
      id: deckData.id,
      sourceDeckId: deckData.sourceDeckId || '',
      title: deckData.title,
      thumbnail: deckData.thumbnail,
      labels: deckData.labels,
      cards: deckData.cards,
      isPublic: deckData.isPublic,
      isDiscoverable: deckData.isDiscoverable,
      discoverMetadata: deckData.discoverMetadata,
      saves: 0,
      publishedBy: {
        name: '',
        username: '',
        picture: '',
        userId: ''
      }
    });
    await newDeck.save();
    res.json(newDeck);
  } catch (err) {
    console.error('API /decks POST error:', err);
    res.status(500).json({ msg: 'Database Injection Error' });
  }
});

// Route: Sever Neural Deck
app.delete('/api/decks/:id', authenticate, async (req, res) => {
  try {
    await Deck.findOneAndDelete({ userId: req.user.id, id: req.params.id });
    res.json({ msg: 'Vector Terminated' });
  } catch (err) {
    console.error('API /decks DELETE error:', err);
    res.status(500).json({ msg: 'Database Deletion Error' });
  }
});

// Route: Get authenticated user's profile
app.get('/api/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name username bio picture email overlayEffect avatarEffect');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: 'Profile Retrieval Error' });
  }
});

// Route: Update authenticated user's profile (name, username & bio)
app.patch('/api/me/profile', authenticate, async (req, res) => {
  try {
    const { name, username, bio, picture, overlayEffect, avatarEffect } = req.body;
    let updates = {};

    // Validate Display Name
    if (name !== undefined) {
      if (!name || name.trim().length < 2) return res.status(400).json({ msg: 'Name must be at least 2 characters.' });
      if (name.trim().length > 40) return res.status(400).json({ msg: 'Name must be 40 characters or less.' });
      updates.name = name.trim();
    }

    // Validate Username
    if (username !== undefined) {
      const cleanUser = username.trim().toLowerCase();
      if (!cleanUser) return res.status(400).json({ msg: 'Username cannot be empty if provided.' });
      if (cleanUser.length < 3 || cleanUser.length > 20) return res.status(400).json({ msg: 'Username must be 3-20 characters.' });
      if (!/^[a-z0-9_]+$/.test(cleanUser)) return res.status(400).json({ msg: 'Username can only contain letters, numbers, and underscores.' });
      updates.username = cleanUser;
    }

    if (bio !== undefined) {
      const cleanBio = String(bio).trim();
      if (cleanBio.length > 240) return res.status(400).json({ msg: 'Bio must be 240 characters or less.' });
      updates.bio = cleanBio;
    }

    if (picture !== undefined) {
      const cleanPicture = sanitizePictureSource(picture);
      if (cleanPicture === null) return res.status(400).json({ msg: 'Profile picture must be an https URL or a data:image URI.' });
      updates.picture = cleanPicture;
    }

    if (overlayEffect !== undefined) {
      const cleanOverlay = String(overlayEffect).trim().toLowerCase();
      if (!VALID_OVERLAY_EFFECTS.has(cleanOverlay)) {
        return res.status(400).json({ msg: 'Invalid overlay effect value.' });
      }
      updates.overlayEffect = cleanOverlay;
    }

    if (avatarEffect !== undefined) {
      const cleanAvatar = String(avatarEffect).trim().toLowerCase();
      if (!VALID_AVATAR_EFFECTS.has(cleanAvatar)) {
        return res.status(400).json({ msg: 'Invalid avatar effect value.' });
      }
      updates.avatarEffect = cleanAvatar;
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ msg: 'No valid fields to update.' });

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('name username bio picture email overlayEffect avatarEffect');
    res.json(user);
  } catch (err) {
    if (err.code === 11000 && err.keyPattern && err.keyPattern.username) {
      return res.status(409).json({ msg: 'Username is already taken. Try another.' });
    }
    console.error('API /profile update error:', err);
    res.status(500).json({ msg: 'Profile Update Error' });
  }
});

// Route: Get any user's public profile + their public decks by username
app.get('/api/users/search', async (req, res) => {
  try {
    const query = normalizeString(req.query.q, 80, '');
    if (query.length < 2) return res.json([]);

    const limit = clampNumber(req.query.limit, 1, 20, 8);
    const escapedQuery = escapeRegexForQuery(query);

    const users = await User.aggregate([
      { $addFields: { idText: { $toString: '$_id' } } },
      {
        $match: {
          $or: [
            { name: { $regex: escapedQuery, $options: 'i' } },
            { username: { $regex: escapedQuery, $options: 'i' } },
            { idText: { $regex: escapedQuery, $options: 'i' } }
          ]
        }
      },
      { $project: { _id: 1, name: 1, username: 1, picture: 1 } },
      { $sort: { username: 1, name: 1, _id: 1 } },
      { $limit: Number(limit) }
    ]);

    if (users.length === 0) return res.json([]);

    const matchedUserIds = users.map((u) => u._id);
    const discoverDeckCounts = await Deck.aggregate([
      {
        $match: {
          userId: { $in: matchedUserIds },
          isPublic: true,
          $or: [
            { isDiscoverable: true },
            {
              isDiscoverable: { $exists: false },
              'publishedBy.userId': { $exists: true, $ne: '' }
            }
          ]
        }
      },
      { $group: { _id: '$userId', deckCount: { $sum: 1 } } }
    ]);

    const countMap = new Map(discoverDeckCounts.map((row) => [String(row._id), row.deckCount]));

    const payload = users.map((u) => {
      const userId = String(u._id);
      return {
        userId,
        name: u.name || '',
        username: u.username || '',
        picture: u.picture || '',
        deckCount: countMap.get(userId) || 0
      };
    });

    res.json(payload);
  } catch (err) {
    console.error('API /users/search error:', err);
    res.status(500).json({ msg: 'User Search Error' });
  }
});

// Route: Get any user's public profile + their public decks by username
app.get('/api/u/:username', async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await User.findOne({ username }).select('name username bio picture createdAt overlayEffect avatarEffect');
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const sharedDecks = await Deck.find({
      userId: user._id,
      isPublic: true,
      $or: [
        { isDiscoverable: true },
        {
          isDiscoverable: { $exists: false },
          'publishedBy.userId': { $exists: true, $ne: '' }
        }
      ]
    })
      .sort({ saves: -1, updatedAt: -1 })
      .select('id title thumbnail labels cards saves updatedAt');
    res.json({ user, decks: sharedDecks });
  } catch (err) {
    console.error('API /u/:username error:', err);
    res.status(500).json({ msg: 'Profile Retrieval Error' });
  }
});

// Route: Get a specific public deck by username + deckId (share links)
app.get('/api/u/:username/decks/:deckId', authenticateOptional, async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await User.findOne({ username }).select('name username bio picture createdAt overlayEffect avatarEffect');
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const deck = await Deck.findOne({
      userId: user._id,
      id: req.params.deckId
    }).select('id title thumbnail labels cards saves publishedBy updatedAt isPublic userId');

    if (!deck) return res.status(404).json({ msg: 'Deck not found' });

    const isOwner = Boolean(req.user?.id) && String(deck.userId) === String(req.user.id);
    if (!deck.isPublic && !isOwner) {
      return res.status(403).json({ msg: 'This deck is private. Only the owner can view it.' });
    }

    res.json({ user, deck });
  } catch (err) {
    console.error('API /u/:username/decks/:deckId error:', err);
    res.status(500).json({ msg: 'Deck Retrieval Error' });
  }
});

// Route: Get all public decks for the Discover feed (no auth required)
app.get('/api/discover', async (req, res) => {
  try {
    const decks = await Deck.find({
      isPublic: true,
      $or: [
        { isDiscoverable: true },
        { isDiscoverable: { $exists: false } }
      ]
    })
      .sort({ saves: -1, updatedAt: -1 })
      .select('id title thumbnail labels cards saves publishedBy discoverMetadata updatedAt')
      .lean();

    // Enrich publishedBy with the latest username from the User collection
    // This handles legacy decks published before usernames were added
    const authorIds = [...new Set(decks
      .map(d => d.publishedBy?.userId)
      .filter(Boolean))];

    const authors = await User.find({ _id: { $in: authorIds } })
      .select('_id username name picture')
      .lean();
    const authorMap = {};
    authors.forEach(a => { authorMap[a._id.toString()] = a; });

    const enriched = decks.map(d => {
      if (d.publishedBy?.userId) {
        const fresh = authorMap[d.publishedBy.userId.toString()];
        if (fresh) {
          d.publishedBy = {
            ...d.publishedBy,
            username: fresh.username || d.publishedBy.username,
            name: fresh.name || d.publishedBy.name,
            picture: fresh.picture || d.publishedBy.picture,
          };
        }
      }
      return d;
    });

    res.json(enriched);
  } catch (err) {
    console.error('API /discover GET error:', err);
    res.status(500).json({ msg: 'Discovery Retrieval Error' });
  }
});

// Route: Toggle publish/unpublish a deck to Discover
app.post('/api/decks/:id/publish', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const deck = await Deck.findOne({ userId: req.user.id, id: req.params.id });
    if (!deck) return res.status(404).json({ msg: 'Deck not found' });

    const isLegacyDiscoverable =
      typeof deck.isDiscoverable !== 'boolean' &&
      Boolean(deck.isPublic) &&
      Boolean(deck.publishedBy?.userId);

    const currentDiscoverable =
      typeof deck.isDiscoverable === 'boolean' ? deck.isDiscoverable : isLegacyDiscoverable;

    deck.isDiscoverable = !currentDiscoverable;
    // Discover decks must always be public, but public decks need not be discoverable.
    if (deck.isDiscoverable) {
      deck.isPublic = true;
      deck.publishedBy = {
        name: user.name,
        username: user.username,
        picture: user.picture,
        userId: user._id.toString()
      };
    }
    await deck.save();
    res.json({ isPublic: deck.isPublic, isDiscoverable: deck.isDiscoverable, saves: deck.saves });
  } catch (err) {
    console.error('API /decks/:id/publish error:', err);
    res.status(500).json({ msg: 'Publish Toggle Error' });
  }
});

// Route: Save a public deck to authenticated user's library
app.post('/api/decks/:id/save', authenticate, async (req, res) => {
  try {
    const sourceDeck = await Deck.findOne({ id: req.params.id, isPublic: true });
    if (!sourceDeck) return res.status(404).json({ msg: 'Deck not found or not public' });

    // Prevent saving own deck
    if (sourceDeck.userId.toString() === req.user.id) {
      return res.status(400).json({ msg: 'Cannot save your own deck' });
    }

    // Create a fresh copy for the user
    const newId = Date.now().toString();
    const copiedDeck = new Deck({
      userId: req.user.id,
      id: newId,
      sourceDeckId: sourceDeck.id,
      title: `${sourceDeck.title} (copy)`,
      thumbnail: sourceDeck.thumbnail,
      labels: sourceDeck.labels,
      cards: sourceDeck.cards.map((c, i) => ({
        ...c.toObject(),
        id: newId + i,
        lastOpened: null, nextReview: null, interval: 0, repetition: 0, easeFactor: 2.5
      })),
      isPublic: false,
      isDiscoverable: false,
      saves: 0
    });
    await copiedDeck.save();

    // Increment source deck's save counter
    sourceDeck.saves = (sourceDeck.saves || 0) + 1;
    await sourceDeck.save();

    res.json(copiedDeck);
  } catch (err) {
    console.error('API /decks/:id/save error:', err);
    res.status(500).json({ msg: 'Save Deck Error' });
  }
});

// ─── TASK ROUTES ────────────────────────────────────────────────────────────

// GET all tasks for the authenticated user
app.get('/api/tasks', authenticate, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.id }).sort({ pinned: -1, createdAt: -1 });
    res.json(tasks);
  } catch (err) { res.status(500).json({ msg: 'Error fetching tasks' }); }
});

// CREATE a new task
app.post('/api/tasks', authenticate, async (req, res) => {
  try {
    const sanitizedTask = sanitizeTaskPayload(req.body, { partial: false });
    if (!sanitizedTask.ok) return res.status(400).json({ msg: sanitizedTask.msg });

    const task = new Task({ userId: req.user.id, ...sanitizedTask.value });
    await task.save();
    res.status(201).json(task);
  } catch (err) { res.status(500).json({ msg: 'Error creating task' }); }
});

// UPDATE a task
app.patch('/api/tasks/:id', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ msg: 'Invalid task id' });
    }

    const sanitizedTask = sanitizeTaskPayload(req.body, { partial: true });
    if (!sanitizedTask.ok) return res.status(400).json({ msg: sanitizedTask.msg });

    const task = await Task.findOne({ _id: req.params.id, userId: req.user.id });
    if (!task) return res.status(404).json({ msg: 'Task not found' });

    Object.entries(sanitizedTask.value).forEach(([field, fieldValue]) => {
      task[field] = fieldValue;
    });

    await task.save();
    res.json(task);
  } catch (err) { res.status(500).json({ msg: 'Error updating task' }); }
});

// DELETE a task
app.delete('/api/tasks/:id', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ msg: 'Invalid task id' });
    }

    const result = await Task.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (!result.deletedCount) return res.status(404).json({ msg: 'Task not found' });
    res.json({ msg: 'Deleted' });
  } catch (err) { res.status(500).json({ msg: 'Error deleting task' }); }
});

// ─── NOTE ROUTES ────────────────────────────────────────────────────────────

// GET all notes for the authenticated user
app.get('/api/notes', authenticate, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.user.id })
      .sort({ pinned: -1, updatedAt: -1 })
      .select('_id title body category pinned color createdAt updatedAt')
      .lean();
    res.json(notes);
  } catch (err) { res.status(500).json({ msg: 'Error fetching notes' }); }
});

// CREATE a new note
app.post('/api/notes', authenticate, async (req, res) => {
  try {
    const sanitizedNote = sanitizeNotePayload(req.body, { partial: false });
    if (!sanitizedNote.ok) return res.status(400).json({ msg: sanitizedNote.msg });

    const note = new Note({ userId: req.user.id, ...sanitizedNote.value });
    await note.save();
    res.status(201).json(note);
  } catch (err) { res.status(500).json({ msg: 'Error creating note' }); }
});

// UPDATE a note
app.patch('/api/notes/:id', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ msg: 'Invalid note id' });
    }

    const sanitizedNote = sanitizeNotePayload(req.body, { partial: true });
    if (!sanitizedNote.ok) return res.status(400).json({ msg: sanitizedNote.msg });

    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    if (!note) return res.status(404).json({ msg: 'Note not found' });

    Object.entries(sanitizedNote.value).forEach(([field, fieldValue]) => {
      note[field] = fieldValue;
    });

    await note.save();
    res.json(note);
  } catch (err) { res.status(500).json({ msg: 'Error updating note' }); }
});

// DELETE a note
app.delete('/api/notes/:id', authenticate, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ msg: 'Invalid note id' });
    }

    const result = await Note.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (!result.deletedCount) return res.status(404).json({ msg: 'Note not found' });
    res.json({ msg: 'Deleted' });
  } catch (err) { res.status(500).json({ msg: 'Error deleting note' }); }
});

app.use((err, req, res, next) => {
  if (err?.message === 'CORS Not Allowed') {
    return res.status(403).json({ msg: 'CORS Not Allowed' });
  }
  return next(err);
});

app.use((err, req, res, next) => {
  console.error('Unhandled API error:', err);
  if (res.headersSent) return next(err);
  return res.status(500).json({ msg: 'Internal Server Error' });
});

if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`[SYS] Express Vector Engine online at port ${PORT}`));
}

module.exports = app;
