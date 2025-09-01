-- Fix security warning by adding search_path to the trigger function
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER update_coffee_varieties_updated_at
BEFORE UPDATE ON public.coffee_varieties
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_location_stock_updated_at
BEFORE UPDATE ON public.location_stock
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();