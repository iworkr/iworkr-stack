ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS warranty_expiry DATE;

