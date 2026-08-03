-- Promote an account to admin.
--
-- The app can auto-promote emails listed in ADMIN_BOOTSTRAP_EMAILS, but that
-- only works if the variable is set in the deployed environment. Run this in
-- the Supabase SQL Editor to grant admin directly.
--
-- Replace the email below with your own, then run the whole file.

update public.users
set role = 'admin'
where lower(email) = lower('you@example.com');

-- Confirm it applied. Expect one row with role = admin.
select id, email, role, status
from public.users
where lower(email) = lower('you@example.com');
