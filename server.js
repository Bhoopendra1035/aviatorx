const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Serve React frontend from client/dist
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.use(express.json());

// ---- DATABASE PERSISTENCE LAYER (MongoDB Atlas / Local Fallback) ----
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/aviator';

mongoose.connect(MONGO_URI, {
  tlsAllowInvalidCertificates: true
})
  .then(() => {
    console.log('🍃 MongoDB Atlas connected successfully!');
    loadHistory(); // Load round history from database on start
    loadDeposits(); // Load deposit requests from database on start
    loadAdminConfig(); // Load admin config from database on start
  })
  .catch(err => {
    console.error('⚠️ MongoDB Atlas connection failed:', err.message);
    console.log('🔄 Running in fallback in-memory database mode!');
  });

// ---- MONGOOSE SCHEMA & MODELS ----
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  email: { type: String, sparse: true },
  password: { type: String },
  bal: { type: Number, default: 1000 },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const RoundSchema = new mongoose.Schema({
  m: { type: Number, required: true },
  round: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Round = mongoose.model('Round', RoundSchema);

const DepositSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  amount: { type: Number, required: true },
  utrNumber: { type: String, required: true, unique: true },
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
  createdAt: { type: Date, default: Date.now }
});
const Deposit = mongoose.model('Deposit', DepositSchema);

const AdminConfigSchema = new mongoose.Schema({
  email: { type: String, default: 'bhoopendratale8@gmail.com' },
  password: { type: String, default: 'password123' }
});
const AdminConfig = mongoose.model('AdminConfig', AdminConfigSchema);

// ---- DEBUG API ENDPOINT (To view live server & DB state) ----
app.get('/api/debug-state', async (req, res) => {
  let dbUsersCount = 0;
  let dbRoundsCount = 0;
  try {
    dbUsersCount = await User.countDocuments();
    dbRoundsCount = await Round.countDocuments();
  } catch (e) {}

  res.json({
    gameState,
    connectedUsers: Object.entries(users).map(([socketId, u]) => ({ socketId, name: u.name, bal: u.bal, isAdmin: u.isAdmin })),
    activeBets: bets,
    futureCrashPoints: futureCrashPoints.slice(0, 10),
    roundHistory,
    databasePersistence: {
      status: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      mongoUri: MONGO_URI.split('@')[1] ? `mongodb+srv://***@${MONGO_URI.split('@')[1]}` : MONGO_URI,
      totalRegisteredUsers: dbUsersCount,
      totalSavedRounds: dbRoundsCount
    }
  });
});

// ---- ADMIN FULL DATA ENDPOINT ----
app.get('/api/admin/full-data', async (req, res) => {
  try {
    const allUsers = await User.find().sort({ createdAt: -1 });
    const allRounds = await Round.find().sort({ createdAt: -1 }).limit(100);
    res.json({
      allUsers,
      allRounds
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- API ENDPOINT TO GET ACTIVE ADMIN CREDENTIALS ----
app.get('/api/auth/admin-credentials', (req, res) => {
  res.json({ email: adminCredentials.email, password: adminCredentials.password });
});

// ---- API ENDPOINT TO UPDATE ADMIN CREDENTIALS ----
app.post('/api/admin/update-credentials', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ success: false, error: 'Invalid email or password (min 6 characters)' });
  }

  try {
    if (mongoose.connection.readyState === 1) {
      let cfg = await AdminConfig.findOne();
      if (!cfg) {
        cfg = new AdminConfig({ email, password });
      } else {
        cfg.email = email;
        cfg.password = password;
      }
      await cfg.save();
    }
    adminCredentials.email = email;
    adminCredentials.password = password;
    console.log(`🔐 Admin credentials updated: ${email}`);
    
    // Broadcast a security force logout to all admin sessions in real-time
    if (typeof io !== 'undefined') {
      io.emit('adminForceLogout', { msg: '🔒 Security Alert: Admin credentials have been changed. All active sessions have been terminated. Please sign in again with new credentials.' });
    }
    
    res.json({ success: true, message: 'Admin credentials updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ---- GAME STATE ----
let gameState = { status: 'waiting', mult: 1.0, waitSec: 5, crashPoint: 2.0, roundNum: 1 };
let loopInterval = null;
let startTime = 0;
let users = {};
let bets = {};
let nextCrashPoint = null;
let roundHistory = [];

// ---- DEPOSIT REQUESTS QUEUE ----
let pendingDeposits = []; // { id, socketId, userName, amount, utrNumber, status, time }
let depositIdCounter = 1;

function broadcastDepositsToAdmins() {
  const adminSockets = Object.keys(users).filter(id => users[id].isAdmin);
  adminSockets.forEach(id => {
    io.to(id).emit('adminDepositsUpdate', pendingDeposits);
  });
}

// ---- NEXT ROUNDS PRE-CALCULATED QUEUE ----
let futureCrashPoints = [];

function refillFuturePoints() {
  while (futureCrashPoints.length < 15) {
    futureCrashPoints.push(genCrash(Math.random().toString()));
  }
}

// ---- PERSISTENT DATA ASSISTANCE FUNCTIONS ----
async function loadHistory() {
  try {
    const rounds = await Round.find().sort({ createdAt: -1 }).limit(35);
    if (rounds.length > 0) {
      roundHistory = rounds.map(r => ({ m: r.m, round: r.round }));
      // Set round number to next sequence
      gameState.roundNum = rounds[0].round + 1;
      console.log(`📊 Loaded ${roundHistory.length} previous round scores from MongoDB! Next round: #${gameState.roundNum}`);
    }
  } catch (err) {
    console.error('Error loading round history from Mongo:', err.message);
  }
}

async function loadDeposits() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const deps = await Deposit.find().sort({ createdAt: -1 }).limit(100);
    pendingDeposits = deps.map(d => ({
      id: d._id.toString(),
      socketId: null,
      userName: d.userName,
      amount: d.amount,
      utrNumber: d.utrNumber,
      status: d.status,
      time: d.createdAt.getTime()
    }));
    console.log(`💰 Loaded ${pendingDeposits.length} deposit requests from MongoDB!`);
  } catch (err) {
    console.error('Error loading deposits from Mongo:', err.message);
  }
}

// ---- ADMIN CREDENTIALS CONFIG ----
let adminCredentials = { email: 'bhoopendratale8@gmail.com', password: 'password123' };

async function loadAdminConfig() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    // Delete any old admin configuration documents from DB
    await AdminConfig.deleteMany({ email: 'bhoopendratale77@gmail.com' });

    let cfg = await AdminConfig.findOne();
    if (!cfg) {
      cfg = new AdminConfig();
      await cfg.save();
    }
    adminCredentials = { email: cfg.email, password: cfg.password };
    console.log(`🔐 Loaded admin credentials from database! Email: ${adminCredentials.email}`);
  } catch (err) {
    console.error('Error loading admin credentials from database:', err.message);
  }
}


async function saveRoundToDb(m, roundNum) {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const newRound = new Round({ m, round: roundNum });
    await newRound.save();
  } catch (err) {
    console.error('Error saving round score to MongoDB:', err.message);
  }
}

async function updateDbUserBalance(socketId, newBal) {
  const u = users[socketId];
  if (!u) return;
  u.bal = newBal;
  if (mongoose.connection.readyState !== 1 || !u.dbId) return;
  try {
    await User.findByIdAndUpdate(u.dbId, { bal: newBal });
  } catch (err) {
    console.error(`Error saving balance updates for ${u.name}:`, err.message);
  }
}

// ---- MULTIPLAYER DUMMY SIMULATION SYSTEM ----
const NAME_POOL = [
  'Rahul_Pro', 'Amit_Singh', 'Aarav_King', 'Sofia_Win', 'Lucky_Trader', 'CryptoBoss', 'AviatorGuru', 'Sanjay_X',
  'Nikhil_99', 'Rohan_Cash', 'Vijay_Pro', 'Elena_Pro', 'Divya_S', 'Suresh_K', 'Pooja_Yadav', 'Arjun_Fly',
  'Karan_Max', 'Deepak_Boss', 'Preeti_9', 'Anjali_X', 'Kabir_Trade', 'Vikram_X', 'Riya_Mehta', 'Siddharth_S',
  'Manish_99', 'Aditya_V', 'Yash_Trader', 'Ishaan_Pro', 'Kunal_Pro', 'Rakesh_Gold', 'Neha_Sharma', 'Kriti_X',
  'Simran_Win', 'Rajesh_10', 'Sunil_Cash', 'Anil_Trader', 'Harish_X', 'Sandeep_Boss', 'Priya_Mehta', 'Shreya_S',
  'Sneha_Yadav', 'Ravi_Kumar', 'Manoj_V', 'Ganesh_99', 'Dinesh_Cash', 'Karthik_Fly', 'Vivek_Singh', 'Abhishek_X',
  'Akash_Mehra', 'Pranav_99', 'Swaroop_S', 'Nitin_Kumar', 'Varun_Trade', 'Aman_Win', 'Sachin_King', 'Dhoni_77',
  'Kohli_18', 'Sharma_45', 'Gill_99', 'Pant_17', 'Pandya_33', 'Rahul_1', 'Bumrah_9', 'Jadeja_8', 'Iyer_96',
  'Samson_9', 'Ashwin_99', 'Chahal_3', 'Kuldeep_23', 'Shami_11', 'Siraj_73', 'Sky_63', 'Kishan_32', 'Jaiswal_64',
  'Rinku_48', 'Dube_27', 'Axar_20', 'Sundar_5', 'Thakur_54', 'Krishna_4', 'Arshdeep_2', 'Avesh_9', 'Mukesh_25',
  'Chahar_9', 'Bishnoi_11', 'Malik_15', 'Natarajan_44', 'Saini_29', 'Tyagi_91', 'Unadkat_73', 'Mavi_22', 'Nagarkoti_5',
  'Porel_7', 'Sakariya_54', 'Dayal_48', 'Vyas_9', 'Gopal_11', 'Tewatia_44', 'Suchith_21', 'Ahmad_15'
];

let dummyBets = [];

function generateDummyBets() {
  dummyBets = [];
  const count = Math.floor(Math.random() * 13) + 12;
  const shuffledNames = [...NAME_POOL].sort(() => 0.5 - Math.random());
  const selectedNames = shuffledNames.slice(0, count);

  selectedNames.forEach((name, i) => {
    const amount = [100, 200, 300, 500, 800, 1000, 1500, 2000, 3000, 5000][Math.floor(Math.random() * 10)];
    
    const rand = Math.random();
    let targetMult;
    if (rand < 0.50) {
      targetMult = +(1.1 + Math.random() * 0.7).toFixed(2);
    } else if (rand < 0.85) {
      targetMult = +(1.8 + Math.random() * 1.7).toFixed(2);
    } else {
      targetMult = +(3.5 + Math.random() * 11.5).toFixed(2);
    }

    dummyBets.push({
      id: `dummy_${i}_${Date.now()}`,
      name,
      amount,
      targetMult,
      cashedOut: false,
      delay: Math.random() * 4200
    });
  });

  dummyBets.forEach(db => {
    setTimeout(() => {
      if (gameState.status === 'waiting') {
        io.emit('playerBet', { id: db.id, name: db.name, amount: db.amount, panelId: 1 });
      }
    }, db.delay);
  });
}

function genCrash(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const r = Math.abs(h) / 2147483647;
  return Math.max(1.01, +(1 / (1 - r * 0.97)).toFixed(2));
}

function broadcastUsers() {
  const adminSockets = Object.keys(users).filter(id => users[id].isAdmin);
  const list = Object.entries(users).map(([id, u]) => ({ id, name: u.name, bal: u.bal, isAdmin: u.isAdmin }));
  adminSockets.forEach(id => {
    io.to(id).emit('adminUsersUpdate', list);
    refillFuturePoints();
    io.to(id).emit('adminRoundsUpdate', futureCrashPoints.slice(0, 5));
  });
}

function startWait() {
  gameState.status = 'waiting';
  gameState.mult = 1.0;
  gameState.waitSec = 5;

  refillFuturePoints();
  if (nextCrashPoint !== null) {
    gameState.crashPoint = nextCrashPoint;
    nextCrashPoint = null;
  } else {
    gameState.crashPoint = futureCrashPoints.shift();
    refillFuturePoints();
  }

  const adminSockets = Object.keys(users).filter(id => users[id].isAdmin);
  adminSockets.forEach(id => {
    io.to(id).emit('adminRoundsUpdate', futureCrashPoints.slice(0, 5));
  });

  bets = {};
  io.emit('state', gameState);

  generateDummyBets();

  let cd = gameState.waitSec;
  const wt = setInterval(() => {
    cd--;
    io.emit('countdown', cd);
    if (cd <= 0) { clearInterval(wt); startFly(); }
  }, 1000);
}

function startFly() {
  gameState.status = 'flying';
  startTime = Date.now();
  io.emit('state', gameState);

  loopInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    gameState.mult = Math.pow(Math.E, 0.06 * elapsed);
    gameState.mult = +gameState.mult.toFixed(2);
    io.emit('tick', { mult: gameState.mult });

    dummyBets.forEach(db => {
      if (!db.cashedOut && gameState.mult >= db.targetMult && gameState.mult < gameState.crashPoint) {
        db.cashedOut = true;
        const win = Math.floor(db.amount * db.targetMult);
        io.emit('playerCashOut', { id: db.id, name: db.name, mult: db.targetMult, win, panelId: 1 });
      }
    });

    if (gameState.mult >= gameState.crashPoint) {
      clearInterval(loopInterval);
      doCrash();
    }
  }, 50);
}

function doCrash() {
  gameState.status = 'crashed';
  const crashMult = gameState.mult;

  roundHistory.unshift({ m: crashMult, round: gameState.roundNum });
  if (roundHistory.length > 35) roundHistory.pop();

  saveRoundToDb(crashMult, gameState.roundNum); // Persistent Save in MongoDB

  io.emit('crashed', { mult: crashMult, history: roundHistory });

  Object.keys(bets).forEach(betKey => {
    const parts = betKey.split('_');
    const socketId = parts[0];
    const panelId = parts[1];
    if (users[socketId]) {
      io.to(socketId).emit('betLost', { mult: crashMult, panelId: parseInt(panelId) });
    }
  });
  bets = {};

  gameState.roundNum++;
  setTimeout(startWait, 4000);
}

refillFuturePoints();

io.on('connection', socket => {
  socket.emit('state', gameState);
  socket.emit('history', roundHistory);

  if (gameState.status === 'waiting' || gameState.status === 'flying') {
    dummyBets.forEach(db => {
      socket.emit('playerBet', { id: db.id, name: db.name, amount: db.amount, panelId: 1 });
      if (db.cashedOut) {
        const win = Math.floor(db.amount * db.targetMult);
        socket.emit('playerCashOut', { id: db.id, name: db.name, mult: db.targetMult, win, panelId: 1 });
      }
    });
  }

  socket.on('login', async data => {
    const action = data.action || 'login'; // 'login' or 'register'
    const email = (data.email || '').toLowerCase().trim();
    const pass = data.pass || '';
    
    let isAdmin = false;
    if (email && pass) {
      isAdmin = (email === adminCredentials.email.toLowerCase().trim() && pass === adminCredentials.password);
    }

    let uName = data.name || (email ? email.split('@')[0] : 'Guest Player');
    if (isAdmin) uName = 'Admin';

    const startBal = uName === 'Guest Player' ? 500 : 1000;
    let dbId = null;
    let liveBal = startBal;

    if (mongoose.connection.readyState === 1) {
      try {
        if (isAdmin) {
          // Admin is dynamically authorized, load or create admin user
          let adminUser = await User.findOne({ name: 'Admin' });
          if (!adminUser) {
            adminUser = new User({ name: 'Admin', bal: 1000, isAdmin: true, email: adminCredentials.email });
            await adminUser.save();
          }
          dbId = adminUser._id;
          liveBal = adminUser.bal;
        } else if (uName === 'Guest Player') {
          dbId = null;
          liveBal = 500;
        } else {
          // Regular player sign-in or register flow
          if (action === 'register') {
            // Check if user already exists with this email or name
            let existing = await User.findOne({ $or: [{ name: uName }, { email: email }] });
            if (existing) {
              return socket.emit('loginError', { msg: 'Username or Email already registered' });
            }
            // Create user
            const newUser = new User({ name: uName, email: email, password: pass, bal: 1000, isAdmin: false });
            await newUser.save();
            
            // Emit registration success event and return early to prevent automatic login
            return socket.emit('registerSuccess', { msg: 'Registration successful! Please sign in with your email and password.' });
          } else {
            // Sign in flow: find user by email & password
            let existing = await User.findOne({ email: email });
            if (!existing) {
              return socket.emit('loginError', { msg: 'User does not exist. Please register first!' });
            }
            if (existing.password !== pass) {
              return socket.emit('loginError', { msg: 'Incorrect Password!' });
            }
            dbId = existing._id;
            liveBal = existing.bal;
            uName = existing.name;
          }
        }
      } catch (err) {
        console.error('Mongo login/register error:', err.message);
        return socket.emit('loginError', { msg: 'Database connection error' });
      }
    }

    users[socket.id] = {
      dbId,
      name: uName,
      isAdmin,
      bal: liveBal,
      email: email
    };

    socket.emit('loginSuccess', { name: uName, email: email, isAdmin, bal: liveBal });
    socket.emit('balUpdate', users[socket.id].bal);
    broadcastUsers();
  });

  socket.on('placeBet', async ({ amount, panelId }) => {
    const u = users[socket.id];
    if (!u) return;
    if (gameState.status !== 'waiting') return socket.emit('betError', { msg: 'Betting is closed', panelId });
    const betKey = `${socket.id}_${panelId}`;
    if (bets[betKey]) return socket.emit('betError', { msg: 'Bet already placed', panelId });
    if (amount < 1 || amount > u.bal) return socket.emit('betError', { msg: 'Invalid amount or balance', panelId });

    bets[betKey] = amount;
    const newBal = u.bal - amount;
    await updateDbUserBalance(socket.id, newBal); // Persistent balance update

    socket.emit('balUpdate', u.bal);
    socket.emit('betConfirmed', { amount, panelId });
    io.emit('playerBet', { id: betKey, name: u.name, amount, panelId });
    broadcastUsers();
  });

  socket.on('cashOut', async ({ panelId }) => {
    const u = users[socket.id];
    const betKey = `${socket.id}_${panelId}`;
    if (!u || !bets[betKey] || gameState.status !== 'flying') return;

    const betAmt = bets[betKey];
    const win = Math.floor(betAmt * gameState.mult);
    delete bets[betKey];

    const newBal = u.bal + win;
    await updateDbUserBalance(socket.id, newBal); // Persistent balance update

    socket.emit('balUpdate', u.bal);
    socket.emit('cashOutConfirmed', { mult: gameState.mult, win, panelId });
    io.emit('playerCashOut', { id: betKey, name: u.name, mult: gameState.mult, win, panelId });
    broadcastUsers();
  });

  socket.on('deposit', async amount => {
    const u = users[socket.id];
    if (!u || amount < 1) return;

    const newBal = u.bal + amount;
    await updateDbUserBalance(socket.id, newBal); // Persistent balance update

    socket.emit('balUpdate', u.bal);
    socket.emit('txAdded', { label: `Deposit via UPI ₹${amount}`, amount, plus: true });
    broadcastUsers();
  });

  socket.on('forceCrash', () => {
    const u = users[socket.id];
    if (u && u.isAdmin && gameState.status === 'flying') {
      gameState.crashPoint = gameState.mult;
    }
  });

  socket.on('setNextCrash', mult => {
    const u = users[socket.id];
    if (u && u.isAdmin && mult >= 1.0) {
      nextCrashPoint = parseFloat(mult);
      socket.emit('toast', { msg: `🎯 Next crash target set to ${nextCrashPoint.toFixed(2)}x`, type: 'success' });
      broadcastUsers();
    }
  });

  socket.on('addBal', async data => {
    const u = users[socket.id];
    if (!u || !u.isAdmin) return;
    const target = users[data.id];
    if (target) {
      const newBal = target.bal + data.amount;
      await updateDbUserBalance(data.id, newBal); // Persistent balance update target user

      io.to(data.id).emit('balUpdate', target.bal);
      io.to(data.id).emit('toast', { msg: `🎁 Admin gifted you ${data.amount} coins!`, type: 'success' });
      broadcastUsers();
    }
  });

  socket.on('kickUser', targetId => {
    const u = users[socket.id];
    if (!u || !u.isAdmin) return;
    if (users[targetId]) {
      io.to(targetId).emit('kicked');
      io.sockets.sockets.get(targetId)?.disconnect();
    }
  });

  // ---- ADVANCED ADMIN CUSTOMER MANAGEMENT SOCKETS ----
  socket.on('adminEditBalance', async ({ userId, bal }) => {
    const u = users[socket.id];
    if (!u || !u.isAdmin) return;
    try {
      const target = await User.findByIdAndUpdate(userId, { bal }, { new: true });
      if (target) {
        const activeSocketId = Object.keys(users).find(sid => users[sid].dbId?.toString() === userId);
        if (activeSocketId) {
          users[activeSocketId].bal = bal;
          io.to(activeSocketId).emit('balUpdate', bal);
        }
        broadcastUsers();
        socket.emit('toast', { msg: `🪙 Updated balance for ${target.name} to ${bal.toLocaleString()} 🪙`, type: 'success' });
      }
    } catch (err) {
      socket.emit('toast', { msg: 'Error updating balance', type: 'error' });
    }
  });

  socket.on('adminToggleAdmin', async ({ userId }) => {
    const u = users[socket.id];
    if (!u || !u.isAdmin) return;
    try {
      const targetUser = await User.findById(userId);
      if (targetUser) {
        targetUser.isAdmin = !targetUser.isAdmin;
        await targetUser.save();
        const activeSocketId = Object.keys(users).find(sid => users[sid].dbId?.toString() === userId);
        if (activeSocketId) {
          users[activeSocketId].isAdmin = targetUser.isAdmin;
        }
        broadcastUsers();
        socket.emit('toast', { msg: `🛡️ Admin role updated for ${targetUser.name}!`, type: 'success' });
      }
    } catch (err) {
      socket.emit('toast', { msg: 'Error toggling admin status', type: 'error' });
    }
  });

  socket.on('adminDeleteUser', async ({ userId }) => {
    const u = users[socket.id];
    if (!u || !u.isAdmin) return;
    try {
      const targetUser = await User.findByIdAndDelete(userId);
      if (targetUser) {
        const activeSocketId = Object.keys(users).find(sid => users[sid].dbId?.toString() === userId);
        if (activeSocketId) {
          io.to(activeSocketId).emit('kicked');
          io.sockets.sockets.get(activeSocketId)?.disconnect();
        }
        broadcastUsers();
        socket.emit('toast', { msg: `🗑️ Deleted customer ${targetUser.name} from database!`, type: 'success' });
      }
    } catch (err) {
      socket.emit('toast', { msg: 'Error deleting user', type: 'error' });
    }
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    delete bets[`${socket.id}_1`];
    delete bets[`${socket.id}_2`];
    broadcastUsers();
  });

  // ── DEPOSIT REQUEST: user submits amount + UTR ───────────────────────────
  socket.on('depositRequest', async ({ amount, utrNumber, userName }) => {
    if (!amount || amount < 10 || !utrNumber) return;

    const cleanUtr = utrNumber.trim();

    // Check duplicate
    try {
      if (mongoose.connection.readyState === 1) {
        const existing = await Deposit.findOne({ utrNumber: cleanUtr });
        if (existing) {
          socket.emit('toast', { msg: '⚠️ This UTR number has already been submitted.', type: 'error' });
          return;
        }
      }
    } catch (e) {
      console.error('Error checking duplicate UTR:', e);
    }

    const uName = userName || (users[socket.id] ? users[socket.id].name : 'Unknown');
    const amt = parseInt(amount);

    let dbId = `dep_${Date.now()}`;

    if (mongoose.connection.readyState === 1) {
      try {
        const d = new Deposit({
          userName: uName,
          amount: amt,
          utrNumber: cleanUtr,
          status: 'pending'
        });
        await d.save();
        dbId = d._id.toString();
      } catch (err) {
        console.error('Error saving deposit request:', err.message);
      }
    }

    const dep = {
      id: dbId,
      socketId: socket.id,
      userName: uName,
      amount: amt,
      utrNumber: cleanUtr,
      status: 'pending',
      time: Date.now(),
    };
    pendingDeposits.unshift(dep);

    // Notify user
    socket.emit('toast', { msg: `📤 Deposit request of ₹${amt} submitted! Admin will verify shortly.`, type: 'success' });

    // Notify all admins
    broadcastDepositsToAdmins();
    const adminSockets = Object.keys(users).filter(id => users[id].isAdmin);
    adminSockets.forEach(id => {
      io.to(id).emit('toast', { msg: `💰 New deposit request: ₹${amt} from ${dep.userName} (UTR: ${cleanUtr})`, type: 'info' });
    });
  });

  // ── GET DEPOSITS: admin requests current list ────────────────────────────
  socket.on('getAdminDeposits', () => {
    const u = users[socket.id];
    if (!u || !u.isAdmin) return;
    socket.emit('adminDepositsUpdate', pendingDeposits);
  });

  // ── APPROVE DEPOSIT: admin approves → credit coins ───────────────────────
  socket.on('adminApproveDeposit', async ({ depositId }) => {
    const u = users[socket.id];
    if (!u || !u.isAdmin) return;

    const dep = pendingDeposits.find(d => d.id === depositId);
    if (!dep || dep.status !== 'pending') return;

    dep.status = 'approved';

    // Update status in MongoDB
    if (mongoose.connection.readyState === 1 && !depositId.startsWith('dep_')) {
      try {
        await Deposit.findByIdAndUpdate(depositId, { status: 'approved' });
      } catch (err) {
        console.error('Error updating deposit status in DB:', err.message);
      }
    }

    // Credit coins to target user
    const targetSocketId = dep.socketId;
    const targetUser = users[targetSocketId];

    if (targetUser) {
      const newBal = targetUser.bal + dep.amount;
      await updateDbUserBalance(targetSocketId, newBal);
      io.to(targetSocketId).emit('balUpdate', targetUser.bal);
      io.to(targetSocketId).emit('toast', {
        msg: `✅ Your deposit of ₹${dep.amount} has been approved! ${dep.amount} 🪙 added to your wallet.`,
        type: 'success'
      });
    } else {
      // User offline: update DB directly by name
      if (mongoose.connection.readyState === 1) {
        try {
          const dbUser = await User.findOne({ name: dep.userName });
          if (dbUser) {
            dbUser.bal += dep.amount;
            await dbUser.save();
          }
        } catch (err) {
          console.error('Error crediting offline user:', err.message);
        }
      }
    }

    broadcastDepositsToAdmins();
    broadcastUsers();
    socket.emit('toast', { msg: `✅ Approved ₹${dep.amount} for ${dep.userName}`, type: 'success' });
  });

  // ── REJECT DEPOSIT: admin rejects ────────────────────────────────────────
  socket.on('adminRejectDeposit', async ({ depositId }) => {
    const u = users[socket.id];
    if (!u || !u.isAdmin) return;

    const dep = pendingDeposits.find(d => d.id === depositId);
    if (!dep || dep.status !== 'pending') return;

    dep.status = 'rejected';

    // Update status in MongoDB
    if (mongoose.connection.readyState === 1 && !depositId.startsWith('dep_')) {
      try {
        await Deposit.findByIdAndUpdate(depositId, { status: 'rejected' });
      } catch (err) {
        console.error('Error updating deposit status in DB:', err.message);
      }
    }

    const targetSocketId = dep.socketId;
    if (targetSocketId) {
      io.to(targetSocketId).emit('toast', {
        msg: `❌ Your deposit request of ₹${dep.amount} was rejected. Contact support if this is an error.`,
        type: 'error'
      });
    }

    broadcastDepositsToAdmins();
    socket.emit('toast', { msg: `❌ Rejected deposit for ${dep.userName}`, type: 'info' });
  });

});

startWait();

// SPA Fallback — serve React index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`✈️  AviatorX Server running on http://127.0.0.1:${PORT}`));
