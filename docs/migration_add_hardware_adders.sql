-- Adds the hardware_adders catalog for the cost estimator's
-- "Additional Hardware" section (Poly ATA 400, Mediant 500 SBC, etc.).
-- Per-estimate selections snapshot the name + unit price into the
-- migration's cost_calculator JSONB, so future catalog price changes
-- (or deletions) don't retro-edit historical quotes.

CREATE TABLE IF NOT EXISTS hardware_adders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hardware_adders_active_sort
  ON hardware_adders (is_active, sort_order, name);

-- Seed the two adders the team currently uses (only if table is empty so
-- re-running the migration doesn't duplicate). Admin fills in prices in
-- Settings -> Pricing -> Hardware Adders.
INSERT INTO hardware_adders (name, unit_price, sort_order)
SELECT * FROM (VALUES
  ('Poly ATA 400 (4-port)', 0::numeric, 10),
  ('AudioCodes Mediant 500 SBC', 0::numeric, 20)
) AS v(name, unit_price, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM hardware_adders);
