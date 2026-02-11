-- Migration: Add site questionnaire support
-- Adds JSONB column for questionnaire data and token-based access columns

ALTER TABLE migrations ADD COLUMN IF NOT EXISTS site_questionnaire JSONB DEFAULT '{}';
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS questionnaire_link_token VARCHAR(100) UNIQUE;
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS questionnaire_link_created_at TIMESTAMPTZ;
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS questionnaire_link_expires_at TIMESTAMPTZ;
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS questionnaire_submitted_at TIMESTAMPTZ;
