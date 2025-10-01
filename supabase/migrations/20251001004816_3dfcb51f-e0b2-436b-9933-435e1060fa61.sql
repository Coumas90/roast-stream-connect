-- Corregir warnings de seguridad: agregar search_path a funciones
-- Esto previene ataques de search_path hijacking

-- Re-crear función validate_single_approved_per_shift con search_path
CREATE OR REPLACE FUNCTION public.validate_single_approved_per_shift()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Si se está marcando como aprobado
  IF NEW.approved = true AND (OLD IS NULL OR OLD.approved = false) THEN
    -- Verificar si ya existe otro aprobado para el mismo café/fecha/turno
    IF EXISTS (
      SELECT 1 FROM public.calibration_entries
      WHERE coffee_profile_id = NEW.coffee_profile_id
        AND fecha = NEW.fecha
        AND turno = NEW.turno
        AND approved = true
        AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Ya existe una calibración aprobada para este café, fecha y turno';
    END IF;

    -- Actualizar campos de aprobación
    NEW.approved_at := now();
    NEW.approved_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

-- Re-crear función auto_calculate_ratio con search_path
CREATE OR REPLACE FUNCTION public.auto_calculate_ratio()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_density NUMERIC;
BEGIN
  -- Obtener densidad de configuración
  SELECT (value::text)::numeric INTO v_density
  FROM public.calibration_settings
  WHERE key = 'density_conversion';

  -- Calcular ratio
  NEW.ratio_calc := public.calculate_brew_ratio(
    NEW.yield_value,
    NEW.yield_unit,
    NEW.dose_g,
    COALESCE(v_density, 0.98)
  );

  -- Establecer created_by si es insert
  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;