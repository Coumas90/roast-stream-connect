-- Create recipe_steps table for storing recipe steps
CREATE TABLE public.recipe_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  time_minutes INTEGER,
  water_ml INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on recipe_steps
ALTER TABLE public.recipe_steps ENABLE ROW LEVEL SECURITY;

-- Create policies for recipe_steps
CREATE POLICY "recipe_steps_select_by_recipe" 
ON public.recipe_steps 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.recipes r 
    WHERE r.id = recipe_steps.recipe_id 
    AND ((r.tenant_id IS NULL) OR user_has_tenant(r.tenant_id))
  )
);

CREATE POLICY "recipe_steps_insert_by_recipe" 
ON public.recipe_steps 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recipes r 
    WHERE r.id = recipe_steps.recipe_id 
    AND (is_tupa_admin() OR ((r.tenant_id IS NOT NULL) AND user_has_tenant(r.tenant_id) AND has_role(auth.uid(), 'owner'::app_role)))
  )
);

CREATE POLICY "recipe_steps_update_by_recipe" 
ON public.recipe_steps 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.recipes r 
    WHERE r.id = recipe_steps.recipe_id 
    AND (is_tupa_admin() OR ((r.tenant_id IS NOT NULL) AND user_has_tenant(r.tenant_id) AND has_role(auth.uid(), 'owner'::app_role)))
  )
);

CREATE POLICY "recipe_steps_delete_by_recipe" 
ON public.recipe_steps 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.recipes r 
    WHERE r.id = recipe_steps.recipe_id 
    AND (is_tupa_admin() OR ((r.tenant_id IS NOT NULL) AND user_has_tenant(r.tenant_id) AND has_role(auth.uid(), 'owner'::app_role)))
  )
);

-- Update recipes table to include additional fields needed
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'personal';
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS ratio TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS coffee_amount TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS water_amount TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS time TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS temperature TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS grind TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS coffee_type TEXT DEFAULT 'tupa';
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS coffee_variety_id UUID REFERENCES public.coffee_varieties(id);
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS custom_coffee_name TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS custom_coffee_origin TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;

-- Create trigger for recipe_steps updated_at
CREATE TRIGGER update_recipe_steps_updated_at
BEFORE UPDATE ON public.recipe_steps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for recipe steps ordering
CREATE INDEX idx_recipe_steps_recipe_order ON public.recipe_steps(recipe_id, step_order);