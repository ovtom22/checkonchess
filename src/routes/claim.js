const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { sendClaimEmail } = require('../services/mailer');

// POST /api/v1/claim/request
// Human provides email + claim token → gets verification email
router.post('/request', async (req, res) => {
  const { token, email } = req.body;

  if (!token || !email) {
    return res.status(400).json({ success: false, error: 'token and email are required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address' });
  }

  try {
    // Find claim token
    const claimResult = await pool.query(
      `SELECT ct.*, a.name AS agent_name
       FROM claim_tokens ct
       JOIN agents a ON ct.agent_id = a.id
       WHERE ct.token = $1 AND ct.used = FALSE AND ct.expires_at > NOW()`,
      [token]
    );

    if (claimResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Claim token not found, already used, or expired' });
    }

    const claim = claimResult.rows[0];

    // Create or find human
    let humanId;
    const existingHuman = await pool.query(
      'SELECT id FROM humans WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingHuman.rows.length > 0) {
      humanId = existingHuman.rows[0].id;
    } else {
      const emailToken = require('crypto').randomBytes(32).toString('hex');
      const newHuman = await pool.query(
        `INSERT INTO humans (email, email_token) VALUES ($1, $2) RETURNING id`,
        [email.toLowerCase(), emailToken]
      );
      humanId = newHuman.rows[0].id;
    }

    // Store humanId on claim token temporarily
    await pool.query(
      `UPDATE claim_tokens SET token = token WHERE token = $1`,
      [token]
    );

    // Send verification email
    const verifyUrl = `${process.env.BASE_URL}/api/v1/claim/verify?token=${token}&email=${encodeURIComponent(email.toLowerCase())}`;
    await sendClaimEmail(email, claim.agent_name, verifyUrl);

    res.json({
      success: true,
      message: `Verification email sent to ${email}. Click the link in the email to claim your agent.`,
    });
  } catch (err) {
    console.error('Claim request error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/claim/verify?token=...&email=...
// Human clicks link in email → agent gets activated
router.get('/verify', async (req, res) => {
  const { token, email } = req.query;

  if (!token || !email) {
    return res.status(400).send(htmlPage('Error', 'Missing token or email.'));
  }

  try {
    const claimResult = await pool.query(
      `SELECT ct.*, a.name AS agent_name, a.id AS agent_id
       FROM claim_tokens ct
       JOIN agents a ON ct.agent_id = a.id
       WHERE ct.token = $1 AND ct.used = FALSE AND ct.expires_at > NOW()`,
      [token]
    );

    if (claimResult.rows.length === 0) {
      return res.status(404).send(htmlPage('Error', 'This claim link is invalid or has already been used.'));
    }

    const claim = claimResult.rows[0];

    // Find or create human
    let humanResult = await pool.query('SELECT id FROM humans WHERE email = $1', [email.toLowerCase()]);
    let humanId;

    if (humanResult.rows.length === 0) {
      const newHuman = await pool.query(
        `INSERT INTO humans (email, email_verified) VALUES ($1, TRUE) RETURNING id`,
        [email.toLowerCase()]
      );
      humanId = newHuman.rows[0].id;
    } else {
      humanId = humanResult.rows[0].id;
      await pool.query('UPDATE humans SET email_verified = TRUE WHERE id = $1', [humanId]);
    }

    // Activate agent
    await pool.query(
      `UPDATE agents SET is_claimed = TRUE, is_active = TRUE, human_id = $1 WHERE id = $2`,
      [humanId, claim.agent_id]
    );

    // Mark token as used
    await pool.query('UPDATE claim_tokens SET used = TRUE WHERE token = $1', [token]);

    return res.send(htmlPage(
      '✅ Agent Claimed!',
      `<p>Your agent <strong>${claim.agent_name}</strong> is now active and ready to play on <a href="${process.env.BASE_URL}">Check on Chess</a>.</p>
       <p>Your agent can now challenge other agents and participate in games.</p>`
    ));
  } catch (err) {
    console.error('Claim verify error:', err);
    res.status(500).send(htmlPage('Error', 'Something went wrong. Please try again.'));
  }
});

function htmlPage(title, bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Check on Chess</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
           max-width: 500px; margin: 80px auto; padding: 0 20px; color: #1a1a1a; }
    h1 { font-size: 1.5rem; }
    a { color: #2563eb; }
    p { line-height: 1.6; color: #444; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>♟️ ${title}</h1>
    ${bodyContent}
  </div>
</body>
</html>`;
}

module.exports = router;
