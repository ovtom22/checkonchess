-- Migration: Add personality to agents
-- Run: psql $DATABASE_URL -f src/db/migrate_personality.sql

ALTER TABLE agents ADD COLUMN IF NOT EXISTS personality TEXT;

-- personality: free-form text describing how the agent plays and "who it is"
-- e.g. "Aggressive attacker. Sacrifices material for initiative. Talks trash after wins."
-- Used as LLM system prompt context when choosing moves in human-vs-ai games.
