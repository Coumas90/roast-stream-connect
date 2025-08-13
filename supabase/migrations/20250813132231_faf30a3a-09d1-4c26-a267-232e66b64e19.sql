-- Enable Row Level Security for pos_provider_credentials table
ALTER TABLE public.pos_provider_credentials ENABLE ROW LEVEL SECURITY;

-- Create policy for selecting POS credentials - only allow users who can manage POS for that location
CREATE POLICY "pos_provider_credentials_select" 
ON public.pos_provider_credentials 
FOR SELECT 
USING (public.user_can_manage_pos(location_id));

-- Create policy for inserting POS credentials - only allow users who can manage POS for that location
CREATE POLICY "pos_provider_credentials_insert" 
ON public.pos_provider_credentials 
FOR INSERT 
WITH CHECK (public.user_can_manage_pos(location_id));

-- Create policy for updating POS credentials - only allow users who can manage POS for that location
CREATE POLICY "pos_provider_credentials_update" 
ON public.pos_provider_credentials 
FOR UPDATE 
USING (public.user_can_manage_pos(location_id)) 
WITH CHECK (public.user_can_manage_pos(location_id));

-- Create policy for deleting POS credentials - only allow users who can manage POS for that location
CREATE POLICY "pos_provider_credentials_delete" 
ON public.pos_provider_credentials 
FOR DELETE 
USING (public.user_can_manage_pos(location_id));