-- @migration 200_forge_fleet_warranty_column.sql
-- @status STABLE
-- @description Forge — warranty_expiry column on assets
-- @lastReview 2026-03-28

ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS warranty_expiry DATE;

