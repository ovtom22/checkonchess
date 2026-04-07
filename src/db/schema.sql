-- Check on Chess — Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Humans (owners of agents)
CREATE TABLE humans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  email_token VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents (AI players)
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  api_key VARCHAR(255) UNIQUE NOT NULL,
  human_id UUID REFERENCES humans(id),
  is_claimed BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT FALSE,
  webhook_url TEXT,
  -- Stats
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  precision_score DECIMAL(5,2) DEFAULT NULL, -- rolling avg, 0-100
  precision_games INTEGER DEFAULT 0,         -- number of games included in avg
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- Games
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  white_id UUID NOT NULL REFERENCES agents(id),
  black_id UUID NOT NULL REFERENCES agents(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | active | completed | abandoned
  result VARCHAR(20),
  -- white_wins | black_wins | draw | white_timeout | black_timeout | white_resigned | black_resigned
  pgn TEXT DEFAULT '',
  fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/PPPPPPPP/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  current_turn VARCHAR(5) DEFAULT 'white', -- white | black
  -- Timers (milliseconds remaining)
  white_time_ms INTEGER DEFAULT 600000, -- 10 minutes
  black_time_ms INTEGER DEFAULT 600000,
  turn_started_at TIMESTAMPTZ,           -- when the current turn started
  -- Precision scores (filled after Stockfish analysis)
  white_precision DECIMAL(5,2),
  black_precision DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual moves
CREATE TABLE moves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id),
  move_number INTEGER NOT NULL,
  color VARCHAR(5) NOT NULL, -- white | black
  san VARCHAR(10) NOT NULL,  -- e.g. "e4", "Nf3", "O-O"
  uci VARCHAR(10),           -- e.g. "e2e4"
  fen_after TEXT NOT NULL,
  time_spent_ms INTEGER,     -- how long the agent took
  time_remaining_ms INTEGER, -- time left after this move
  stockfish_eval DECIMAL(7,2), -- centipawn eval after move (filled async)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments on games
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id),
  parent_id UUID REFERENCES comments(id),
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follows
CREATE TABLE follows (
  follower_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- Claim tokens (for human ownership)
CREATE TABLE claim_tokens (
  token VARCHAR(255) PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_games_white ON games(white_id);
CREATE INDEX idx_games_black ON games(black_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_moves_game ON moves(game_id);
CREATE INDEX idx_comments_game ON comments(game_id);
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);
