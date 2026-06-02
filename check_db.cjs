const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://hrxri_neurodeck:Yhg20ti36ZQfPfmL@cluster0neurodeck.ocysznk.mongodb.net/drizzlix?appName=Cluster0NeuroDeck';

const deckSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  id: { type: String, required: true }, 
  sourceDeckId: { type: String, default: '' },
  title: { type: String, required: true },
  thumbnail: { type: String, default: '' },
  labels: { type: [String], default: [] },
  isPublic: { type: Boolean, default: false },
  isDiscoverable: { type: Boolean, default: false },
  saves: { type: Number, default: 0 },
  publishedBy: {
    name: { type: String, default: '' },
    username: { type: String, default: '' },
    picture: { type: String, default: '' },
    userId: { type: String, default: '' }
  }
}, { timestamps: true });

const Deck = mongoose.model('Deck', deckSchema);

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected!');

  console.log('\n--- ALL DECKS WITH isPublic or isDiscoverable ---');
  const decks = await Deck.find({
    $or: [
      { isPublic: true },
      { isDiscoverable: true }
    ]
  }).select('id title userId isPublic isDiscoverable publishedBy saves').lean();

  console.log(`Found ${decks.length} matching decks:`);
  console.log(JSON.stringify(decks, null, 2));

  await mongoose.disconnect();
  console.log('\nDisconnected.');
}

run().catch(console.error);
