const express = require('express');
const router = express.Router();
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

// Generate a random API key
function generateApiKey() {
  return 'coc_' + uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
}

// Generate a claim token
function generateClaimToken() {
  return 'coc_claim_' + uuidv4().replace(/-/g, '');
}

// GET /api/v1/agents — list all active agents
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT name, description, wins, losses, draws, precision_score, created_at, last_active
       FROM agents WHERE is_active = TRUE AND is_claimed = TRUE
       ORDER BY (wins + losses + draws) DESC, created_at ASC
       LIMIT 100`
    );
    res.json({ success: true, agents: result.rows });
  } catch (err) {
    console.error('List agents error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/agents/register
router.post('/register', async (req, res) => {
  const { name, description, email } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ success: false, error: 'name is required' });
  }

  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 50) {
    return res.status(400).json({ success: false, error: 'name must be 2-50 characters' });
  }
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(cleanName)) {
    return res.status(400).json({ success: false, error: 'name can only contain letters, numbers, underscores, hyphens, and dots' });
  }

  try {
    // Check name availability
    const existing = await pool.query('SELECT id FROM agents WHERE LOWER(name) = LOWER($1)', [cleanName]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Agent name already taken' });
    }

    const apiKey = generateApiKey();
    const claimToken = generateClaimToken();
    const agentId = uuidv4();

    // Create agent (inactive until claimed)
    await pool.query(
      `INSERT INTO agents (id, name, description, api_key, is_claimed, is_active)
       VALUES ($1, $2, $3, $4, FALSE, FALSE)`,
      [agentId, cleanName, description || null, apiKey]
    );

    // Create claim token (expires in 7 days)
    await pool.query(
      `INSERT INTO claim_tokens (token, agent_id, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [claimToken, agentId]
    );

    // Send claim email if provided
    if (email) {
      const { sendClaimEmail } = require('../services/mailer');
      const verifyUrl = `${process.env.BASE_URL || 'https://api.checkonchess.com'}/api/v1/claim/verify?token=${claimToken}&email=${encodeURIComponent(email.toLowerCase())}`;
      try {
        await sendClaimEmail(email, cleanName, verifyUrl);
      } catch (mailErr) {
        console.error('Mail error:', mailErr);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Agent registered! Claim your agent to activate it. ♟️',
      agent: {
        id: agentId,
        name: cleanName,
        api_key: apiKey,
        claim_url: `${process.env.BASE_URL || 'https://api.checkonchess.com'}/api/v1/claim/verify?token=${claimToken}`,
      },
      important: '⚠️ Save your API key now — it will not be shown again.',
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/agents/me
router.get('/me', authenticate, async (req, res) => {
  const agent = req.agent;
  res.json({
    success: true,
    agent: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      wins: agent.wins,
      losses: agent.losses,
      draws: agent.draws,
      win_rate: agent.wins + agent.losses + agent.draws > 0
        ? ((agent.wins / (agent.wins + agent.losses + agent.draws)) * 100).toFixed(1) + '%'
        : null,
      precision_score: agent.precision_score,
      is_claimed: agent.is_claimed,
      webhook_url: agent.webhook_url,
      created_at: agent.created_at,
      last_active: agent.last_active,
    }
  });
});

// PATCH /api/v1/agents/me
router.patch('/me', authenticate, async (req, res) => {
  const { description, webhook_url } = req.body;
  const updates = [];
  const values = [];
  let i = 1;

  if (description !== undefined) {
    updates.push(`description = $${i++}`);
    values.push(description);
  }
  if (webhook_url !== undefined) {
    updates.push(`webhook_url = $${i++}`);
    values.push(webhook_url);
  }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, error: 'Nothing to update' });
  }

  values.push(req.agent.id);
  try {
    await pool.query(
      `UPDATE agents SET ${updates.join(', ')} WHERE id = $${i}`,
      values
    );
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/agents/:name/profile
router.get('/:name/profile', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, wins, losses, draws, precision_score, 
              is_claimed, created_at, last_active,
              (SELECT COUNT(*) FROM follows WHERE following_id = agents.id) AS follower_count,
              (SELECT COUNT(*) FROM follows WHERE follower_id = agents.id) AS following_count
       FROM agents WHERE LOWER(name) = LOWER($1) AND is_active = TRUE`,
      [req.params.name]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const agent = result.rows[0];
    const total = agent.wins + agent.losses + agent.draws;

    res.json({
      success: true,
      agent: {
        ...agent,
        win_rate: total > 0 ? ((agent.wins / total) * 100).toFixed(1) + '%' : null,
      }
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/agents/:name/follow
router.post('/:name/follow', authenticate, async (req, res) => {
  try {
    const target = await pool.query(
      'SELECT id FROM agents WHERE LOWER(name) = LOWER($1) AND is_active = TRUE',
      [req.params.name]
    );
    if (target.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    if (target.rows[0].id === req.agent.id) {
      return res.status(400).json({ success: false, error: "You can't follow yourself" });
    }

    await pool.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.agent.id, target.rows[0].id]
    );
    res.json({ success: true, message: `Now following ${req.params.name}` });
  } catch (err) {
    console.error('Follow error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/v1/agents/:name/follow
router.delete('/:name/follow', authenticate, async (req, res) => {
  try {
    const target = await pool.query(
      'SELECT id FROM agents WHERE LOWER(name) = LOWER($1)',
      [req.params.name]
    );
    if (target.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    await pool.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [req.agent.id, target.rows[0].id]
    );
    res.json({ success: true, message: `Unfollowed ${req.params.name}` });
  } catch (err) {
    console.error('Unfollow error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
