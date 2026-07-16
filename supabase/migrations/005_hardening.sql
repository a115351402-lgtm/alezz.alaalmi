-- ═══════════════════════════════════════════════════════════════
-- 005_hardening.sql — advisor-driven hardening after 001–004
--
-- 1) Trigger functions must not be callable via the REST RPC API.
-- 2) Public buckets: object URLs stay public, but LISTING the bucket
--    contents via the API becomes admin-only.
-- 3) Consolidate multiple permissive policies into one policy per
--    (role, action) — performance lint 0006 — and wrap role-helper
--    calls as (select ...) so they evaluate once per query.
--
-- Intentionally kept (documented, not bugs):
--  * phone_taken() stays executable by anon — the signup page must
--    pre-check phone uniqueness before an account exists.
--  * has_role/is_admin/is_staff stay executable by authenticated —
--    RLS policies run as the querying role and need EXECUTE.
-- ═══════════════════════════════════════════════════════════════

-- ── 1) lock trigger functions away from the API ─────────────────
revoke execute on function public.handle_new_user()     from public, anon, authenticated;
revoke execute on function public.notify_order_status() from public, anon, authenticated;

-- ── 2) storage: admin-only listing for the public buckets ───────
drop policy if exists "vehicle_images_public_read" on storage.objects;
create policy "vehicle_images_admin_list" on storage.objects
  for select to authenticated
  using (bucket_id = 'vehicle-images'
         and (select public.is_admin(auth.uid())));

drop policy if exists "inspection_reports_public_read" on storage.objects;
create policy "inspection_reports_admin_list" on storage.objects
  for select to authenticated
  using (bucket_id = 'inspection-reports'
         and (select public.is_admin(auth.uid())));

-- ── 3) consolidated RLS policies (one per role+action) ──────────

-- profiles ────────────────────────────────────────────────────────
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_admin_all  on public.profiles;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid())
         or (select public.is_admin(auth.uid())));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid())
         or (select public.is_admin(auth.uid())))
  with check (id = (select auth.uid())
              or (select public.is_admin(auth.uid())));

create policy profiles_insert_admin on public.profiles
  for insert to authenticated
  with check ((select public.is_admin(auth.uid())));

create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using ((select public.is_admin(auth.uid())));

-- user_roles ──────────────────────────────────────────────────────
drop policy if exists user_roles_select_own     on public.user_roles;
drop policy if exists user_roles_select_admin   on public.user_roles;
drop policy if exists user_roles_superadmin_all on public.user_roles;

create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid())
         or (select public.is_admin(auth.uid())));

create policy user_roles_insert_superadmin on public.user_roles
  for insert to authenticated
  with check ((select public.has_role(auth.uid(), 'super_admin')));

create policy user_roles_update_superadmin on public.user_roles
  for update to authenticated
  using ((select public.has_role(auth.uid(), 'super_admin')))
  with check ((select public.has_role(auth.uid(), 'super_admin')));

create policy user_roles_delete_superadmin on public.user_roles
  for delete to authenticated
  using ((select public.has_role(auth.uid(), 'super_admin')));

-- vehicles ────────────────────────────────────────────────────────
drop policy if exists vehicles_select_approved     on public.vehicles;
drop policy if exists vehicles_select_own_order    on public.vehicles;
drop policy if exists vehicles_select_own_favorite on public.vehicles;
drop policy if exists vehicles_admin_all           on public.vehicles;

-- visitors: approved cars only
create policy vehicles_select_anon on public.vehicles
  for select to anon
  using (status = 'approved');

-- signed-in: approved cars + own snapshots (via order/favorite) + admin
create policy vehicles_select_auth on public.vehicles
  for select to authenticated
  using (status = 'approved'
         or (select public.is_admin(auth.uid()))
         or exists (
              select 1 from public.orders o
              where o.vehicle_id = vehicles.id
                and o.customer_id = (select auth.uid()))
         or exists (
              select 1 from public.favorites f
              where f.vehicle_id = vehicles.id
                and f.user_id = (select auth.uid())));

create policy vehicles_insert_admin on public.vehicles
  for insert to authenticated
  with check ((select public.is_admin(auth.uid())));

create policy vehicles_update_admin on public.vehicles
  for update to authenticated
  using ((select public.is_admin(auth.uid())))
  with check ((select public.is_admin(auth.uid())));

create policy vehicles_delete_admin on public.vehicles
  for delete to authenticated
  using ((select public.is_admin(auth.uid())));

-- favorites ───────────────────────────────────────────────────────
drop policy if exists favorites_owner_all    on public.favorites;
drop policy if exists favorites_admin_select on public.favorites;

create policy favorites_select on public.favorites
  for select to authenticated
  using (user_id = (select auth.uid())
         or (select public.is_admin(auth.uid())));

create policy favorites_insert_own on public.favorites
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy favorites_update_own on public.favorites
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy favorites_delete_own on public.favorites
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- orders ──────────────────────────────────────────────────────────
drop policy if exists orders_select_own   on public.orders;
drop policy if exists orders_select_staff on public.orders;
drop policy if exists orders_update_staff on public.orders;
drop policy if exists orders_insert_admin on public.orders;

create policy orders_select on public.orders
  for select to authenticated
  using (customer_id = (select auth.uid())
         or (select public.is_staff(auth.uid())));

create policy orders_update_staff on public.orders
  for update to authenticated
  using ((select public.is_staff(auth.uid())))
  with check ((select public.is_staff(auth.uid())));

create policy orders_insert_admin on public.orders
  for insert to authenticated
  with check ((select public.is_admin(auth.uid())));

-- order_milestones ────────────────────────────────────────────────
drop policy if exists milestones_select_own    on public.order_milestones;
drop policy if exists milestones_select_staff  on public.order_milestones;
drop policy if exists milestones_insert_staff  on public.order_milestones;
drop policy if exists milestones_update_staff  on public.order_milestones;
drop policy if exists milestones_delete_admin  on public.order_milestones;

create policy milestones_select on public.order_milestones
  for select to authenticated
  using ((select public.is_staff(auth.uid()))
         or exists (
              select 1 from public.orders o
              where o.id = order_milestones.order_id
                and o.customer_id = (select auth.uid())));

create policy milestones_insert_staff on public.order_milestones
  for insert to authenticated
  with check ((select public.is_staff(auth.uid())));

create policy milestones_update_staff on public.order_milestones
  for update to authenticated
  using ((select public.is_staff(auth.uid())))
  with check ((select public.is_staff(auth.uid())));

create policy milestones_delete_admin on public.order_milestones
  for delete to authenticated
  using ((select public.is_admin(auth.uid())));

-- in_app_notifications: already one policy per action — unchanged.
