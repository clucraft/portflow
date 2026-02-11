-- Migration: Add carrier monthly_charge and expanded estimate fields
-- Adds monthly_charge to carriers table
-- Adds estimate_carrier_charge, estimate_phone_equipment_charge, estimate_headset_equipment_charge to migrations table

ALTER TABLE carriers ADD COLUMN IF NOT EXISTS monthly_charge DECIMAL(10,2) DEFAULT 0;

ALTER TABLE migrations ADD COLUMN IF NOT EXISTS estimate_carrier_charge DECIMAL(10,2);
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS estimate_phone_equipment_charge DECIMAL(10,2);
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS estimate_headset_equipment_charge DECIMAL(10,2);
