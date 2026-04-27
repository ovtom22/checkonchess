const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Chess } = require('chess.js');
const { randomUUID } = require('crypto');
const pool = require('../db/pool');
const { broadcast } = require('../services/websocket');
const { authenticate } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Middleware: authenticate human user via JWT
async function authUser(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0) return res.status(401).json({ success: false, error: 'User not found' });
    req.user = result.rows[0];
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

// POST /api/v1/play/queue — join matchmaking
router.post('/queue', authUser, async (req, res) => {
  const { time_control = 600 } = req.body;

  try {
    // Remove from existing queue
    await pool.query('DELETE FROM matchmaking_queue WHERE user_id = $1', [req.user.id]);

    // Look for an opponent
    const opponent = await pool.query(
      `SELECT * FROM matchmaking_queue
       WHERE user_id != $1 AND time_control = $2
       ORDER BY joined_at ASC LIMIT 1`,
      [req.user.id, time_control]
    );

    if (opponent.rows.length > 0) {
      // Match found — create game
      const opp = opponent.rows[0];
      await pool.query('DELETE FROM matchmaking_queue WHERE id = $1', [opp.id]);

      const isWhite = Math.random() < 0.5;
      const whiteId = isWhite ? req.user.id : opp.user_id;
      const blackId = isWhite ? opp.user_id : req.user.id;
      const gameId = randomUUID();

      await pool.query(
        `INSERT INTO human_games (id, white_user_id, black_user_id, status, white_time_ms, black_time_ms, time_control)
         VALUES ($1, $2, $3, 'active', $4, $4, $5)`,
        [gameId, whiteId, blackId, time_control * 1000, time_control]
      );

      // Notify both via WebSocket
      broadcast('queue', { type: 'matched', gameId, whiteId, blackId });

      return res.json({ success: true, matched: true, gameId });
    }

    // No match — join queue
    await pool.query(
      'INSERT INTO matchmaking_queue (user_id, time_control) VALUES ($1, $2)',
      [req.user.id, time_control]
    );

    res.json({ success: true, matched: false, message: 'In queue, waiting for opponent...' });
  } catch (err) {
    console.error('Queue error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/v1/play/queue — leave matchmaking
router.delete('/queue', authUser, async (req, res) => {
  await pool.query('DELETE FROM matchmaking_queue WHERE user_id = $1', [req.user.id]);
  res.json({ success: true, message: 'Left queue' });
});

// POST /api/v1/play/challenge-ai — challenge an AI agent
router.post('/challenge-ai', authUser, async (req, res) => {
  const { agent_name, color = 'random', time_control = 600 } = req.body;

  try {
    const agentResult = await pool.query(
      'SELECT * FROM agents WHERE LOWER(name) = LOWER($1) AND is_active = TRUE',
      [agent_name]
    );
    if (agentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent not found or inactive' });
    }
    const agent = agentResult.rows[0];

    const playAsWhite = color === 'white' || (color === 'random' && Math.random() < 0.5);
    const gameId = randomUUID();

    await pool.query(
      `INSERT INTO human_games (id, white_user_id, black_user_id, ai_agent_id, mode, status, white_time_ms, black_time_ms, time_control)
       VALUES ($1, $2, $3, $4, 'human-vs-ai', 'active', $5, $5, $6)`,
      [
        gameId,
        playAsWhite ? req.user.id : null,
        playAsWhite ? null : req.user.id,
        agent.id,
        time_control * 1000,
        time_control,
      ]
    );

    // Notify agent via webhook if set
    if (agent.webhook_url) {
      fetch(agent.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'human_challenge',
          game_id: gameId,
          human_plays: playAsWhite ? 'white' : 'black',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          your_turn: !playAsWhite,
        }),
      }).catch(() => {});
    }

    res.json({ success: true, gameId, playingAs: playAsWhite ? 'white' : 'black' });
  } catch (err) {
    console.error('Challenge AI error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/play/games/:id — get human game state
router.get('/games/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT hg.*,
        wu.username AS white_username, wu.avatar_url AS white_avatar,
        bu.username AS black_username, bu.avatar_url AS black_avatar,
        a.name AS ai_agent_name
       FROM human_games hg
       LEFT JOIN users wu ON hg.white_user_id = wu.id
       LEFT JOIN users bu ON hg.black_user_id = bu.id
       LEFT JOIN agents a ON hg.ai_agent_id = a.id
       WHERE hg.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Game not found' });
    }

    const movesResult = await pool.query(
      'SELECT * FROM human_moves WHERE game_id = $1 ORDER BY move_number ASC',
      [req.params.id]
    );

    res.json({ success: true, game: result.rows[0], moves: movesResult.rows });
  } catch (err) {
    console.error('Get game error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/play/games/:id/move — submit a move
router.post('/games/:id/move', authUser, async (req, res) => {
  const { san, uci } = req.body;

  try {
    const result = await pool.query('SELECT * FROM human_games WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Game not found' });

    const game = result.rows[0];
    if (game.status !== 'active') return res.status(400).json({ success: false, error: 'Game is not active' });

    // Check it's this user's turn
    const isWhite = game.white_user_id === req.user.id;
    const isBlack = game.black_user_id === req.user.id;
    if (!isWhite && !isBlack) return res.status(403).json({ success: false, error: 'You are not a player in this game' });
    if (game.current_turn === 'white' && !isWhite) return res.status(400).json({ success: false, error: 'Not your turn' });
    if (game.current_turn === 'black' && !isBlack) return res.status(400).json({ success: false, error: 'Not your turn' });

    // Validate move
    const chess = new Chess(game.fen);
    let moveResult;
    try {
      moveResult = chess.move(san || uci);
      if (!moveResult) throw new Error('Invalid move');
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid move' });
    }

    const newFen = chess.fen();
    const nextTurn = game.current_turn === 'white' ? 'black' : 'white';
    const moveCount = await pool.query('SELECT COUNT(*) FROM human_moves WHERE game_id = $1', [req.params.id]);
    const moveNumber = parseInt(moveCount.rows[0].count) + 1;

    // Time calculation
    const now = Date.now();
    const turnStarted = game.turn_started_at ? new Date(game.turn_started_at).getTime() : now;
    const timeSpent = now - turnStarted;
    const timeRemaining = game.current_turn === 'white'
      ? Math.max(0, game.white_time_ms - timeSpent)
      : Math.max(0, game.black_time_ms - timeSpent);

    // Save move
    await pool.query(
      `INSERT INTO human_moves (game_id, user_id, move_number, color, san, uci, fen_after, time_spent_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.params.id, req.user.id, moveNumber, game.current_turn, moveResult.san, moveResult.lan || uci, newFen, timeSpent]
    );

    // Check game over
    let status = 'active';
    let gameResult = null;

    if (chess.isCheckmate()) {
      status = 'completed';
      gameResult = game.current_turn === 'white' ? 'white_wins' : 'black_wins';
    } else if (chess.isDraw()) {
      status = 'completed';
      gameResult = 'draw';
    }

    // Update game
    const updateQuery = status === 'completed'
      ? `UPDATE human_games SET fen = $1, current_turn = $2, status = $3, result = $4,
         ${game.current_turn === 'white' ? 'white_time_ms' : 'black_time_ms'} = $5, updated_at = NOW() WHERE id = $6`
      : `UPDATE human_games SET fen = $1, current_turn = $2, status = $3, result = $4,
         ${game.current_turn === 'white' ? 'white_time_ms' : 'black_time_ms'} = $5, turn_started_at = NOW(), updated_at = NOW() WHERE id = $6`;

    await pool.query(updateQuery, [newFen, nextTurn, status, gameResult, timeRemaining, req.params.id]);

    // Broadcast to WebSocket room
    broadcast(req.params.id, {
      type: 'move',
      san: moveResult.san,
      fen: newFen,
      turn: nextTurn,
      status,
      result: gameResult,
    });

    // If human-vs-ai and game still active, notify the agent's webhook (best-effort)
    if (status === 'active' && game.mode === 'human-vs-ai' && game.ai_agent_id) {
      const agentResult = await pool.query('SELECT webhook_url FROM agents WHERE id = $1', [game.ai_agent_id]);
      const agentWebhook = agentResult.rows[0]?.webhook_url;
      if (agentWebhook) {
        fetch(agentWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'your_turn',
            game_id: req.params.id,
            fen: newFen,
            your_color: nextTurn,
          }),
        }).catch(() => {});
      }
    }

    res.json({ success: true, san: moveResult.san, fen: newFen, status, result: gameResult });
  } catch (err) {
    console.error('Move error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/play/games/:id/resign
router.post('/games/:id/resign', authUser, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM human_games WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Game not found' });

    const game = result.rows[0];
    if (game.status !== 'active') return res.status(400).json({ success: false, error: 'Game is not active' });

    const isWhite = game.white_user_id === req.user.id;
    const isBlack = game.black_user_id === req.user.id;
    if (!isWhite && !isBlack) return res.status(403).json({ success: false, error: 'Not a player' });

    const gameResult = isWhite ? 'black_wins_resignation' : 'white_wins_resignation';
    await pool.query(
      'UPDATE human_games SET status = $1, result = $2, updated_at = NOW() WHERE id = $3',
      ['completed', gameResult, req.params.id]
    );

    broadcast(req.params.id, { type: 'resigned', result: gameResult });
    res.json({ success: true, result: gameResult });
  } catch (err) {
    console.error('Resign error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/play/games/ai-pending — list games waiting for this agent's move
router.get('/games/ai-pending', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT hg.id, hg.fen, hg.current_turn, hg.mode, hg.status,
              hg.white_user_id, hg.black_user_id,
              wu.username AS white_username,
              bu.username AS black_username,
              hg.white_time_ms, hg.black_time_ms
       FROM human_games hg
       LEFT JOIN users wu ON hg.white_user_id = wu.id
       LEFT JOIN users bu ON hg.black_user_id = bu.id
       WHERE hg.ai_agent_id = $1
         AND hg.status = 'active'
         AND (
           (hg.white_user_id IS NULL AND hg.current_turn = 'white')
           OR (hg.black_user_id IS NULL AND hg.current_turn = 'black')
         )`,
      [req.agent.id]
    );
    res.json({ success: true, games: result.rows });
  } catch (err) {
    console.error('AI pending error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/play/games/:id/ai-move — agent submits a move
router.post('/games/:id/ai-move', authenticate, async (req, res) => {
  const { uci, san } = req.body;

  try {
    const result = await pool.query('SELECT * FROM human_games WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Game not found' });

    const game = result.rows[0];
    if (game.status !== 'active') return res.status(400).json({ success: false, error: 'Game is not active' });
    if (game.ai_agent_id !== req.agent.id) return res.status(403).json({ success: false, error: 'Not your game' });

    // Verify it's the agent's turn
    const agentIsWhite = game.white_user_id === null;
    const agentIsBlack = game.black_user_id === null;
    if (game.current_turn === 'white' && !agentIsWhite) return res.status(400).json({ success: false, error: 'Not your turn' });
    if (game.current_turn === 'black' && !agentIsBlack) return res.status(400).json({ success: false, error: 'Not your turn' });

    // Validate move
    const chess = new Chess(game.fen);
    let moveResult;
    try {
      moveResult = chess.move(san || uci);
      if (!moveResult) throw new Error('Invalid move');
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid move' });
    }

    const newFen = chess.fen();
    const nextTurn = game.current_turn === 'white' ? 'black' : 'white';
    const moveCount = await pool.query('SELECT COUNT(*) FROM human_moves WHERE game_id = $1', [req.params.id]);
    const moveNumber = parseInt(moveCount.rows[0].count) + 1;

    const now = Date.now();
    const turnStarted = game.turn_started_at ? new Date(game.turn_started_at).getTime() : now;
    const timeSpent = now - turnStarted;
    const timeRemaining = game.current_turn === 'white'
      ? Math.max(0, game.white_time_ms - timeSpent)
      : Math.max(0, game.black_time_ms - timeSpent);

    // Save move (null user_id for agent moves)
    await pool.query(
      `INSERT INTO human_moves (game_id, user_id, move_number, color, san, uci, fen_after, time_spent_ms)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7)`,
      [req.params.id, moveNumber, game.current_turn, moveResult.san, moveResult.lan || uci, newFen, timeSpent]
    );

    // Check game over
    let status = 'active';
    let gameResult = null;
    if (chess.isCheckmate()) {
      status = 'completed';
      gameResult = game.current_turn === 'white' ? 'white_wins' : 'black_wins';
    } else if (chess.isDraw()) {
      status = 'completed';
      gameResult = 'draw';
    }

    const updateQuery = status === 'completed'
      ? `UPDATE human_games SET fen = $1, current_turn = $2, status = $3, result = $4,
         ${game.current_turn === 'white' ? 'white_time_ms' : 'black_time_ms'} = $5, updated_at = NOW() WHERE id = $6`
      : `UPDATE human_games SET fen = $1, current_turn = $2, status = $3, result = $4,
         ${game.current_turn === 'white' ? 'white_time_ms' : 'black_time_ms'} = $5, turn_started_at = NOW(), updated_at = NOW() WHERE id = $6`;

    await pool.query(updateQuery, [newFen, nextTurn, status, gameResult, timeRemaining, req.params.id]);

    // Update agent stats if game over
    if (status === 'completed') {
      const agentWon = (agentIsWhite && gameResult === 'white_wins') || (agentIsBlack && gameResult === 'black_wins');
      const agentLost = (agentIsWhite && gameResult === 'black_wins') || (agentIsBlack && gameResult === 'white_wins');
      if (agentWon) await pool.query('UPDATE agents SET wins = wins + 1 WHERE id = $1', [req.agent.id]);
      else if (agentLost) await pool.query('UPDATE agents SET losses = losses + 1 WHERE id = $1', [req.agent.id]);
      else await pool.query('UPDATE agents SET draws = draws + 1 WHERE id = $1', [req.agent.id]);
    }

    await pool.query('UPDATE agents SET last_active = NOW() WHERE id = $1', [req.agent.id]);

    broadcast(req.params.id, {
      type: 'move',
      san: moveResult.san,
      fen: newFen,
      turn: nextTurn,
      status,
      result: gameResult,
    });

    res.json({ success: true, san: moveResult.san, fen: newFen, status, result: gameResult });
  } catch (err) {
    console.error('AI move error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/play/queue/status — check if matched
router.get('/queue/status', authUser, async (req, res) => {
  try {
    const inQueue = await pool.query('SELECT * FROM matchmaking_queue WHERE user_id = $1', [req.user.id]);
    const recentGame = await pool.query(
      `SELECT id FROM human_games
       WHERE (white_user_id = $1 OR black_user_id = $1)
       AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    res.json({
      success: true,
      inQueue: inQueue.rows.length > 0,
      activeGame: recentGame.rows[0]?.id || null,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
