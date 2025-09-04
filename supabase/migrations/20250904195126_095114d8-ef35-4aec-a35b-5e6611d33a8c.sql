-- Create table for coffee products (cuartitos and other finished products)
CREATE TABLE public.coffee_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coffee_variety_id UUID NOT NULL REFERENCES public.coffee_varieties(id) ON DELETE CASCADE,
  weight_grams INTEGER NOT NULL,
  price NUMERIC(10,2),
  sku TEXT UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  product_type TEXT NOT NULL DEFAULT 'cuartito', -- cuartito, package, custom
  name TEXT, -- Optional custom name, otherwise uses variety name + weight
  description TEXT,
  stock_quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create indexes for better performance
CREATE INDEX idx_coffee_products_variety ON public.coffee_products(coffee_variety_id);
CREATE INDEX idx_coffee_products_active ON public.coffee_products(active);
CREATE INDEX idx_coffee_products_type ON public.coffee_products(product_type);
CREATE INDEX idx_coffee_products_sku ON public.coffee_products(sku);

-- Enable RLS
ALTER TABLE public.coffee_products ENABLE ROW LEVEL SECURITY;

-- Create policies for coffee products
CREATE POLICY "Coffee products are viewable by everyone" 
ON public.coffee_products 
FOR SELECT 
USING (active = true OR is_tupa_admin());

CREATE POLICY "Admins can manage coffee products" 
ON public.coffee_products 
FOR ALL 
USING (is_tupa_admin()) 
WITH CHECK (is_tupa_admin());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_coffee_products_updated_at
BEFORE UPDATE ON public.coffee_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample cuartitos for common varieties
INSERT INTO public.coffee_products (coffee_variety_id, weight_grams, price, sku, product_type, name) 
SELECT 
  cv.id,
  250,
  COALESCE(cv.price_per_kg * 0.25, 15.00),
  CONCAT('CUART-', UPPER(LEFT(cv.name, 3)), '-250'),
  'cuartito',
  CONCAT(cv.name, ' - Cuartito 250g')
FROM public.coffee_varieties cv 
WHERE cv.active = true 
LIMIT 5;

-- Insert some additional product sizes
INSERT INTO public.coffee_products (coffee_variety_id, weight_grams, price, sku, product_type, name) 
SELECT 
  cv.id,
  70,
  COALESCE(cv.price_per_kg * 0.07, 5.00),
  CONCAT('MINI-', UPPER(LEFT(cv.name, 3)), '-70'),
  'package',
  CONCAT(cv.name, ' - Mini 70g')
FROM public.coffee_varieties cv 
WHERE cv.active = true 
LIMIT 3;

INSERT INTO public.coffee_products (coffee_variety_id, weight_grams, price, sku, product_type, name) 
SELECT 
  cv.id,
  500,
  COALESCE(cv.price_per_kg * 0.50, 25.00),
  CONCAT('PACK-', UPPER(LEFT(cv.name, 3)), '-500'),
  'package',
  CONCAT(cv.name, ' - Paquete 500g')
FROM public.coffee_varieties cv 
WHERE cv.active = true 
LIMIT 3;