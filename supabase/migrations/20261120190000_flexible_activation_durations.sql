-- Flexible activation-code validity with backward-compatible month fields.
-- Existing codes keep their current duration_months behavior until edited.
ALTER TABLE public.omax_activation_codes
  ADD COLUMN IF NOT EXISTS duration_days integer,
  ADD COLUMN IF NOT EXISTS is_lifetime boolean NOT NULL DEFAULT false;

ALTER TABLE public.omax_subscriptions
  ADD COLUMN IF NOT EXISTS is_lifetime boolean NOT NULL DEFAULT false;

ALTER TABLE public.omax_activation_codes
  DROP CONSTRAINT IF EXISTS omax_activation_codes_duration_days_check;
ALTER TABLE public.omax_activation_codes
  ADD CONSTRAINT omax_activation_codes_duration_days_check
  CHECK (duration_days IS NULL OR duration_days BETWEEN 1 AND 365);

CREATE OR REPLACE FUNCTION public.omax_apply_activation_code_duration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_lifetime boolean;
  v_duration_days integer;
BEGIN
  IF NEW.activation_code_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(c.is_lifetime, false), c.duration_days
    INTO v_is_lifetime, v_duration_days
  FROM public.omax_activation_codes AS c
  WHERE c.id = NEW.activation_code_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_is_lifetime THEN
    NEW.is_lifetime := true;
    -- Keep expires_at non-null for compatibility with existing app queries.
    -- Far-future expiry behaves as non-expiring for current timestamp checks.
    NEW.expires_at := TIMESTAMPTZ '9999-12-31 23:59:59+00';
  ELSIF v_duration_days BETWEEN 1 AND 365 THEN
    NEW.is_lifetime := false;
    NEW.expires_at := COALESCE(NEW.starts_at, now())
      + make_interval(days => v_duration_days);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_omax_apply_activation_code_duration
  ON public.omax_subscriptions;

CREATE TRIGGER trg_omax_apply_activation_code_duration
BEFORE INSERT OR UPDATE ON public.omax_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.omax_apply_activation_code_duration();

COMMENT ON COLUMN public.omax_activation_codes.duration_days IS
  'Exact validity in days (1–365); NULL for lifetime codes and legacy month-based codes.';
COMMENT ON COLUMN public.omax_activation_codes.is_lifetime IS
  'When true, the activation code grants non-expiring access.';
COMMENT ON COLUMN public.omax_subscriptions.is_lifetime IS
  'True when the subscription was granted by a lifetime activation code.';
