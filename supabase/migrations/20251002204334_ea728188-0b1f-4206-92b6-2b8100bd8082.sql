-- Update default step for time_s to 1 second
UPDATE public.calibration_settings
SET value = jsonb_set(
  value,
  '{time_s}',
  '1'::jsonb
)
WHERE key = 'default_steps';