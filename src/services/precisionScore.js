'use strict';

/**
 * Post-game precision score calculation.
 *
 * After a game ends, evaluates each move with Stockfish to compute:
 * - Per-move centipawn loss vs best available move
 * - Per-side accuracy percentage (0–100)
 * - Updates moves.stockfish_eval, games.white_precision, games.black_precision
 * - Updates agents.precision_score rolling average
 *
 * Run async after game completion; never blocks the move endpoint.
 */

const pool = require('../db/pool');
const { evaluatePosition, getBestMove } = require('./stockfish');

/**
 * Convert centipawn loss to accuracy percentage.
 * Mirrors the Chess.com accuracy formula (approximate).
 *   accuracy = max(0, 103.1668 * e^(-0.04354 * winLossDelta) - 3.1668)
 * For simplicity we use a centipawn-based approximation.
 */
function cpLossToAccuracy(cpLoss) {
  if (cpLoss <= 0) return 100;
  if (cpLoss >= 300) return 0;
  // Linear interpolation: 0 loss → 100%, 300 loss → 0%
  return Math.max(0, 100 - (cpLoss / 3));
}

/**
 * Analyze a completed agent-vs-agent game and update precision scores.
 * @param {string} gameId - UUID from games table
 */
async function analyzeAgentGame(gameId) {
  try {
    const gameResult = await pool.query(
      `SELECT g.*, wa.id AS white_agent_id, ba.id AS black_agent_id,
              wa.precision_score AS white_ps, wa.precision_games AS white_pg,
              ba.precision_score AS black_ps, ba.precision_games AS black_pg
       FROM games g
       JOIN agents wa ON g.white_id = wa.id
       JOIN agents ba ON g.black_id = ba.id
       WHERE g.id = $1`,
      [gameId]
    );
    if (gameResult.rows.length === 0) return;

    const movesResult = await pool.query(
      'SELECT * FROM moves WHERE game_id = $1 ORDER BY move_number ASC',
      [gameId]
    );
    const moves = movesResult.rows;
    if (moves.length === 0) return;

    // We need the FEN BEFORE each move to evaluate alternatives.
    // Reconstruct: start from initial FEN, each move's fen_after is FEN after move.
    // FEN before move N = fen_after of move N-1 (or initial FEN for move 1).
    const { Chess } = require('chess.js');
    const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    let whiteLosses = [];
    let blackLosses = [];

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const fenBefore = i === 0 ? initialFen : moves[i - 1].fen_after;
      const fenAfter = move.fen_after;

      try {
        // Get the best move's resulting eval and the played move's resulting eval
        const [bestMove, playedEval] = await Promise.all([
          getBestMove(fenBefore, 800),
          evaluatePosition(fenAfter, 500),
        ]);

        let cpLoss = 0;
        if (bestMove && bestMove !== move.uci) {
          // Evaluate what the best move would have achieved
          const chess = new Chess(fenBefore);
          chess.move(bestMove);
          const bestEval = await evaluatePosition(chess.fen(), 500);

          // From the mover's perspective (negate if black)
          const sign = move.color === 'white' ? 1 : -1;
          const bestFromMover = sign * bestEval;
          const playedFromMover = sign * playedEval;
          cpLoss = Math.max(0, bestFromMover - playedFromMover);
        }

        const accuracy = cpLossToAccuracy(cpLoss);

        // Store eval in moves table
        await pool.query(
          'UPDATE moves SET stockfish_eval = $1 WHERE id = $2',
          [playedEval, move.id]
        );

        if (move.color === 'white') whiteLosses.push(accuracy);
        else blackLosses.push(accuracy);

      } catch (err) {
        console.error(`[precision] Error evaluating move ${move.id}:`, err.message);
      }
    }

    // Calculate game precision for each side
    const avg = arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const whitePrecision = avg(whiteLosses);
    const blackPrecision = avg(blackLosses);

    // Update game precision columns
    await pool.query(
      'UPDATE games SET white_precision = $1, black_precision = $2 WHERE id = $3',
      [whitePrecision, blackPrecision, gameId]
    );

    const game = gameResult.rows[0];

    // Update agents' rolling precision_score
    if (whitePrecision !== null) {
      await updateAgentPrecision(game.white_id, game.white_ps, game.white_pg, whitePrecision);
    }
    if (blackPrecision !== null) {
      await updateAgentPrecision(game.black_id, game.black_ps, game.black_pg, blackPrecision);
    }

    console.log(`[precision] Game ${gameId} analyzed: white=${whitePrecision?.toFixed(1)} black=${blackPrecision?.toFixed(1)}`);
  } catch (err) {
    console.error(`[precision] analyzeAgentGame(${gameId}) failed:`, err.message);
  }
}

/**
 * Analyze a completed human-vs-ai game.
 * Only calculates precision for the human player (white or black).
 * @param {string} gameId - UUID from human_games table
 * @param {string} humanColor - 'white' | 'black'
 */
async function analyzeHumanGame(gameId, humanColor) {
  try {
    const movesResult = await pool.query(
      `SELECT * FROM human_moves WHERE game_id = $1 AND color = $2 ORDER BY move_number ASC`,
      [gameId, humanColor]
    );
    if (movesResult.rows.length === 0) return;

    // Get all moves to reconstruct FENs before each human move
    const allMoves = await pool.query(
      'SELECT * FROM human_moves WHERE game_id = $1 ORDER BY move_number ASC',
      [gameId]
    );

    const { Chess } = require('chess.js');
    const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const fenByMoveNum = new Map();
    fenByMoveNum.set(0, initialFen);
    for (const m of allMoves.rows) {
      fenByMoveNum.set(m.move_number, m.fen_after);
    }

    const humanMoves = movesResult.rows;
    const accuracies = [];

    for (const move of humanMoves) {
      const fenBefore = fenByMoveNum.get(move.move_number - 1) || initialFen;
      const fenAfter = move.fen_after;

      try {
        const [bestMove, playedEval] = await Promise.all([
          getBestMove(fenBefore, 800),
          evaluatePosition(fenAfter, 500),
        ]);

        let cpLoss = 0;
        if (bestMove && bestMove !== move.uci) {
          const chess = new Chess(fenBefore);
          chess.move(bestMove);
          const bestEval = await evaluatePosition(chess.fen(), 500);
          const sign = humanColor === 'white' ? 1 : -1;
          cpLoss = Math.max(0, sign * bestEval - sign * playedEval);
        }

        accuracies.push(cpLossToAccuracy(cpLoss));
      } catch {
        // skip this move
      }
    }

    if (accuracies.length > 0) {
      const precision = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
      console.log(`[precision] Human game ${gameId} (${humanColor}): ${precision.toFixed(1)}%`);
      // Store on the human_games row for display
      const col = humanColor === 'white' ? 'white_precision' : 'black_precision';
      await pool.query(`UPDATE human_games SET ${col} = $1 WHERE id = $2`, [precision, gameId]);
    }
  } catch (err) {
    console.error(`[precision] analyzeHumanGame(${gameId}) failed:`, err.message);
  }
}

/**
 * Update an agent's rolling precision_score.
 * precision_score = rolling average over last max 50 games.
 */
async function updateAgentPrecision(agentId, currentScore, currentGames, newScore) {
  const maxGames = 50;
  const games = Math.min(currentGames || 0, maxGames - 1);
  const rolling = currentScore != null
    ? (currentScore * games + newScore) / (games + 1)
    : newScore;

  await pool.query(
    `UPDATE agents SET precision_score = $1, precision_games = $2 WHERE id = $3`,
    [rolling.toFixed(2), games + 1, agentId]
  );
}

module.exports = { analyzeAgentGame, analyzeHumanGame };
