-- ============================================================
-- NextGen Predict — 0010 Storage Object Policies
-- Run this in Supabase Dashboard → Storage → Policies,
-- OR via SQL Editor while connected as a superuser role.
-- These require ownership of storage.objects (supabase_storage_admin).
-- ============================================================

drop policy if exists kyc_owner_insert on storage.objects;
create policy kyc_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists kyc_owner_select on storage.objects;
create policy kyc_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

drop policy if exists kyc_owner_update on storage.objects;
create policy kyc_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists receipts_owner_insert on storage.objects;
create policy receipts_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'deposit-receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists receipts_owner_select on storage.objects;
create policy receipts_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'deposit-receipts'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

drop policy if exists public_assets_read on storage.objects;
create policy public_assets_read on storage.objects for select
  using (bucket_id = 'public-assets');

drop policy if exists public_assets_admin_write on storage.objects;
create policy public_assets_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'public-assets' and public.is_admin())
  with check (bucket_id = 'public-assets' and public.is_admin());
