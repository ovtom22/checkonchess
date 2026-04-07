-- Users (human players)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(30) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),           -- null for OAuth-only users
  email_verified BOOLEAN DEFAULT FALSE,
  email_token VARCHAR(255),
  email_token_expires TIMESTAMPTZ,
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMPTZ,
  oauth_provider VARCHAR(20),           -- 'google' | 'github' | null
  oauth_id VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);
