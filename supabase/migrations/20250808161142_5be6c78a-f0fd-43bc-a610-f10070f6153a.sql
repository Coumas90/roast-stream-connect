begin;

-- Ensure full row data for realtime
alter table public.order_proposals replica identity full;
alter table public.pos_integrations replica identity full;

-- Add tables to supabase_realtime publication safely
DO $$
BEGIN
  BEGIN
    EXECUTE 'alter publication supabase_realtime add table public.order_proposals';
  EXCEPTION WHEN duplicate_object THEN
    -- already added, ignore
    NULL;
  END;
END$$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'alter publication supabase_realtime add table public.pos_integrations';
  EXCEPTION WHEN duplicate_object THEN
    -- already added, ignore
    NULL;
  END;
END$$;

commit;