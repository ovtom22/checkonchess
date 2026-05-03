'use strict';

/**
 * LLM-powered move selection with agent personality.
 *
 * Given a chess position, a set of top candidate moves from Stockfish,
 * and the agent's personality + model, asks the LLM to pick one move
 * and optionally provide a one-sentence thought/comment.
 *
 * Returns { uci, thought } or null on failure.
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 12000;

/**
 * @param {object} opts
 * @param {string} opts.fen            - Current position FEN
 * @param {string} opts.color          - 'white' | 'black'
 * @param {Array<{uci: string, eval: number}>} opts.candidates - Top moves from Stockfish [{uci, eval}]
 * @param {string} opts.personality    - Agent personality text
 * @param {string} opts.model          - LLM model (e.g. 'anthropic/claude-sonnet-4-6')
 * @param {string} opts.agentName      - Agent name (for context)
 * @returns {Promise<{uci: string, thought: string|null}|null>}
 */
async function getLLMMove({ fen, color, candidates, personality, model, agentName }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  if (!candidates || candidates.length === 0) return null;

  // If only one candidate, just return it (no need to bother the LLM)
  if (candidates.length === 1) return { uci: candidates[0].uci, thought: null };

  const moveList = candidates
    .map((c, i) => `${i + 1}. ${c.uci}${c.eval !== undefined ? ` (eval: ${c.eval > 0 ? '+' : ''}${(c.eval / 100).toFixed(2)})` : ''}`)
    .join('\n');

  const systemPrompt = `You are ${agentName}, a chess-playing AI. Your personality: ${personality}

You are playing as ${color}. You must choose ONE of the candidate moves provided by your chess engine and respond with a JSON object.

Rules:
- Choose the move that best fits your personality and playing style
- You don't have to pick the "best" move — play like yourself
- Add a SHORT thought (max 12 words) that reveals your personality. Be concise, witty, or intimidating as fits your character.
- Respond ONLY with valid JSON: {"uci": "<move>", "thought": "<your thought>"}
- The "uci" must be exactly one of the candidate moves listed`;

  const userPrompt = `Position (FEN): ${fen}
Candidate moves (from chess engine):
${moveList}

Choose your move and share a brief thought.`;

  try {
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: null }));
    if (!fetch) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://checkonchess.com',
        'X-Title': 'CheckOnChess',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 80,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      console.error(`[llmMove] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try extracting JSON from response text
      const match = content.match(/\{[^}]+\}/);
      if (match) parsed = JSON.parse(match[0]);
      else return null;
    }

    const chosen = parsed?.uci;
    const isValid = candidates.some(c => c.uci === chosen);
    if (!isValid) {
      // LLM hallucinated a move — fall back to first candidate
      console.warn(`[llmMove] LLM returned invalid move "${chosen}", falling back to ${candidates[0].uci}`);
      return { uci: candidates[0].uci, thought: parsed?.thought || null };
    }

    return {
      uci: chosen,
      thought: parsed?.thought ? String(parsed.thought).slice(0, 100) : null,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('[llmMove] Request timed out');
    } else {
      console.error('[llmMove] Error:', err.message);
    }
    return null;
  }
}

module.exports = { getLLMMove };
