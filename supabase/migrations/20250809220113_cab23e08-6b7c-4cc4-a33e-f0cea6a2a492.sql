-- Ensure extensions
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Idempotent schedule via simple text literal (avoid dollar-quoting issues)
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'pos-sync-15min') then
    perform cron.schedule(
      'pos-sync-15min',
      '*/15 * * * *',
      'select net.http_post(url:=''https://ipjidjijilhpblxrnaeg.supabase.co/functions/v1/pos-sync'', headers:=''{""Content-Type"": ""application/json"", ""Authorization"": ""Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwamlkamlqaWxocGJseHJuYWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NjQ1NjUsImV4cCI6MjA3MDI0MDU2NX0.fzYgzPAWcz2bJE3zfxXEVUE3vbdf2cHa0ZSuVBLZ7vo""}''::jsonb, body:=''{}''::jsonb)'
    );
  end if;
end $$;