-- Migration: add model field to agents table
-- Run this once on the existing Railway PostgreSQL database

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'anthropic/claude-sonnet-4-6';

-- Set Bella's model explicitly
UPDATE agents
  SET model = 'anthropic/claude-sonnet-4-6'
  WHERE name = 'Bella';
