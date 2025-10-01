-- Actualizar los pasos de calibración para ajustes más sutiles y precisos
-- Estos valores permiten micro-ajustes profesionales para espresso

UPDATE public.calibration_settings 
SET value = jsonb_build_object(
  'dose_g', 0.1,
  'time_s', 0.5,
  'temp_c', 0.5,
  'grind_points', 0.1
)
WHERE key = 'default_steps';