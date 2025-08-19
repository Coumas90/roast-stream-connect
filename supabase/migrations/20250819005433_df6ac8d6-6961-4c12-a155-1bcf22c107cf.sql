-- Configure scheduled POS credentials rotation
-- Schedule: Daily at 03:15 America/Argentina/Buenos_Aires (06:15 UTC)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the credentials rotation job
SELECT cron.schedule(
  'pos-credentials-rotation-daily',
  '15 6 * * *', -- 06:15 UTC = 03:15 Buenos Aires
  $$
  SELECT
    net.http_post(
        url:='https://ipjidjijilhpblxrnaeg.supabase.co/functions/v1/pos-credentials-rotation',
        headers:='{"Content-Type": "application/json", "X-Job-Token": "' || current_setting('app.pos_sync_job_token') || '"}'::jsonb,
        body:='{"timestamp": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);

-- Add manual trigger function for testing
CREATE OR REPLACE FUNCTION public.trigger_pos_credentials_rotation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  -- Only allow platform admins to trigger manually
  IF NOT public.is_tupa_admin() THEN
    RAISE EXCEPTION 'Only platform administrators can trigger credential rotation';
  END IF;

  -- Log manual trigger
  INSERT INTO public.pos_logs (level, scope, message, meta)
  VALUES (
    'info',
    'credential_rotation',
    'Manual credential rotation triggered',
    jsonb_build_object(
      'user_id', auth.uid(),
      'timestamp', now(),
      'trigger_type', 'manual'
    )
  );

  -- Trigger the edge function
  SELECT net.http_post(
    url := 'https://ipjidjijilhpblxrnaeg.supabase.co/functions/v1/pos-credentials-rotation',
    headers := '{"Content-Type": "application/json", "X-Job-Token": "' || current_setting('app.pos_sync_job_token') || '"}'::jsonb,
    body := '{"timestamp": "' || now() || '", "trigger": "manual"}'::jsonb
  ) INTO result;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Credential rotation triggered manually',
    'request_id', result->'id',
    'timestamp', now()
  );
END;
$function$;