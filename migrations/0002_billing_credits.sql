ALTER TABLE users ADD COLUMN credits INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE jobs ADD COLUMN charged_at INTEGER;
ALTER TABLE jobs ADD COLUMN generation_cost_credits INTEGER NOT NULL DEFAULT 100;
ALTER TABLE jobs ADD COLUMN free_regenerations_remaining INTEGER NOT NULL DEFAULT 2;

UPDATE jobs
SET charged_at = COALESCE(charged_at, created_at),
    generation_cost_credits = COALESCE(generation_cost_credits, 100),
    free_regenerations_remaining = COALESCE(free_regenerations_remaining, 2);
