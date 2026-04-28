const cron = require('node-cron');
const pool = require('../db/pool');

/**
 * Runs every 30 seconds.
 * Finds active games where the current player has run out of time
 * and marks them as completed with a timeout result.
 * Covers both agent-vs-agent (games) and human-vs-ai (human_games).
 */
function startTimeoutChecker() {
  cron.schedule('*/30 * * * * *', async () => {
    try {
      // --- Agent vs Agent games ---
      const agentResult = await pool.query(`
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

      for (const game of agentResult.rows) {
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
        console.log(`[timeout] Agent game ${game.id} ended: ${gameResult}`);
      }

      // --- Human vs AI games ---
      const humanResult = await pool.query(`
        SELECT hg.id, hg.current_turn,
               hg.white_user_id, hg.black_user_id, hg.ai_agent_id,
               hg.white_time_ms, hg.black_time_ms, hg.turn_started_at
        FROM human_games hg
        WHERE hg.status = 'active'
          AND hg.turn_started_at IS NOT NULL
          AND (
            (hg.current_turn = 'white' AND NOW() > hg.turn_started_at + (hg.white_time_ms || ' milliseconds')::INTERVAL)
            OR
            (hg.current_turn = 'black' AND NOW() > hg.turn_started_at + (hg.black_time_ms || ' milliseconds')::INTERVAL)
          )
      `);

      for (const game of humanResult.rows) {
        const loserColor = game.current_turn;
        const gameResult = loserColor === 'white' ? 'black_wins_timeout' : 'white_wins_timeout';

        await pool.query(
          `UPDATE human_games SET status = 'completed', result = $1, updated_at = NOW() WHERE id = $2`,
          [gameResult, game.id]
        );

        // Update agent stats if the AI lost or won
        if (game.ai_agent_id) {
          const aiIsWhite = game.white_user_id === null;
          const aiIsBlack = game.black_user_id === null;
          const aiLost = (aiIsWhite && loserColor === 'white') || (aiIsBlack && loserColor === 'black');
          const aiWon  = (aiIsWhite && loserColor === 'black') || (aiIsBlack && loserColor === 'white');
          if (aiLost) await pool.query('UPDATE agents SET losses = losses + 1 WHERE id = $1', [game.ai_agent_id]);
          else if (aiWon) await pool.query('UPDATE agents SET wins = wins + 1 WHERE id = $1', [game.ai_agent_id]);
        }

        // Broadcast game over to WebSocket room
        const { broadcast } = require('./websocket');
        broadcast(game.id, { type: 'timeout', result: gameResult });

        console.log(`[timeout] Human game ${game.id} ended: ${gameResult}`);
      }
    } catch (err) {
      console.error('[timeout checker] Error:', err.message);
    }
  });

  console.log('[timeout checker] Started — checking every 30 seconds');
}

module.exports = { startTimeoutChecker };
