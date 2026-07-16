-- ═══════════════════════════════════════════════════════════════
-- 004_storage.sql — Storage buckets + storage.objects policies
--
--  vehicle-images     public read  · write admin-only
--  inspection-reports public read  · write admin-only
--  user-documents     private      · owner (path {user_id}/...) + admins
--
-- Note: if creating policies on storage.objects is rejected by the
-- hosted role permissions, the identical policies must be created
-- from Dashboard → Storage → Policies instead (documented fallback).
--
-- Rollback: drop the policies by name below; delete the buckets from
-- Dashboard → Storage (buckets with objects must be emptied first).
-- ═══════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values
  ('vehicle-images',     'vehicle-images',     true),
  ('inspection-reports', 'inspection-reports', true),
  ('user-documents',     'user-documents',     false)
on conflict (id) do nothing;

-- ── vehicle-images ───────────────────────────────────────────────
drop policy if exists "vehicle_images_public_read" on storage.objects;
create policy "vehicle_images_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'vehicle-images');

drop policy if exists "vehicle_images_admin_insert" on storage.objects;
create policy "vehicle_images_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vehicle-images'
              and public.is_admin((select auth.uid())));

drop policy if exists "vehicle_images_admin_update" on storage.objects;
create policy "vehicle_images_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'vehicle-images'
         and public.is_admin((select auth.uid())))
  with check (bucket_id = 'vehicle-images'
              and public.is_admin((select auth.uid())));

drop policy if exists "vehicle_images_admin_delete" on storage.objects;
create policy "vehicle_images_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vehicle-images'
         and public.is_admin((select auth.uid())));

-- ── inspection-reports ───────────────────────────────────────────
drop policy if exists "inspection_reports_public_read" on storage.objects;
create policy "inspection_reports_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'inspection-reports');

drop policy if exists "inspection_reports_admin_insert" on storage.objects;
create policy "inspection_reports_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inspection-reports'
              and public.is_admin((select auth.uid())));

drop policy if exists "inspection_reports_admin_update" on storage.objects;
create policy "inspection_reports_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'inspection-reports'
         and public.is_admin((select auth.uid())))
  with check (bucket_id = 'inspection-reports'
              and public.is_admin((select auth.uid())));

drop policy if exists "inspection_reports_admin_delete" on storage.objects;
create policy "inspection_reports_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'inspection-reports'
         and public.is_admin((select auth.uid())));

-- ── user-documents (private: {user_id}/filename path convention) ─
drop policy if exists "user_docs_owner_select" on storage.objects;
create policy "user_docs_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'user-documents'
         and ((storage.foldername(name))[1] = (select auth.uid())::text
              or public.is_admin((select auth.uid()))));

drop policy if exists "user_docs_owner_insert" on storage.objects;
create policy "user_docs_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'user-documents'
              and ((storage.foldername(name))[1] = (select auth.uid())::text
                   or public.is_admin((select auth.uid()))));

drop policy if exists "user_docs_owner_update" on storage.objects;
create policy "user_docs_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'user-documents'
         and ((storage.foldername(name))[1] = (select auth.uid())::text
              or public.is_admin((select auth.uid()))))
  with check (bucket_id = 'user-documents'
              and ((storage.foldername(name))[1] = (select auth.uid())::text
                   or public.is_admin((select auth.uid()))));

drop policy if exists "user_docs_owner_delete" on storage.objects;
create policy "user_docs_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'user-documents'
         and ((storage.foldername(name))[1] = (select auth.uid())::text
              or public.is_admin((select auth.uid()))));
