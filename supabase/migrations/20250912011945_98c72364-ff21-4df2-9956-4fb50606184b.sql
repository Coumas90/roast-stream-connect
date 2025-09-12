-- Create recipes table
CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  method TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  type TEXT NOT NULL DEFAULT 'personal',
  coffee_type TEXT DEFAULT 'tupa',
  coffee_variety_id UUID REFERENCES public.coffee_varieties(id),
  custom_coffee_name TEXT,
  custom_coffee_origin TEXT,
  coffee_amount TEXT,
  water_amount TEXT,
  ratio TEXT,
  temperature TEXT,
  grind TEXT,
  time TEXT,
  notes TEXT,
  params JSONB DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT false,
  tenant_id UUID REFERENCES public.tenants(id),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recipe_steps table
CREATE TABLE IF NOT EXISTS public.recipe_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  time_minutes INTEGER,
  water_ml INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_steps ENABLE ROW LEVEL SECURITY;

-- Create policies for recipes
CREATE POLICY "recipes_select_global_or_tenant" 
ON public.recipes 
FOR SELECT 
USING (tenant_id IS NULL OR user_has_tenant(tenant_id));

CREATE POLICY "recipes_insert_admin_or_owner" 
ON public.recipes 
FOR INSERT 
WITH CHECK (is_tupa_admin() OR (tenant_id IS NOT NULL AND user_has_tenant(tenant_id) AND has_role(auth.uid(), 'owner'::app_role)));

CREATE POLICY "recipes_update_admin_or_owner" 
ON public.recipes 
FOR UPDATE 
USING (is_tupa_admin() OR (tenant_id IS NOT NULL AND user_has_tenant(tenant_id) AND has_role(auth.uid(), 'owner'::app_role)))
WITH CHECK (is_tupa_admin() OR (tenant_id IS NOT NULL AND user_has_tenant(tenant_id) AND has_role(auth.uid(), 'owner'::app_role)));

-- Create policies for recipe_steps  
CREATE POLICY "recipe_steps_select_by_recipe" 
ON public.recipe_steps 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.recipes r 
  WHERE r.id = recipe_steps.recipe_id 
  AND (r.tenant_id IS NULL OR user_has_tenant(r.tenant_id))
));

CREATE POLICY "recipe_steps_insert_by_recipe" 
ON public.recipe_steps 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.recipes r 
  WHERE r.id = recipe_steps.recipe_id 
  AND (is_tupa_admin() OR (r.tenant_id IS NOT NULL AND user_has_tenant(r.tenant_id) AND has_role(auth.uid(), 'owner'::app_role)))
));

CREATE POLICY "recipe_steps_update_by_recipe" 
ON public.recipe_steps 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.recipes r 
  WHERE r.id = recipe_steps.recipe_id 
  AND (is_tupa_admin() OR (r.tenant_id IS NOT NULL AND user_has_tenant(r.tenant_id) AND has_role(auth.uid(), 'owner'::app_role)))
));

CREATE POLICY "recipe_steps_delete_by_recipe" 
ON public.recipe_steps 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.recipes r 
  WHERE r.id = recipe_steps.recipe_id 
  AND (is_tupa_admin() OR (r.tenant_id IS NOT NULL AND user_has_tenant(r.tenant_id) AND has_role(auth.uid(), 'owner'::app_role)))
));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_recipes_updated_at
BEFORE UPDATE ON public.recipes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recipe_steps_updated_at
BEFORE UPDATE ON public.recipe_steps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recipes_tenant_id ON public.recipes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recipes_created_by ON public.recipes(created_by);
CREATE INDEX IF NOT EXISTS idx_recipes_status ON public.recipes(status);
CREATE INDEX IF NOT EXISTS idx_recipes_type ON public.recipes(type);
CREATE INDEX IF NOT EXISTS idx_recipes_active ON public.recipes(active);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id ON public.recipe_steps(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_order ON public.recipe_steps(recipe_id, step_order);