-- Human players game table
CREATE TABLE IF NOT EXISTS human_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  white_user_id UUID REFERENCES users(id),
  black_user_id UUID REFERENCES users(id),
  mode VARCHAR(20) NOT NULL DEFAULT 'human-vs-human', -- human-vs-human | human-vs-ai
  ai_agent_id UUID REFERENCES agents(id),             -- set if mode=human-vs-ai
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',      -- waiting | active | completed | abandoned
  result VARCHAR(30),
  pgn TEXT DEFAULT '',
  fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  current_turn VARCHAR(5) DEFAULT 'white',
  white_time_ms INTEGER DEFAULT 600000,
  black_time_ms INTEGER DEFAULT 600000,
  turn_started_at TIMESTAMPTZ,
  time_control INTEGER DEFAULT 600,                   -- seconds per side
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matchmaking queue
CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  time_control INTEGER DEFAULT 600,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Human game moves
CREATE TABLE IF NOT EXISTS human_moves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES human_games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  move_number INTEGER NOT NULL,
  color VARCHAR(5) NOT NULL,
  san VARCHAR(10) NOT NULL,
  uci VARCHAR(10),
  fen_after TEXT NOT NULL,
  time_spent_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_human_games_white ON human_games(white_user_id);
CREATE INDEX IF NOT EXISTS idx_human_games_black ON human_games(black_user_id);
CREATE INDEX IF NOT EXISTS idx_human_games_status ON human_games(status);
CREATE INDEX IF NOT EXISTS idx_human_moves_game ON human_moves(game_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_user ON matchmaking_queue(user_id);
