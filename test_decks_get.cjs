const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'server/.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://hrxri_neurodeck:Yhg20ti36ZQfPfmL@cluster0neurodeck.ocysznk.mongodb.net/drizzlix?appName=Cluster0NeuroDeck';

const deckSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  id: { type: String, required: true }, 
  title: { type: String, required: true },
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
  console.log('Connecting...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected!');

  const decks = await Deck.find({ userId: '69ce7aab4eabc5600056cde3' }).lean();

  console.log(`\nFound ${decks.length} decks for user:`);
  console.log(JSON.stringify(decks.map(d => ({ id: d.id, title: d.title, isPublic: d.isPublic, isDiscoverable: d.isDiscoverable })), null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
