require('dotenv').config();
const express = require('express');
const { startTimeoutChecker } = require('./services/timeoutChecker');

const app = express();
app.use(express.json());

// Routes
const agentsRouter = require('./routes/agents');
const gamesRouter = require('./routes/games');
const commentsRouter = require('./routes/comments');
const claimRouter = require('./routes/claim');

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
