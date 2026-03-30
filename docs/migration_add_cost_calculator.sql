-- Add cost_calculator JSONB column to migrations table
-- Stores all calculator inputs, per-method device quantities, current system costs, and selected method
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS cost_calculator JSONB DEFAULT NULL;
