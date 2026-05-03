/// Stockfish chess engine service (UCI via stockfish npm package)
'use strict';

const initEngine = require('stockfish');

let engineReady = null;

function getEngine() {
  if (!engineReady) {
    engineReady = initEngine('lite-single').then((engine) => {
      engine.sendCommand('uci');
      engine.sendCommand('isready');
      return engine;
    });
  }
  return engineReady;
}

/**
 * Get best move from Stockfish for a given FEN.
 * @param {string} fen - Chess position in FEN notation
 * @param {number} moveTimeMs - Time to think in milliseconds (default 1500ms)
 * @returns {Promise<string|null>} UCI move string (e.g. "e2e4") or null on failure
 */
function getBestMove(fen, moveTimeMs = 1500) {
  return new Promise(async (resolve, reject) => {
    let engine;
    try {
      engine = await getEngine();
    } catch (err) {
      return reject(err);
    }

    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        engine.print = null;
        reject(new Error('Stockfish timeout'));
      }
    }, moveTimeMs + 5000);

    engine.print = function (line) {
      if (typeof line === 'string' && line.startsWith('bestmove') && !settled) {
        settled = true;
        clearTimeout(timeout);
        engine.print = null;
        const parts = line.split(' ');
        const move = parts[1];
        resolve(move && move !== '(none)' ? move : null);
      }
    };

    engine.sendCommand(`position fen ${fen}`);
    engine.sendCommand(`go movetime ${moveTimeMs}`);
  });
}

/**
 * Get top N moves from Stockfish using MultiPV.
 * Returns array of { uci, eval } sorted best-first.
 * @param {string} fen
 * @param {number} count - Number of top moves to return (default 3)
 * @param {number} moveTimeMs - Think time (default 1200ms)
 * @returns {Promise<Array<{uci: string, eval: number}>>}
 */
function getTopMoves(fen, count = 3, moveTimeMs = 1200) {
  return new Promise(async (resolve, reject) => {
    let engine;
    try {
      engine = await getEngine();
    } catch (err) {
      return reject(err);
    }

    const moves = new Map(); // multipv index → {uci, eval}
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      engine.print = null;
      // Reset MultiPV to 1 for subsequent calls
      engine.sendCommand('setoption name MultiPV value 1');
      const result = Array.from(moves.values())
        .sort((a, b) => b.eval - a.eval)
        .slice(0, count);
      resolve(result);
    };

    const timeout = setTimeout(finish, moveTimeMs + 6000);

    engine.print = function (line) {
      if (typeof line !== 'string') return;

      if (line.startsWith('bestmove')) {
        clearTimeout(timeout);
        finish();
        return;
      }

      // Parse: info depth N multipv M score cp X pv <uci> ...
      if (line.startsWith('info') && line.includes(' multipv ') && line.includes(' pv ')) {
        const mpvMatch = line.match(/multipv (\d+)/);
        const pvMatch = line.match(/ pv (\S+)/);
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);

        if (mpvMatch && pvMatch) {
          const idx = parseInt(mpvMatch[1]);
          const uci = pvMatch[1];
          let evalScore = 0;
          if (cpMatch) evalScore = parseInt(cpMatch[1]);
          else if (mateMatch) evalScore = parseInt(mateMatch[1]) > 0 ? 30000 : -30000;
          moves.set(idx, { uci, eval: evalScore });
        }
      }
    };

    engine.sendCommand(`setoption name MultiPV value ${count}`);
    engine.sendCommand(`position fen ${fen}`);
    engine.sendCommand(`go movetime ${moveTimeMs}`);
  });
}

/**
 * Evaluate a position and return centipawn score (from white's perspective).
 * @param {string} fen
 * @param {number} moveTimeMs
 * @returns {Promise<number>} Centipawn score (positive = white advantage)
 */
function evaluatePosition(fen, moveTimeMs = 500) {
  return new Promise(async (resolve) => {
    let engine;
    try {
      engine = await getEngine();
    } catch {
      return resolve(0);
    }

    let settled = false;
    let lastEval = 0;

    const timeout = setTimeout(() => {
      if (!settled) { settled = true; engine.print = null; resolve(lastEval); }
    }, moveTimeMs + 4000);

    engine.print = function (line) {
      if (typeof line !== 'string') return;

      if (line.startsWith('bestmove') && !settled) {
        settled = true;
        clearTimeout(timeout);
        engine.print = null;
        resolve(lastEval);
        return;
      }

      if (line.startsWith('info')) {
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        if (cpMatch) lastEval = parseInt(cpMatch[1]);
        else if (mateMatch) lastEval = parseInt(mateMatch[1]) > 0 ? 30000 : -30000;
      }
    };

    engine.sendCommand(`setoption name MultiPV value 1`);
    engine.sendCommand(`position fen ${fen}`);
    engine.sendCommand(`go movetime ${moveTimeMs}`);
  });
}

module.exports = { getBestMove, getTopMoves, evaluatePosition };
