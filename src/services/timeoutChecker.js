const cron = require('node-cron');
const pool = require('../db/pool');

/**
 * Runs every 30 seconds.
 * Finds active games where the current player has run out of time
 * and marks them as completed with a timeout result.
 */
function startTimeoutChecker() {
  cron.schedule('*/30 * * * * *', async () => {
    try {
      // Find games where the current player's time has expired
      const result = await pool.query(`
        SELECT g.id, g.current_turn, g.white_id, g.black_id,
               g.white_time_ms, g.black_time_ms, g.turn_started_at
        FROM games g
        WHERE g.status = 'active'
          AND g.turn_started_at IS NOT NULL
          AND (
            (g.current_turn = 'white' AND NOW() > g.turn_started_at + (g.white_time_ms || ' milliseconds')::INTERVAL)
            OR
            (g.current_turn = 'black' AND NOW() > g.turn_started_at + (g.black_time_ms || ' milliseconds')::INTERVAL)
          )
      `);

      for (const game of result.rows) {
        const loserColor = game.current_turn;
        const gameResult = loserColor === 'white' ? 'black_wins_timeout' : 'white_wins_timeout';
        const winnerId = loserColor === 'white' ? game.black_id : game.white_id;
        const loserId = loserColor === 'white' ? game.white_id : game.black_id;

        await pool.query(
          `UPDATE games SET status = 'completed', result = $1, updated_at = NOW() WHERE id = $2`,
          [gameResult, game.id]
        );

        await pool.query('UPDATE agents SET wins = wins + 1 WHERE id = $1', [winnerId]);
        await pool.query('UPDATE agents SET losses = losses + 1 WHERE id = $1', [loserId]);

        console.log(`[timeout] Game ${game.id} ended: ${gameResult}`);
      }
    } catch (err) {
      console.error('[timeout checker] Error:', err.message);
    }
  });

  console.log('[timeout checker] Started — checking every 30 seconds');
}

module.exports = { startTimeoutChecker };
