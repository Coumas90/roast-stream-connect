-- Create RPC to get invitation details without accepting it
-- This allows the UI to show invitation context before the user accepts

CREATE OR REPLACE FUNCTION public.get_invitation_details(_token text)
RETURNS TABLE(
  email text,
  role app_role,
  tenant_id uuid,
  tenant_name text,
  location_id uuid,
  location_name text,
  expires_at timestamptz,
  inviter_name text,
  inviter_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hash text;
BEGIN
  -- Hash the token to find the invitation
  v_hash := encode(extensions.digest(_token, 'sha256'), 'hex');
  
  -- Return invitation details with tenant/location/inviter info
  RETURN QUERY
  SELECT 
    i.email,
    i.role,
    i.tenant_id,
    t.name as tenant_name,
    i.location_id,
    l.name as location_name,
    i.expires_at,
    p.full_name as inviter_name,
    p.email as inviter_email
  FROM public.invitations i
  LEFT JOIN public.tenants t ON t.id = i.tenant_id
  LEFT JOIN public.locations l ON l.id = i.location_id
  LEFT JOIN public.profiles p ON p.id = i.created_by
  WHERE i.token_hash = v_hash
    AND i.accepted_at IS NULL
    AND i.expires_at > now();
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_invitation_details(text) TO authenticated;

-- Log the creation
INSERT INTO public.pos_logs (level, scope, message, meta)
VALUES (
  'info',
  'security_audit',
  'Created get_invitation_details RPC for improved invitation UX',
  jsonb_build_object(
    'function', 'get_invitation_details',
    'purpose', 'Show invitation context before acceptance',
    'timestamp', NOW()
  )
);