-- One-shot manual trigger of pos-sync for Togni / Belgrano
select net.http_post(
  url := 'https://ipjidjijilhpblxrnaeg.supabase.co/functions/v1/pos-sync',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwamlkamlqaWxocGJseHJuYWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NjQ1NjUsImV4cCI6MjA3MDI0MDU2NX0.fzYgzPAWcz2bJE3zfxXEVUE3vbdf2cHa0ZSuVBLZ7vo"}'::jsonb,
  body := '{"location_id":"537b8c24-79e2-40cc-b926-d9828a16066a","provider":"other","kinds":["products","orders"]}'::jsonb
) as request_id;