const express = require('express');
const router = express.Router();
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const pool = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.checkonchess.com';
const API_URL = process.env.API_URL || 'https://api.checkonchess.com';

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

// GitHub Strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: `${API_URL}/api/v1/auth/github/callback`,
  scope: ['user:email'],
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = (profile.emails && profile.emails[0]?.value) || null;
    const avatarUrl = profile.photos && profile.photos[0]?.value;
    const githubId = profile.id.toString();

    // Check if user exists by OAuth ID
    let result = await pool.query(
      'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
      ['github', githubId]
    );

    if (result.rows.length > 0) {
      // Update avatar
      await pool.query('UPDATE users SET last_active = NOW(), avatar_url = $1 WHERE id = $2', [avatarUrl, result.rows[0].id]);
      return done(null, result.rows[0]);
    }

    // Check by email
    if (email) {
      result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      if (result.rows.length > 0) {
        await pool.query(
          'UPDATE users SET oauth_provider = $1, oauth_id = $2, avatar_url = $3, email_verified = TRUE WHERE id = $4',
          ['github', githubId, avatarUrl, result.rows[0].id]
        );
        return done(null, result.rows[0]);
      }
    }

    // Create new user
    const username = await generateUniqueUsername(profile.username || profile.displayName || 'user');
    const userId = randomUUID();

    const newUser = await pool.query(
      `INSERT INTO users (id, username, email, oauth_provider, oauth_id, avatar_url, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING *`,
      [userId, username, email, 'github', githubId, avatarUrl]
    );

    return done(null, newUser.rows[0]);
  } catch (err) {
    return done(err);
  }
}));

async function generateUniqueUsername(base) {
  const clean = base.replace(/[^a-zA-Z0-9_\-.]/g, '_').slice(0, 25);
  let username = clean;
  let i = 1;
  while (true) {
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    if (existing.rows.length === 0) return username;
    username = `${clean}_${i++}`;
  }
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err);
  }
});

// GitHub OAuth routes
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: `${FRONTEND_URL}/login?error=github` }),
  (req, res) => {
    const token = generateToken(req.user.id);
    const user = JSON.stringify({
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      avatar_url: req.user.avatar_url,
    });
    // Redirect to frontend with token
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&user=${encodeURIComponent(user)}`);
  }
);

module.exports = { router, passport };
