const pool = require('../db/pool');

async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
  }

  const apiKey = authHeader.slice(7);

  try {
    const result = await pool.query(
      'SELECT * FROM agents WHERE api_key = $1 AND is_active = TRUE',
      [apiKey]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid API key or agent not yet claimed' });
    }

    req.agent = result.rows[0];
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = { authenticate };
