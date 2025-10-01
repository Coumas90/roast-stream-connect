-- ================================================
-- FASE 1: Data Model & Infrastructure
-- Calculadora de Calibración Diaria
-- ================================================

-- 1. TABLA: grinders (molinos)
CREATE TABLE IF NOT EXISTS public.grinders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model TEXT,
  clicks_per_point NUMERIC NOT NULL DEFAULT 1.0,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, name)
);

-- 2. TABLA: coffee_profiles (perfiles de café para calibración)
CREATE TABLE IF NOT EXISTS public.coffee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  grinder_id UUID REFERENCES public.grinders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  lote TEXT,
  tueste TEXT,
  brew_method TEXT NOT NULL CHECK (brew_method IN ('espresso', 'filtrado', 'cold_brew', 'french_press')),
  target_dose_g NUMERIC NOT NULL DEFAULT 18.0,
  target_ratio_min NUMERIC NOT NULL DEFAULT 1.8,
  target_ratio_max NUMERIC NOT NULL DEFAULT 2.2,
  target_time_min INTEGER NOT NULL DEFAULT 25,
  target_time_max INTEGER NOT NULL DEFAULT 32,
  target_temp_c NUMERIC NOT NULL DEFAULT 93.0,
  target_yield_unit TEXT NOT NULL DEFAULT 'g' CHECK (target_yield_unit IN ('g', 'ml')),
  water_profile_id UUID,
  humidity_hint BOOLEAN DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABLA: calibration_entries (entradas de calibración)
CREATE TABLE IF NOT EXISTS public.calibration_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coffee_profile_id UUID NOT NULL REFERENCES public.coffee_profiles(id) ON DELETE CASCADE,
  barista_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turno TEXT NOT NULL CHECK (turno IN ('mañana', 'tarde', 'noche')),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  dose_g NUMERIC NOT NULL CHECK (dose_g > 0),
  yield_value NUMERIC NOT NULL CHECK (yield_value > 0),
  yield_unit TEXT NOT NULL DEFAULT 'g' CHECK (yield_unit IN ('g', 'ml')),
  time_s INTEGER NOT NULL CHECK (time_s > 0),
  temp_c NUMERIC NOT NULL,
  grind_points NUMERIC NOT NULL,
  grind_label TEXT,
  grinder_clicks_delta INTEGER DEFAULT 0,
  ratio_calc NUMERIC,
  notes_tags TEXT[] DEFAULT '{}',
  notes_text TEXT,
  is_override BOOLEAN DEFAULT false,
  suggestion_shown TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 4. TABLA: calibration_settings (configuración de calibración)
CREATE TABLE IF NOT EXISTS public.calibration_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insertar configuraciones por defecto
INSERT INTO public.calibration_settings (key, value, description) VALUES
  ('density_conversion', '0.98', 'Densidad para conversión ml a g (default: 0.98)'),
  ('default_ranges', '{"espresso": {"time_min": 25, "time_max": 32, "ratio_min": 1.8, "ratio_max": 2.2}}', 'Rangos por defecto por método de preparación'),
  ('default_steps', '{"dose_g": 0.1, "time_s": 1, "temp_c": 1, "grind_points": 0.5}', 'Pasos de incremento por defecto'),
  ('max_grind_delta', '1.5', 'Delta máximo de molienda permitido sin warning'),
  ('quick_notes_chips', '["ácido", "amargo", "equilibrado", "dulce", "astringente", "sub-extraído", "sobre-extraído"]', 'Chips de notas rápidas')
ON CONFLICT (key) DO NOTHING;

-- ================================================
-- INDEXES para performance
-- ================================================
CREATE INDEX IF NOT EXISTS idx_calibration_entries_coffee_profile ON public.calibration_entries(coffee_profile_id);
CREATE INDEX IF NOT EXISTS idx_calibration_entries_barista ON public.calibration_entries(barista_id);
CREATE INDEX IF NOT EXISTS idx_calibration_entries_fecha_turno ON public.calibration_entries(fecha, turno);
CREATE INDEX IF NOT EXISTS idx_calibration_entries_approved ON public.calibration_entries(approved) WHERE approved = true;
CREATE INDEX IF NOT EXISTS idx_coffee_profiles_location ON public.coffee_profiles(location_id);
CREATE INDEX IF NOT EXISTS idx_coffee_profiles_active ON public.coffee_profiles(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_grinders_location ON public.grinders(location_id);

-- ================================================
-- TRIGGERS para updated_at
-- ================================================
CREATE TRIGGER update_grinders_updated_at
  BEFORE UPDATE ON public.grinders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coffee_profiles_updated_at
  BEFORE UPDATE ON public.coffee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calibration_entries_updated_at
  BEFORE UPDATE ON public.calibration_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calibration_settings_updated_at
  BEFORE UPDATE ON public.calibration_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ================================================
-- RLS POLICIES
-- ================================================

-- GRINDERS: solo lectura para usuarios con acceso a la location
ALTER TABLE public.grinders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grinders_select_by_location"
  ON public.grinders FOR SELECT
  USING (user_has_location(location_id) OR is_tupa_admin());

CREATE POLICY "grinders_admin_all"
  ON public.grinders FOR ALL
  USING (is_tupa_admin())
  WITH CHECK (is_tupa_admin());

-- COFFEE_PROFILES: lectura para usuarios con acceso, escritura para owner/manager/admin
ALTER TABLE public.coffee_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coffee_profiles_select_by_location"
  ON public.coffee_profiles FOR SELECT
  USING (user_has_location(location_id) OR is_tupa_admin());

CREATE POLICY "coffee_profiles_insert_manager"
  ON public.coffee_profiles FOR INSERT
  WITH CHECK (
    (user_has_location(location_id) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')))
    OR is_tupa_admin()
  );

CREATE POLICY "coffee_profiles_update_manager"
  ON public.coffee_profiles FOR UPDATE
  USING (
    (user_has_location(location_id) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')))
    OR is_tupa_admin()
  );

CREATE POLICY "coffee_profiles_delete_admin"
  ON public.coffee_profiles FOR DELETE
  USING (is_tupa_admin());

-- CALIBRATION_ENTRIES: baristas pueden crear/editar sus propias entradas recientes
ALTER TABLE public.calibration_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calibration_entries_select_by_location"
  ON public.calibration_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_profiles cp
      WHERE cp.id = calibration_entries.coffee_profile_id
        AND (user_has_location(cp.location_id) OR is_tupa_admin())
    )
  );

CREATE POLICY "calibration_entries_insert_barista"
  ON public.calibration_entries FOR INSERT
  WITH CHECK (
    auth.uid() = barista_id
    AND EXISTS (
      SELECT 1 FROM public.coffee_profiles cp
      WHERE cp.id = calibration_entries.coffee_profile_id
        AND user_has_location(cp.location_id)
    )
  );

CREATE POLICY "calibration_entries_update_own_recent"
  ON public.calibration_entries FOR UPDATE
  USING (
    (barista_id = auth.uid() AND created_at > now() - interval '24 hours')
    OR EXISTS (
      SELECT 1 FROM public.coffee_profiles cp
      WHERE cp.id = calibration_entries.coffee_profile_id
        AND user_has_location(cp.location_id)
        AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
    )
    OR is_tupa_admin()
  );

CREATE POLICY "calibration_entries_delete_manager"
  ON public.calibration_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.coffee_profiles cp
      WHERE cp.id = calibration_entries.coffee_profile_id
        AND user_has_location(cp.location_id)
        AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
    )
    OR is_tupa_admin()
  );

-- CALIBRATION_SETTINGS: solo admin puede modificar
ALTER TABLE public.calibration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calibration_settings_select_all"
  ON public.calibration_settings FOR SELECT
  USING (true);

CREATE POLICY "calibration_settings_admin_all"
  ON public.calibration_settings FOR ALL
  USING (is_tupa_admin())
  WITH CHECK (is_tupa_admin());

-- ================================================
-- FUNCIONES HELPER
-- ================================================

-- Función para calcular ratio de extracción con conversión ml/g
CREATE OR REPLACE FUNCTION public.calculate_brew_ratio(
  p_yield_value NUMERIC,
  p_yield_unit TEXT,
  p_dose_g NUMERIC,
  p_density NUMERIC DEFAULT 0.98
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_yield_g NUMERIC;
BEGIN
  IF p_dose_g <= 0 THEN
    RETURN NULL;
  END IF;

  -- Convertir yield a gramos si está en ml
  IF p_yield_unit = 'ml' THEN
    v_yield_g := p_yield_value * p_density;
  ELSE
    v_yield_g := p_yield_value;
  END IF;

  RETURN ROUND(v_yield_g / p_dose_g, 2);
END;
$$;

-- Trigger para validar solo un "aprobado" por turno/café/día
CREATE OR REPLACE FUNCTION public.validate_single_approved_per_shift()
RETURNS TRIGGER
LANGUAGE plpgsql
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

CREATE TRIGGER validate_approved_calibration
  BEFORE INSERT OR UPDATE ON public.calibration_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_single_approved_per_shift();

-- Trigger para calcular ratio automáticamente al insertar/actualizar
CREATE OR REPLACE FUNCTION public.auto_calculate_ratio()
RETURNS TRIGGER
LANGUAGE plpgsql
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

CREATE TRIGGER calculate_ratio_on_save
  BEFORE INSERT OR UPDATE ON public.calibration_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_calculate_ratio();

-- Función para obtener sugerencias de ajuste
CREATE OR REPLACE FUNCTION public.get_calibration_suggestion(
  p_time_s INTEGER,
  p_ratio NUMERIC,
  p_target_time_min INTEGER,
  p_target_time_max INTEGER,
  p_target_ratio_min NUMERIC,
  p_target_ratio_max NUMERIC,
  p_notes_tags TEXT[]
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_suggestion TEXT := '';
BEGIN
  -- Analizar tiempo
  IF p_time_s < p_target_time_min THEN
    v_suggestion := v_suggestion || 'Cerrar molienda (0.3-0.5 puntos) o aumentar dosis (+0.2g). ';
  ELSIF p_time_s > p_target_time_max THEN
    v_suggestion := v_suggestion || 'Abrir molienda (0.3-0.5 puntos) o reducir dosis (-0.2g). ';
  END IF;

  -- Analizar ratio
  IF p_ratio < p_target_ratio_min THEN
    v_suggestion := v_suggestion || 'Ratio bajo: aumentar rendimiento. ';
  ELSIF p_ratio > p_target_ratio_max THEN
    v_suggestion := v_suggestion || 'Ratio alto: reducir rendimiento. ';
  END IF;

  -- Analizar notas de sabor
  IF 'ácido' = ANY(p_notes_tags) OR 'sub-extraído' = ANY(p_notes_tags) THEN
    v_suggestion := v_suggestion || 'Cerrar molienda y/o aumentar tiempo de contacto. ';
  END IF;

  IF 'amargo' = ANY(p_notes_tags) OR 'sobre-extraído' = ANY(p_notes_tags) OR 'astringente' = ANY(p_notes_tags) THEN
    v_suggestion := v_suggestion || 'Abrir molienda y/o reducir temperatura (-1°C). ';
  END IF;

  -- Si todo está en rango
  IF v_suggestion = '' THEN
    v_suggestion := '✓ Parámetros dentro del rango objetivo';
  END IF;

  RETURN TRIM(v_suggestion);
END;
$$;