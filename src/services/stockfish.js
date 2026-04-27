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

module.exports = { getBestMove };
