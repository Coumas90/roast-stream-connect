-- Add availability toggles to coffee_varieties table
ALTER TABLE public.coffee_varieties 
ADD COLUMN available_bulk boolean NOT NULL DEFAULT true,
ADD COLUMN available_packaged boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.coffee_varieties.available_bulk IS 'Whether this variety is available for bulk orders (by kg)';
COMMENT ON COLUMN public.coffee_varieties.available_packaged IS 'Whether this variety is available as packaged products (cuartitos)';