-- Promote an account to admin. Run in the Supabase SQL Editor.
--
-- Replace both copies of the email below with your own, then run the file.
--
-- The users table has a guard trigger that rejects role changes unless
-- is_admin() passes, and is_admin() resolves through auth.uid(), which is
-- null here. That is why a plain update raises PROTECTED_COLUMN. The trigger
-- is disabled for this transaction only and restored before it commits, so
-- the protection stays in place for the app.

begin;

alter table public.users disable trigger users_guard_columns;

update public.users
set role = 'admin'
where lower(email) = lower('you@example.com');

alter table public.users enable trigger users_guard_columns;

commit;

-- Confirm it applied. Expect one row with role = admin and status = active.
select id, email, role, status
from public.users
where lower(email) = lower('you@example.com');
