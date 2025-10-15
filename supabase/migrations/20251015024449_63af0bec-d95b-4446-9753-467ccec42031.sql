-- Fix sync_profile_email function volatility
-- The function performs UPDATE/INSERT operations so it MUST be VOLATILE, not STABLE

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER 
LANGUAGE plpgsql 
VOLATILE  -- Changed from STABLE to VOLATILE to allow UPDATE/INSERT
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  -- Update profile email when auth.users email changes
  UPDATE public.profiles 
  SET email = NEW.email
  WHERE id = NEW.id;
  
  -- If no profile exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id, 
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
    )
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Log the fix
INSERT INTO public.pos_logs (level, scope, message, meta)
VALUES (
  'info',
  'security_audit',
  'Fixed sync_profile_email volatility to allow UPDATE operations',
  jsonb_build_object(
    'previous_state', 'STABLE',
    'new_state', 'VOLATILE',
    'reason', 'UPDATE not allowed in non-volatile function',
    'timestamp', NOW()
  )
);