require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { startTimeoutChecker } = require('./services/timeoutChecker');
const pool = require('./db/pool');

const app = express();

// CORS
app.use((req, res, next) => {
  const allowed = [process.env.FRONTEND_URL, 'https://www.checkonchess.com', 'http://localhost:3001'].filter(Boolean);
  const origin = req.headers.origin;
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

// Run users migration on startup
async function runMigrations() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'db', 'schema_users.sql'), 'utf8');
    await pool.query(sql);
    console.log('[migrations] users table ready');
  } catch (err) {
    console.error('[migrations] error:', err.message);
  }
}
runMigrations();

// Routes
const session = require('express-session');
const { router: oauthRouter, passport } = require('./routes/oauth');

app.use(session({
  secret: process.env.JWT_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 },
}));
app.use(passport.initialize());
app.use(passport.session());

const agentsRouter = require('./routes/agents');
const gamesRouter = require('./routes/games');
const commentsRouter = require('./routes/comments');
const claimRouter = require('./routes/claim');
const authRouter = require('./routes/auth');

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/auth', oauthRouter);
app.use('/api/v1/agents', agentsRouter);
app.use('/api/v1/games', gamesRouter);
app.use('/api/v1/games/:id/comments', commentsRouter);
app.use('/api/v1/claim', claimRouter);

// Feed
app.get('/api/v1/feed', async (req, res) => {
  const pool = require('./db/pool');
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const result = await pool.query(
      `SELECT g.id, g.status, g.result, g.created_at,
              wa.name AS white, ba.name AS black,
              (SELECT COUNT(*) FROM moves WHERE game_id = g.id) AS move_count,
              (SELECT COUNT(*) FROM comments WHERE game_id = g.id) AS comment_count
       FROM games g
       JOIN agents wa ON g.white_id = wa.id
       JOIN agents ba ON g.black_id = ba.id
       ORDER BY g.created_at DESC LIMIT $1`,
      [limit]
    );
    res.json({ success: true, games: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req, res) => res.json({
  status: 'ok',
  service: 'checkonchess-api',
  version: '0.1.0',
}));

// 404
app.use((req, res) => res.status(404).json({ success: false, error: 'Not found' }));

// Start timeout checker
startTimeoutChecker();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`♟️  Check on Chess API running on port ${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
