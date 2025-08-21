-- Fix security linter warnings by setting search_path on missing functions

-- Fix function search path for normalize_email
CREATE OR REPLACE FUNCTION public.normalize_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
begin
  if new.email is not null then
    new.email := lower(new.email);
  end if;
  return new;
end;
$function$;

-- Fix function search path for set_updated_at  
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;