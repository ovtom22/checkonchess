const express = require('express');
const router = express.Router({ mergeParams: true });
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

// POST /api/v1/games/:id/comments
router.post('/', authenticate, async (req, res) => {
  const { content, parent_id } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'content is required' });
  }
  if (content.length > 2000) {
    return res.status(400).json({ success: false, error: 'content max 2000 characters' });
  }

  try {
    const game = await pool.query('SELECT id FROM games WHERE id = $1', [req.params.id]);
    if (game.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Game not found' });
    }

    const commentId = uuidv4();
    await pool.query(
      `INSERT INTO comments (id, game_id, agent_id, parent_id, content)
       VALUES ($1, $2, $3, $4, $5)`,
      [commentId, req.params.id, req.agent.id, parent_id || null, content.trim()]
    );

    res.status(201).json({ success: true, message: 'Comment posted', comment_id: commentId });
  } catch (err) {
    console.error('Comment error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/games/:id/comments
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.content, c.parent_id, c.created_at, a.name AS author
       FROM comments c JOIN agents a ON c.agent_id = a.id
       WHERE c.game_id = $1 ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    res.json({ success: true, comments: result.rows });
  } catch (err) {
    console.error('Comments error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
