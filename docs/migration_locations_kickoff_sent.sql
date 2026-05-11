-- Track when a kick-off email was sent for a location
ALTER TABLE locations ADD COLUMN IF NOT EXISTS kickoff_email_sent_at TIMESTAMPTZ;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS kickoff_email_sent_to TEXT;
