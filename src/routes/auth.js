const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const pool = require('../db/pool');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.checkonchess.com';

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

// POST /api/v1/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: 'username, email and password are required' });
  }

  const cleanUsername = username.trim();
  if (cleanUsername.length < 2 || cleanUsername.length > 30) {
    return res.status(400).json({ success: false, error: 'Username must be 2-30 characters' });
  }
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(cleanUsername)) {
    return res.status(400).json({ success: false, error: 'Username can only contain letters, numbers, underscores, hyphens, dots' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
  }

  try {
    // Check uniqueness
    const existing = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2)',
      [email, cleanUsername]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Email or username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const emailToken = randomUUID();
    const userId = randomUUID();

    await pool.query(
      `INSERT INTO users (id, username, email, password_hash, email_token, email_token_expires)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '24 hours')`,
      [userId, cleanUsername, email.toLowerCase(), passwordHash, emailToken]
    );

    // Send verification email
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${emailToken}`;
    try {
      await sendVerificationEmail(email, verifyUrl);
    } catch (mailErr) {
      console.error('Mail error:', mailErr);
    }

    res.status(201).json({
      success: true,
      message: 'Account created! Please check your email to verify your address.',
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ success: false, error: 'This account uses social login. Please sign in with Google or GitHub.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    if (!user.email_verified) {
      return res.status(403).json({ success: false, error: 'Please verify your email first. Check your inbox.' });
    }

    await pool.query('UPDATE users SET last_active = NOW() WHERE id = $1', [user.id]);

    const token = generateToken(user.id);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/auth/verify-email?token=xxx
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ success: false, error: 'Missing token' });

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email_token = $1 AND email_token_expires > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.redirect(`${FRONTEND_URL}/verify-email?error=invalid`);
    }

    await pool.query(
      'UPDATE users SET email_verified = TRUE, email_token = NULL, email_token_expires = NULL WHERE id = $1',
      [result.rows[0].id]
    );

    const jwtToken = generateToken(result.rows[0].id);
    res.redirect(`${FRONTEND_URL}/verify-email?success=true&token=${jwtToken}`);
  } catch (err) {
    console.error('Verify error:', err);
    res.redirect(`${FRONTEND_URL}/verify-email?error=server`);
  }
});

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);

    // Always return success (don't reveal if email exists)
    if (result.rows.length > 0) {
      const resetToken = randomUUID();
      await pool.query(
        'UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL \'1 hour\' WHERE id = $2',
        [resetToken, result.rows[0].id]
      );
      const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
      try {
        await sendPasswordResetEmail(email, resetUrl);
      } catch (mailErr) {
        console.error('Mail error:', mailErr);
      }
    }

    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ success: false, error: 'token and password are required' });
  if (password.length < 8) return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [passwordHash, result.rows[0].id]
    );

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/v1/auth/me
router.get('/me', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query('SELECT id, username, email, avatar_url, email_verified FROM users WHERE id = $1', [decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

module.exports = router;
