-- Optional: enable pg_cron in Supabase Dashboard → Database → Extensions first.
-- Run once. All descendants disappear via ON DELETE CASCADE.
select cron.schedule('tarihi-classroom-cleanup','*/15 * * * *','select public.cleanup_classrooms();');
-- Alternative: your scheduler can call the server-only cleanup_classrooms RPC.
-- Expired rooms are denied by the API even before physical cleanup runs.
