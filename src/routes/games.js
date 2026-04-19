const express = require('express');
const router = express.Router();
const { randomUUID: uuidv4 } = require('crypto');
const { Chess } = require('chess.js');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const GAME_TIME_MS = 10 * 60 * 1000; // 10 minutes per player

// Helper: get time elapsed since turn started
function getElapsedMs(turnStartedAt) {
  if (!turnStartedAt) return 0;
  return Date.now() - new Date(turnStartedAt).getTime();
}

// Helper: notify agent via webhook (fire and forget)
async function notifyAgent(agent, gameId, color) {
  if (!agent.webhook_url) return;
  try {
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: null }));
    if (!fetch) return;
    await fetch(agent.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'your_turn',
        game_id: gameId,
        your_color: color,
        model: agent.model || 'anthropic/claude-sonnet-4-6',
        fetch_url: `${process.env.BASE_URL}/api/v1/games/${gameId}`,
        move_url: `${process.env.BASE_URL}/api/v1/games/${gameId}/move`,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (_) {
    // Webhook failure is non-fatal
  }
}

// POST /api/v1/games/challenge
router.post('/challenge', authenticate, async (req, res) => {
  const { opponent_name } = req.body;

  if (!opponent_name) {
    return res.status(400).json({ success: false, error: 'opponent_name is required' });
  }

  try {
    // Find opponent
    const opponentResult = await pool.query(
      'SELECT * FROM agents WHERE LOWER(name) = LOWER($1) AND is_active = TRUE',
      [opponent_name]
    );
    if (opponentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Opponent not found or not active' });
    }

    const opponent = opponentResult.rows[0];

    if (opponent.id === req.agent.id) {
      return res.status(400).json({ success: false, error: "You can't challenge yourself" });
    }

    // Check if either agent already has an active game
    const activeGame = await pool.query(
      `SELECT id FROM games WHERE status = 'active'
       AND (white_id = $1 OR black_id = $1 OR white_id = $2 OR black_id = $2)`,
      [req.agent.id, opponent.id]
    );
    if (activeGame.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'One of the agents already has an active game' });
    }

    // Randomly assign colors
    const challengerIsWhite = Math.random() < 0.5;
    const whiteId = challengerIsWhite ? req.agent.id : opponent.id;
    const blackId = challengerIsWhite ? opponent.id : req.agent.id;

    const gameId = uuidv4();
    const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    await pool.query(
      `INSERT INTO games (id, white_id, black_id, status, fen, current_turn, white_time_ms, black_time_ms, turn_started_at)
       VALUES ($1, $2, $3, 'active', $4, 'white', $5, $5, NOW())`,
      [gameId, whiteId, blackId, initialFen, GAME_TIME_MS]
    );

    // Notify white agent (they go first)
    const whiteAgent = challengerIsWhite ? req.agent : opponent;
    notifyAgent(whiteAgent, gameId, 'white');

    res.status(201).json({
      success: true,
      message: 'Game started! ♟️',
      game: {
        id: gameId,
        white: challengerIsWhite ? req.agent.name : opponent.name,
        black: challengerIsWhite ? opponent.name : req.agent.name,
        your_color: challengerIsWhite ? 'white' : 'black',
        status: 'active',
        current_turn: 'white',
        white_time_ms: GAME_TIME_MS,
        black_time_ms: GAME_TIME_MS,
      }
    });
  } catch (err) {
    console.error('Challenge error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/games/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.*,
              wa.name AS white_name, ba.name AS black_name
       FROM games g
       JOIN agents wa ON g.white_id = wa.id
       JOIN agents ba ON g.black_id = ba.id
       WHERE g.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Game not found' });
    }

    const game = result.rows[0];

    // Calculate live time remaining for the active player
    let whiteTimeMs = parseInt(game.white_time_ms);
    let blackTimeMs = parseInt(game.black_time_ms);

    if (game.status === 'active' && game.turn_started_at) {
      const elapsed = getElapsedMs(game.turn_started_at);
      if (game.current_turn === 'white') {
        whiteTimeMs = Math.max(0, whiteTimeMs - elapsed);
      } else {
        blackTimeMs = Math.max(0, blackTimeMs - elapsed);
      }
    }

    res.json({
      success: true,
      game: {
        id: game.id,
        white: game.white_name,
        black: game.black_name,
        status: game.status,
        result: game.result,
        fen: game.fen,
        pgn: game.pgn,
        current_turn: game.current_turn,
        white_time_ms: whiteTimeMs,
        black_time_ms: blackTimeMs,
        created_at: game.created_at,
        updated_at: game.updated_at,
      }
    });
  } catch (err) {
    console.error('Get game error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/games/:id/move
router.post('/:id/move', authenticate, async (req, res) => {
  const { move } = req.body; // SAN or UCI, e.g. "e4", "e2e4", "Nf3"

  if (!move) {
    return res.status(400).json({ success: false, error: 'move is required' });
  }

  try {
    const result = await pool.query(
      `SELECT g.*, wa.name AS white_name, ba.name AS black_name,
              wa.webhook_url AS white_webhook, ba.webhook_url AS black_webhook,
              wa.id AS white_agent_id, ba.id AS black_agent_id,
              wa.model AS white_model, ba.model AS black_model
       FROM games g
       JOIN agents wa ON g.white_id = wa.id
       JOIN agents ba ON g.black_id = ba.id
       WHERE g.id = $1 FOR UPDATE`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Game not found' });
    }

    const game = result.rows[0];

    if (game.status !== 'active') {
      return res.status(409).json({ success: false, error: `Game is not active (status: ${game.status})` });
    }

    // Verify it's this agent's turn
    const isWhite = game.white_id === req.agent.id;
    const isBlack = game.black_id === req.agent.id;

    if (!isWhite && !isBlack) {
      return res.status(403).json({ success: false, error: 'You are not a player in this game' });
    }

    const agentColor = isWhite ? 'white' : 'black';
    if (game.current_turn !== agentColor) {
      return res.status(409).json({ success: false, error: "It's not your turn" });
    }

    // Check for timeout
    const elapsed = getElapsedMs(game.turn_started_at);
    const timeRemaining = parseInt(game.current_turn === 'white' ? game.white_time_ms : game.black_time_ms) - elapsed;

    if (timeRemaining <= 0) {
      // Agent has timed out
      const loserColor = game.current_turn;
      const resultStr = loserColor === 'white' ? 'black_wins_timeout' : 'white_wins_timeout';

      await pool.query(
        `UPDATE games SET status = 'completed', result = $1, updated_at = NOW() WHERE id = $2`,
        [resultStr, game.id]
      );

      // Update stats
      const winnerId = loserColor === 'white' ? game.black_id : game.white_id;
      const loserId = loserColor === 'white' ? game.white_id : game.black_id;
      await pool.query('UPDATE agents SET losses = losses + 1 WHERE id = $1', [loserId]);
      await pool.query('UPDATE agents SET wins = wins + 1 WHERE id = $1', [winnerId]);

      return res.status(409).json({
        success: false,
        error: 'You have run out of time. Game over.',
        result: resultStr,
      });
    }

    // Validate move with chess.js
    const chess = new Chess(game.fen);
    let moveResult;
    try {
      moveResult = chess.move(move);
    } catch (e) {
      moveResult = null;
    }

    if (!moveResult) {
      return res.status(400).json({ success: false, error: `Illegal move: ${move}` });
    }

    const newFen = chess.fen();
    const timeSpentMs = elapsed;
    const newTimeRemainingMs = Math.max(0, parseInt(game.current_turn === 'white' ? game.white_time_ms : game.black_time_ms) - timeSpentMs);

    // Count move number
    const moveCountResult = await pool.query('SELECT COUNT(*) FROM moves WHERE game_id = $1', [game.id]);
    const moveNumber = parseInt(moveCountResult.rows[0].count) + 1;

    // Insert move
    await pool.query(
      `INSERT INTO moves (game_id, agent_id, move_number, color, san, uci, fen_after, time_spent_ms, time_remaining_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [game.id, req.agent.id, moveNumber, agentColor, moveResult.san, moveResult.from + moveResult.to, newFen, timeSpentMs, newTimeRemainingMs]
    );

    // Update PGN
    const newPgn = chess.pgn();

    // Check game over conditions
    let newStatus = 'active';
    let gameResult = null;
    const nextTurn = agentColor === 'white' ? 'black' : 'white';

    if (chess.isCheckmate()) {
      newStatus = 'completed';
      gameResult = agentColor === 'white' ? 'white_wins' : 'black_wins';
    } else if (chess.isDraw()) {
      newStatus = 'completed';
      gameResult = 'draw';
    }

    // Update game state
    const whiteTimeUpdate = agentColor === 'white' ? newTimeRemainingMs : game.white_time_ms;
    const blackTimeUpdate = agentColor === 'black' ? newTimeRemainingMs : game.black_time_ms;

    await pool.query(
      `UPDATE games SET
        fen = $1, pgn = $2, current_turn = $3,
        white_time_ms = $4, black_time_ms = $5,
        turn_started_at = NOW(), status = $6, result = $7, updated_at = NOW()
       WHERE id = $8`,
      [newFen, newPgn, nextTurn, whiteTimeUpdate, blackTimeUpdate, newStatus, gameResult, game.id]
    );

    // Update agent stats if game over
    if (newStatus === 'completed') {
      if (gameResult === 'white_wins') {
        await pool.query('UPDATE agents SET wins = wins + 1 WHERE id = $1', [game.white_id]);
        await pool.query('UPDATE agents SET losses = losses + 1 WHERE id = $1', [game.black_id]);
      } else if (gameResult === 'black_wins') {
        await pool.query('UPDATE agents SET wins = wins + 1 WHERE id = $1', [game.black_id]);
        await pool.query('UPDATE agents SET losses = losses + 1 WHERE id = $1', [game.white_id]);
      } else if (gameResult === 'draw') {
        await pool.query('UPDATE agents SET draws = draws + 1 WHERE id = $1', [game.white_id]);
        await pool.query('UPDATE agents SET draws = draws + 1 WHERE id = $1', [game.black_id]);
      }
    }

    // Notify next player via webhook
    if (newStatus === 'active') {
      const nextWebhook = nextTurn === 'white' ? game.white_webhook : game.black_webhook;
      const nextModel = nextTurn === 'white' ? game.white_model : game.black_model;
      if (nextWebhook) {
        notifyAgent({ webhook_url: nextWebhook, model: nextModel }, game.id, nextTurn);
      }
    }

    res.json({
      success: true,
      message: newStatus === 'completed' ? `Game over: ${gameResult}` : 'Move accepted ♟️',
      move: moveResult.san,
      fen: newFen,
      game_status: newStatus,
      result: gameResult,
      your_time_remaining_ms: newTimeRemainingMs,
      is_check: chess.inCheck(),
    });
  } catch (err) {
    console.error('Move error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/games/:id/resign
router.post('/:id/resign', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM games WHERE id = $1 AND status = $2 FOR UPDATE',
      [req.params.id, 'active']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Active game not found' });
    }

    const game = result.rows[0];
    const isWhite = game.white_id === req.agent.id;
    const isBlack = game.black_id === req.agent.id;

    if (!isWhite && !isBlack) {
      return res.status(403).json({ success: false, error: 'You are not a player in this game' });
    }

    const resignColor = isWhite ? 'white' : 'black';
    const gameResult = resignColor === 'white' ? 'black_wins_resignation' : 'white_wins_resignation';

    await pool.query(
      `UPDATE games SET status = 'completed', result = $1, updated_at = NOW() WHERE id = $2`,
      [gameResult, game.id]
    );

    const winnerId = resignColor === 'white' ? game.black_id : game.white_id;
    await pool.query('UPDATE agents SET wins = wins + 1 WHERE id = $1', [winnerId]);
    await pool.query('UPDATE agents SET losses = losses + 1 WHERE id = $1', [req.agent.id]);

    res.json({ success: true, message: 'You resigned. Better luck next time.', result: gameResult });
  } catch (err) {
    console.error('Resign error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/games/:id/moves
router.get('/:id/moves', async (req, res) => {
  try {
    const moves = await pool.query(
      `SELECT m.move_number, m.color, m.san, m.uci, m.time_spent_ms, m.time_remaining_ms, m.fen_after, m.created_at
       FROM moves m WHERE m.game_id = $1 ORDER BY m.move_number ASC`,
      [req.params.id]
    );
    res.json({ success: true, moves: moves.rows });
  } catch (err) {
    console.error('Moves error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/feed
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const result = await pool.query(
      `SELECT g.id, g.status, g.result, g.created_at, g.updated_at,
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
    console.error('Feed error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
