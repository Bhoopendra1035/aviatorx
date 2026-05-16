const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/aviator';

const BetSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  amount: { type: Number, required: true },
  mult: { type: Number },
  win: { type: Number, default: 0 },
  cashedOut: { type: Boolean, default: false },
  roundNum: { type: Number },
  createdAt: { type: Date, default: Date.now }
});
const Bet = mongoose.model('Bet', BetSchema);

async function checkBets() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB');
    const bets = await Bet.find().sort({ createdAt: -1 }).limit(10);
    console.log('Recent Bets:', JSON.stringify(bets, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkBets();
