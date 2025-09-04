-- Create some sample cuartitos for existing varieties (only if they don't exist)
INSERT INTO public.coffee_products (coffee_variety_id, weight_grams, price, sku, product_type, name) 
SELECT 
  cv.id,
  250,
  COALESCE(cv.price_per_kg * 0.25, 15.00),
  CONCAT('CUART-', UPPER(LEFT(cv.name, 3)), '-250', '-', cv.id::text),
  'cuartito',
  CONCAT(cv.name, ' - Cuartito 250g')
FROM public.coffee_varieties cv 
WHERE cv.active = true 
  AND NOT EXISTS (
    SELECT 1 FROM public.coffee_products cp 
    WHERE cp.coffee_variety_id = cv.id 
      AND cp.weight_grams = 250
  )
LIMIT 5;

-- Insert some additional product sizes (70g and 500g)
INSERT INTO public.coffee_products (coffee_variety_id, weight_grams, price, sku, product_type, name) 
SELECT 
  cv.id,
  70,
  COALESCE(cv.price_per_kg * 0.07, 5.00),
  CONCAT('MINI-', UPPER(LEFT(cv.name, 3)), '-70', '-', cv.id::text),
  'package',
  CONCAT(cv.name, ' - Mini 70g')
FROM public.coffee_varieties cv 
WHERE cv.active = true 
  AND NOT EXISTS (
    SELECT 1 FROM public.coffee_products cp 
    WHERE cp.coffee_variety_id = cv.id 
      AND cp.weight_grams = 70
  )
LIMIT 3;

INSERT INTO public.coffee_products (coffee_variety_id, weight_grams, price, sku, product_type, name) 
SELECT 
  cv.id,
  500,
  COALESCE(cv.price_per_kg * 0.50, 25.00),
  CONCAT('PACK-', UPPER(LEFT(cv.name, 3)), '-500', '-', cv.id::text),
  'package',
  CONCAT(cv.name, ' - Paquete 500g')
FROM public.coffee_varieties cv 
WHERE cv.active = true 
  AND NOT EXISTS (
    SELECT 1 FROM public.coffee_products cp 
    WHERE cp.coffee_variety_id = cv.id 
      AND cp.weight_grams = 500
  )
LIMIT 3;