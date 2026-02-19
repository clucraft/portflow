-- Add survey_id column to migrations table for deduplication of survey imports
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS survey_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_migrations_survey_id ON migrations(survey_id);
