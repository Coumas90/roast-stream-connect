-- Create training_requests table
CREATE TABLE public.training_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'scheduled', 'completed', 'cancelled')),
  training_type TEXT NOT NULL DEFAULT 'barista_basics' CHECK (training_type IN ('barista_basics', 'latte_art', 'coffee_cupping', 'equipment_maintenance', 'custom')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  estimated_duration_hours INTEGER DEFAULT 4,
  estimated_days INTEGER DEFAULT 1,
  preferred_date TIMESTAMP WITH TIME ZONE,
  specific_topics JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Add training_enabled to entitlements table
ALTER TABLE public.entitlements ADD COLUMN training_enabled BOOLEAN NOT NULL DEFAULT false;

-- Enable RLS on training_requests
ALTER TABLE public.training_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for training_requests
CREATE POLICY "training_requests_select_by_access" 
ON public.training_requests 
FOR SELECT 
USING (is_tupa_admin() OR user_has_location(location_id));

CREATE POLICY "training_requests_insert_by_location" 
ON public.training_requests 
FOR INSERT 
WITH CHECK (user_has_location(location_id));

CREATE POLICY "training_requests_update_admin_or_owner" 
ON public.training_requests 
FOR UPDATE 
USING (is_tupa_admin() OR (user_has_location(location_id) AND has_role(auth.uid(), 'owner'::app_role)))
WITH CHECK (is_tupa_admin() OR (user_has_location(location_id) AND has_role(auth.uid(), 'owner'::app_role)));

-- Create trigger for updated_at
CREATE TRIGGER update_training_requests_updated_at
  BEFORE UPDATE ON public.training_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();