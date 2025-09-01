-- Create coffee varieties management system

-- Coffee varieties table
CREATE TABLE public.coffee_varieties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  origin TEXT,
  category TEXT NOT NULL DEFAULT 'other', -- 'tupa' or 'other'
  price_per_kg NUMERIC,
  specifications JSONB DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Location stock tracking (what coffee is currently in each hopper)
CREATE TABLE public.location_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES public.locations(id),
  coffee_variety_id UUID NOT NULL REFERENCES public.coffee_varieties(id),
  hopper_number INTEGER NOT NULL DEFAULT 1,
  current_kg NUMERIC NOT NULL DEFAULT 0,
  last_refill_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(location_id, hopper_number)
);

-- Enhanced order items structure for multiple varieties
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_proposal_id UUID NOT NULL REFERENCES public.order_proposals(id) ON DELETE CASCADE,
  coffee_variety_id UUID NOT NULL REFERENCES public.coffee_varieties(id),
  quantity_kg NUMERIC NOT NULL,
  unit_price NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coffee_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coffee_varieties
CREATE POLICY "coffee_varieties_select_all" ON public.coffee_varieties
FOR SELECT USING (active = true OR is_tupa_admin());

CREATE POLICY "coffee_varieties_admin_only" ON public.coffee_varieties
FOR ALL USING (is_tupa_admin()) WITH CHECK (is_tupa_admin());

-- RLS Policies for location_stock
CREATE POLICY "location_stock_select_by_access" ON public.location_stock
FOR SELECT USING (user_has_location(location_id) OR is_tupa_admin());

CREATE POLICY "location_stock_admin_only" ON public.location_stock
FOR ALL USING (is_tupa_admin()) WITH CHECK (is_tupa_admin());

-- RLS Policies for order_items
CREATE POLICY "order_items_select_by_order_access" ON public.order_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.order_proposals op 
    WHERE op.id = order_proposal_id 
    AND (user_has_location(op.location_id) OR is_tupa_admin())
  )
);

CREATE POLICY "order_items_insert_by_order_access" ON public.order_items
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.order_proposals op 
    WHERE op.id = order_proposal_id 
    AND user_has_location(op.location_id)
  )
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_coffee_varieties_updated_at
BEFORE UPDATE ON public.coffee_varieties
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_location_stock_updated_at
BEFORE UPDATE ON public.location_stock
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default TUPA coffee varieties
INSERT INTO public.coffee_varieties (name, description, origin, category, specifications) VALUES
('TUPÁ Supremo', 'Mezcla premium de granos colombianos y brasileños', 'Colombia/Brasil', 'tupa', '{"roast_level": "medium", "intensity": 8, "notes": ["chocolate", "caramel", "nuts"]}'),
('TUPÁ Clásico', 'Blend tradicional equilibrado para espresso', 'Colombia', 'tupa', '{"roast_level": "medium-dark", "intensity": 7, "notes": ["chocolate", "fruity"]}'),
('TUPÁ Intenso', 'Mezcla robusta para café fuerte', 'Brasil/Vietnam', 'tupa', '{"roast_level": "dark", "intensity": 9, "notes": ["dark_chocolate", "spicy"]}');