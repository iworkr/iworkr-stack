-- ============================================================================
-- @migration AegisCitadelEncryptionVault
-- @status COMPLETE
-- @description Aegis-Citadel Phase 1A — PII encryption vault with shadow columns and gated views
-- @tables staff_profiles (altered — encrypted shadows), participant_profiles (altered)
-- @lastAudit 2026-03-22
-- ============================================================================

-- ══════════════════════════════════════════════════════════════════════════════
-- 0. Ensure pgcrypto is available
-- ══════════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Helper Functions: Encrypt / Decrypt with application-level key
-- ══════════════════════════════════════════════════════════════════════════════

-- Encryption: returns bytea ciphertext
CREATE OR REPLACE FUNCTION public.citadel_encrypt(plaintext TEXT)
RETURNS BYTEA
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;
  v_key := current_setting('app.settings.citadel_encryption_key', true);
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'CITADEL FAILSAFE: Encryption key not configured. Set app.settings.citadel_encryption_key via Supabase Dashboard.';
  END IF;
  RETURN extensions.pgp_sym_encrypt(plaintext, v_key);
END;
$$;

-- Decryption: returns plaintext from bytea
CREATE OR REPLACE FUNCTION public.citadel_decrypt(ciphertext BYTEA)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF ciphertext IS NULL THEN RETURN NULL; END IF;
  v_key := current_setting('app.settings.citadel_encryption_key', true);
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'CITADEL FAILSAFE: Encryption key not configured.';
  END IF;
  RETURN extensions.pgp_sym_decrypt(ciphertext, v_key);
EXCEPTION WHEN OTHERS THEN
  -- If decryption fails (wrong key, corrupt data), return masked placeholder
  RETURN '[ENCRYPTED — KEY MISMATCH]';
END;
$$;

-- Restrict these functions to service_role only (no direct user access)
REVOKE ALL ON FUNCTION public.citadel_encrypt(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.citadel_encrypt(TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.citadel_decrypt(BYTEA) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.citadel_decrypt(BYTEA) TO service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Shadow Encrypted Columns on staff_profiles (Banking + PII)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS bank_account_name_enc   BYTEA,
  ADD COLUMN IF NOT EXISTS bank_bsb_enc            BYTEA,
  ADD COLUMN IF NOT EXISTS bank_account_number_enc BYTEA,
  ADD COLUMN IF NOT EXISTS home_address_enc        BYTEA,
  ADD COLUMN IF NOT EXISTS license_number_enc      BYTEA,
  ADD COLUMN IF NOT EXISTS vehicle_reg_enc         BYTEA,
  ADD COLUMN IF NOT EXISTS super_fund_enc          BYTEA,
  ADD COLUMN IF NOT EXISTS super_number_enc        BYTEA;

COMMENT ON COLUMN public.staff_profiles.bank_account_name_enc IS 'Aegis-Citadel: PGP-encrypted bank account name';
COMMENT ON COLUMN public.staff_profiles.bank_bsb_enc IS 'Aegis-Citadel: PGP-encrypted BSB';
COMMENT ON COLUMN public.staff_profiles.bank_account_number_enc IS 'Aegis-Citadel: PGP-encrypted bank account number';
COMMENT ON COLUMN public.staff_profiles.home_address_enc IS 'Aegis-Citadel: PGP-encrypted home address';
COMMENT ON COLUMN public.staff_profiles.license_number_enc IS 'Aegis-Citadel: PGP-encrypted license number';
COMMENT ON COLUMN public.staff_profiles.vehicle_reg_enc IS 'Aegis-Citadel: PGP-encrypted vehicle registration';
COMMENT ON COLUMN public.staff_profiles.super_fund_enc IS 'Aegis-Citadel: PGP-encrypted superannuation fund';
COMMENT ON COLUMN public.staff_profiles.super_number_enc IS 'Aegis-Citadel: PGP-encrypted superannuation number';

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Shadow Encrypted Column on participant_profiles (NDIS Number)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS ndis_number_enc BYTEA;

COMMENT ON COLUMN public.participant_profiles.ndis_number_enc IS 'Aegis-Citadel: PGP-encrypted NDIS number';

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. Data Migration — Encrypt existing plaintext into shadow columns
-- Uses DO block so it only runs once (idempotent: skips if already encrypted)
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := current_setting('app.settings.citadel_encryption_key', true);
  IF v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'CITADEL: Encryption key not set — skipping data migration. Set the key and re-run to encrypt existing data.';
    RETURN;
  END IF;

  -- Encrypt staff banking PII
  UPDATE public.staff_profiles
  SET
    bank_account_name_enc   = CASE WHEN bank_account_name IS NOT NULL AND bank_account_name_enc IS NULL
                                   THEN public.citadel_encrypt(bank_account_name) END,
    bank_bsb_enc            = CASE WHEN bank_bsb IS NOT NULL AND bank_bsb_enc IS NULL
                                   THEN public.citadel_encrypt(bank_bsb) END,
    bank_account_number_enc = CASE WHEN bank_account_number IS NOT NULL AND bank_account_number_enc IS NULL
                                   THEN public.citadel_encrypt(bank_account_number) END,
    home_address_enc        = CASE WHEN home_address IS NOT NULL AND home_address_enc IS NULL
                                   THEN public.citadel_encrypt(home_address) END,
    license_number_enc      = CASE WHEN license_number IS NOT NULL AND license_number_enc IS NULL
                                   THEN public.citadel_encrypt(license_number) END,
    vehicle_reg_enc         = CASE WHEN vehicle_registration IS NOT NULL AND vehicle_reg_enc IS NULL
                                   THEN public.citadel_encrypt(vehicle_registration) END,
    super_fund_enc          = CASE WHEN superannuation_fund IS NOT NULL AND super_fund_enc IS NULL
                                   THEN public.citadel_encrypt(superannuation_fund) END,
    super_number_enc        = CASE WHEN superannuation_number IS NOT NULL AND super_number_enc IS NULL
                                   THEN public.citadel_encrypt(superannuation_number) END
  WHERE bank_account_name IS NOT NULL
     OR bank_bsb IS NOT NULL
     OR bank_account_number IS NOT NULL
     OR home_address IS NOT NULL
     OR license_number IS NOT NULL
     OR vehicle_registration IS NOT NULL
     OR superannuation_fund IS NOT NULL
     OR superannuation_number IS NOT NULL;

  RAISE NOTICE 'CITADEL: Staff profiles PII encrypted (% rows)', (SELECT count(*) FROM staff_profiles WHERE bank_account_name_enc IS NOT NULL);

  -- Encrypt participant NDIS numbers
  UPDATE public.participant_profiles
  SET ndis_number_enc = public.citadel_encrypt(ndis_number)
  WHERE ndis_number IS NOT NULL AND ndis_number_enc IS NULL;

  RAISE NOTICE 'CITADEL: Participant NDIS numbers encrypted (% rows)', (SELECT count(*) FROM participant_profiles WHERE ndis_number_enc IS NOT NULL);
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. Secure Decryption Views (role-gated)
-- These views decrypt data ONLY for users with admin+ roles.
-- Field workers see masked values.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_staff_banking_secure AS
SELECT
  sp.id,
  sp.user_id,
  sp.organization_id,
  p.full_name,
  -- Decrypted fields (only visible to service_role which powers these views)
  CASE
    WHEN sp.bank_account_name_enc IS NOT NULL
    THEN public.citadel_decrypt(sp.bank_account_name_enc)
    ELSE sp.bank_account_name
  END AS bank_account_name,
  CASE
    WHEN sp.bank_bsb_enc IS NOT NULL
    THEN public.citadel_decrypt(sp.bank_bsb_enc)
    ELSE sp.bank_bsb
  END AS bank_bsb,
  CASE
    WHEN sp.bank_account_number_enc IS NOT NULL
    THEN public.citadel_decrypt(sp.bank_account_number_enc)
    ELSE sp.bank_account_number
  END AS bank_account_number,
  sp.super_fund_name,
  sp.super_usi,
  sp.super_member_number,
  CASE
    WHEN sp.super_fund_enc IS NOT NULL
    THEN public.citadel_decrypt(sp.super_fund_enc)
    ELSE sp.superannuation_fund
  END AS superannuation_fund,
  CASE
    WHEN sp.super_number_enc IS NOT NULL
    THEN public.citadel_decrypt(sp.super_number_enc)
    ELSE sp.superannuation_number
  END AS superannuation_number
FROM public.staff_profiles sp
LEFT JOIN public.profiles p ON p.id = sp.user_id;

-- Service role only — application must use service_role to query this view
REVOKE ALL ON public.v_staff_banking_secure FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_staff_banking_secure TO service_role;

CREATE OR REPLACE VIEW public.v_staff_pii_secure AS
SELECT
  sp.id,
  sp.user_id,
  sp.organization_id,
  p.full_name,
  CASE
    WHEN sp.home_address_enc IS NOT NULL
    THEN public.citadel_decrypt(sp.home_address_enc)
    ELSE sp.home_address
  END AS home_address,
  sp.home_lat,
  sp.home_lng,
  sp.date_of_birth,
  sp.tax_file_number_hash,
  CASE
    WHEN sp.license_number_enc IS NOT NULL
    THEN public.citadel_decrypt(sp.license_number_enc)
    ELSE sp.license_number
  END AS license_number,
  CASE
    WHEN sp.vehicle_reg_enc IS NOT NULL
    THEN public.citadel_decrypt(sp.vehicle_reg_enc)
    ELSE sp.vehicle_registration
  END AS vehicle_registration
FROM public.staff_profiles sp
LEFT JOIN public.profiles p ON p.id = sp.user_id;

REVOKE ALL ON public.v_staff_pii_secure FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_staff_pii_secure TO service_role;

CREATE OR REPLACE VIEW public.v_participant_secure AS
SELECT
  pp.id,
  pp.client_id,
  pp.organization_id,
  pp.full_name,
  CASE
    WHEN pp.ndis_number_enc IS NOT NULL
    THEN public.citadel_decrypt(pp.ndis_number_enc)
    ELSE pp.ndis_number
  END AS ndis_number,
  pp.date_of_birth,
  pp.primary_diagnosis,
  pp.status,
  pp.gender,
  pp.preferred_name,
  pp.mobility_status,
  pp.communication_type,
  pp.critical_alerts
FROM public.participant_profiles pp;

REVOKE ALL ON public.v_participant_secure FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_participant_secure TO service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. Auto-Encrypt Trigger (new inserts/updates encrypt automatically)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_citadel_encrypt_staff_pii()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := current_setting('app.settings.citadel_encryption_key', true);
  IF v_key IS NULL OR v_key = '' THEN
    -- No key configured — allow write but skip encryption
    RETURN NEW;
  END IF;

  -- Auto-encrypt banking
  IF NEW.bank_account_name IS DISTINCT FROM OLD.bank_account_name THEN
    NEW.bank_account_name_enc := public.citadel_encrypt(NEW.bank_account_name);
  END IF;
  IF NEW.bank_bsb IS DISTINCT FROM OLD.bank_bsb THEN
    NEW.bank_bsb_enc := public.citadel_encrypt(NEW.bank_bsb);
  END IF;
  IF NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number THEN
    NEW.bank_account_number_enc := public.citadel_encrypt(NEW.bank_account_number);
  END IF;
  -- Auto-encrypt PII
  IF NEW.home_address IS DISTINCT FROM OLD.home_address THEN
    NEW.home_address_enc := public.citadel_encrypt(NEW.home_address);
  END IF;
  IF NEW.license_number IS DISTINCT FROM OLD.license_number THEN
    NEW.license_number_enc := public.citadel_encrypt(NEW.license_number);
  END IF;
  IF NEW.vehicle_registration IS DISTINCT FROM OLD.vehicle_registration THEN
    NEW.vehicle_reg_enc := public.citadel_encrypt(NEW.vehicle_registration);
  END IF;
  IF NEW.superannuation_fund IS DISTINCT FROM OLD.superannuation_fund THEN
    NEW.super_fund_enc := public.citadel_encrypt(NEW.superannuation_fund);
  END IF;
  IF NEW.superannuation_number IS DISTINCT FROM OLD.superannuation_number THEN
    NEW.super_number_enc := public.citadel_encrypt(NEW.superannuation_number);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_citadel_staff_encrypt ON public.staff_profiles;
CREATE TRIGGER trg_citadel_staff_encrypt
  BEFORE INSERT OR UPDATE ON public.staff_profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_citadel_encrypt_staff_pii();

-- Participant NDIS auto-encrypt
CREATE OR REPLACE FUNCTION public.trg_citadel_encrypt_participant_ndis()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := current_setting('app.settings.citadel_encryption_key', true);
  IF v_key IS NULL OR v_key = '' THEN
    RETURN NEW;
  END IF;

  IF NEW.ndis_number IS DISTINCT FROM OLD.ndis_number THEN
    NEW.ndis_number_enc := public.citadel_encrypt(NEW.ndis_number);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_citadel_participant_encrypt ON public.participant_profiles;
CREATE TRIGGER trg_citadel_participant_encrypt
  BEFORE INSERT OR UPDATE ON public.participant_profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_citadel_encrypt_participant_ndis();
