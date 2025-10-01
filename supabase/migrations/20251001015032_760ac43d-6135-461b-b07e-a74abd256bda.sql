-- Add recipe_id column to calibration_entries table
-- This allows calibrations to be linked to recipes instead of coffee_profiles
ALTER TABLE public.calibration_entries 
ADD COLUMN recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL;

-- Make coffee_profile_id nullable for gradual migration
ALTER TABLE public.calibration_entries 
ALTER COLUMN coffee_profile_id DROP NOT NULL;

-- Add index for better query performance
CREATE INDEX idx_calibration_entries_recipe_id ON public.calibration_entries(recipe_id);

-- Add check to ensure either coffee_profile_id or recipe_id is set
ALTER TABLE public.calibration_entries
ADD CONSTRAINT check_profile_or_recipe 
CHECK (coffee_profile_id IS NOT NULL OR recipe_id IS NOT NULL);

-- Update trigger to handle recipe-based calibrations
CREATE OR REPLACE FUNCTION public.validate_single_approved_per_shift_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Si se está marcando como aprobado
  IF NEW.approved = true AND (OLD IS NULL OR OLD.approved = false) THEN
    -- Verificar si ya existe otro aprobado para el mismo café/fecha/turno
    -- Soporta tanto coffee_profile_id como recipe_id
    IF NEW.coffee_profile_id IS NOT NULL THEN
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
    END IF;
    
    IF NEW.recipe_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.calibration_entries
        WHERE recipe_id = NEW.recipe_id
          AND fecha = NEW.fecha
          AND turno = NEW.turno
          AND approved = true
          AND id != NEW.id
      ) THEN
        RAISE EXCEPTION 'Ya existe una calibración aprobada para esta receta, fecha y turno';
      END IF;
    END IF;

    -- Actualizar campos de aprobación
    NEW.approved_at := now();
    NEW.approved_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

-- Replace the old trigger
DROP TRIGGER IF EXISTS validate_single_approved_per_shift ON public.calibration_entries;
CREATE TRIGGER validate_single_approved_per_shift_v2
BEFORE INSERT OR UPDATE ON public.calibration_entries
FOR EACH ROW
EXECUTE FUNCTION public.validate_single_approved_per_shift_v2();