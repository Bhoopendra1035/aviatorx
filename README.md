# AviatorX - Multiplayer Crash Game

AviatorX is a production-ready, multiplayer crash game built with Node.js, Socket.io, and React. It features a server-authoritative game engine, real-time betting, and a robust admin panel.

## Features

- **Real-time Multiplayer**: Powered by Socket.io for low-latency game state synchronization.
- **Provably Fair Mechanics**: Server-side crash point calculation with pre-calculated round queues.
- **Comprehensive Admin Panel**:
  - Live user monitoring and balance management.
  - Manual crash control and next-round planning.
  - Transaction history (deposits/withdrawals) management.
- **User Systems**:
  - Secure authentication (Login/Register).
  - Wallet system with deposit and withdrawal flows.
  - Referral system with bonus rewards.
- **Persistent Storage**: MongoDB integration for user data, round history, and transactions.
- **Responsive Design**: Mobile-first UI optimized for all devices.

## Tech Stack

- **Frontend**: React, CSS (Custom styling), Vite.
- **Backend**: Node.js, Express, Socket.io.
- **Database**: MongoDB (Mongoose).
- **Styling**: Premium, dynamic UI with glassmorphism and smooth animations.

## Getting Started

### Prerequisites

- Node.js (v14+)
- MongoDB Atlas account or local MongoDB instance.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Bhoopendra1035/aviatorx.git
   cd aviatorx
   ```

2. Install dependencies for both server and client:
   ```bash
   # Root dependencies (Server)
   npm install

   # Client dependencies
   cd client
   npm install
   cd ..
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   ```

4. Build the frontend:
   ```bash
   cd client
   npm run build
   cd ..
   ```

5. Start the server:
   ```bash
   npm start
   ```

## Admin Access

Default admin credentials can be configured in the database or via environment variables. The admin panel allows full control over game outcomes and user balances.

## License

MIT License - feel free to use and modify for your own projects.
