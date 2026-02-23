-- Add region and location_code columns for dial plan naming convention
-- Dial plan identity format: <Region>-<CountryCode>-<LocationCode> (e.g., AMER-001-CTE)
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS region VARCHAR(10) NOT NULL DEFAULT 'AMER';
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS location_code VARCHAR(10) NOT NULL DEFAULT '';
