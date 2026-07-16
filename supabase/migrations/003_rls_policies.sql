-- ═══════════════════════════════════════════════════════════════
-- 003_rls_policies.sql — Row Level Security for all 7 tables
--                        + column grants + Realtime publication
--
-- Conventions:
--  * every auth.uid() is wrapped as (select auth.uid()) — evaluated
--    once per query instead of once per row (performance advisor).
--  * role checks go through the SECURITY DEFINER helpers from 002
--    (has_role / is_admin / is_staff) — no recursion on user_roles.
--  * drop policy if exists before each create → idempotent.
--
-- Security model (per spec):
--  * customers self-assigning roles: impossible (only super_admin
--    writes user_roles; signup trigger hardcodes 'customer').
--  * customer order INSERT is NOT allowed from the client — orders
--    are created by the server endpoint (service role, verified
--    price) or by admins from the dashboard. Customers only read.
--  * notifications: no INSERT policy at all — rows come only from
--    the trigger / service role. Clients may only flip is_read
--    (enforced with a column-level grant).
--
-- Rollback: alter table <t> disable row level security; drop the
-- policies by name (all names below are unique); re-grant update
-- on public.in_app_notifications to authenticated;
-- alter publication supabase_realtime drop table public.orders,
--   public.order_milestones, public.in_app_notifications;
-- ═══════════════════════════════════════════════════════════════

alter table public.profiles             enable row level security;
alter table public.user_roles           enable row level security;
alter table public.vehicles             enable row level security;
alter table public.favorites            enable row level security;
alter table public.orders               enable row level security;
alter table public.order_milestones     enable row level security;
alter table public.in_app_notifications enable row level security;

-- ── profiles ─────────────────────────────────────────────────────
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- ── user_roles ───────────────────────────────────────────────────
drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists user_roles_select_admin on public.user_roles;
create policy user_roles_select_admin on public.user_roles
  for select to authenticated
  using (public.is_admin((select auth.uid())));

drop policy if exists user_roles_superadmin_all on public.user_roles;
create policy user_roles_superadmin_all on public.user_roles
  for all to authenticated
  using (public.has_role((select auth.uid()), 'super_admin'))
  with check (public.has_role((select auth.uid()), 'super_admin'));

-- ── vehicles ─────────────────────────────────────────────────────
-- anyone (even signed out) sees APPROVED vehicles only
drop policy if exists vehicles_select_approved on public.vehicles;
create policy vehicles_select_approved on public.vehicles
  for select to anon, authenticated
  using (status = 'approved');

-- a customer can always see the vehicle linked to their own order /
-- favorite, even while it is still 'pending' (snapshots start pending)
drop policy if exists vehicles_select_own_order on public.vehicles;
create policy vehicles_select_own_order on public.vehicles
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.vehicle_id = vehicles.id
      and o.customer_id = (select auth.uid())
  ));

drop policy if exists vehicles_select_own_favorite on public.vehicles;
create policy vehicles_select_own_favorite on public.vehicles
  for select to authenticated
  using (exists (
    select 1 from public.favorites f
    where f.vehicle_id = vehicles.id
      and f.user_id = (select auth.uid())
  ));

drop policy if exists vehicles_admin_all on public.vehicles;
create policy vehicles_admin_all on public.vehicles
  for all to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- ── favorites ────────────────────────────────────────────────────
drop policy if exists favorites_owner_all on public.favorites;
create policy favorites_owner_all on public.favorites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists favorites_admin_select on public.favorites;
create policy favorites_admin_select on public.favorites
  for select to authenticated
  using (public.is_admin((select auth.uid())));

-- ── orders ───────────────────────────────────────────────────────
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders
  for select to authenticated
  using (customer_id = (select auth.uid()));

drop policy if exists orders_select_staff on public.orders;
create policy orders_select_staff on public.orders
  for select to authenticated
  using (public.is_staff((select auth.uid())));

drop policy if exists orders_update_staff on public.orders;
create policy orders_update_staff on public.orders
  for update to authenticated
  using (public.is_staff((select auth.uid())))
  with check (public.is_staff((select auth.uid())));

-- client-side INSERT is admin-only (manual orders from the dashboard);
-- customer orders arrive via the service-role endpoint with a
-- server-verified price, so no customer INSERT policy exists.
drop policy if exists orders_insert_admin on public.orders;
create policy orders_insert_admin on public.orders
  for insert to authenticated
  with check (public.is_admin((select auth.uid())));

-- ── order_milestones ─────────────────────────────────────────────
drop policy if exists milestones_select_own on public.order_milestones;
create policy milestones_select_own on public.order_milestones
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_milestones.order_id
      and o.customer_id = (select auth.uid())
  ));

drop policy if exists milestones_select_staff on public.order_milestones;
create policy milestones_select_staff on public.order_milestones
  for select to authenticated
  using (public.is_staff((select auth.uid())));

drop policy if exists milestones_insert_staff on public.order_milestones;
create policy milestones_insert_staff on public.order_milestones
  for insert to authenticated
  with check (public.is_staff((select auth.uid())));

drop policy if exists milestones_update_staff on public.order_milestones;
create policy milestones_update_staff on public.order_milestones
  for update to authenticated
  using (public.is_staff((select auth.uid())))
  with check (public.is_staff((select auth.uid())));

-- admins may delete a milestone added by mistake (spec addition)
drop policy if exists milestones_delete_admin on public.order_milestones;
create policy milestones_delete_admin on public.order_milestones
  for delete to authenticated
  using (public.is_admin((select auth.uid())));

-- ── in_app_notifications ─────────────────────────────────────────
drop policy if exists notifications_select_own on public.in_app_notifications;
create policy notifications_select_own on public.in_app_notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notifications_update_own on public.in_app_notifications;
create policy notifications_update_own on public.in_app_notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- column-level hardening: an owner may ONLY flip is_read — title,
-- message, user_id etc. are not updatable by clients at all.
revoke insert, update, delete on public.in_app_notifications from anon, authenticated;
grant update (is_read) on public.in_app_notifications to authenticated;

-- ── Realtime: live order tracking for the customer timeline ─────
do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.order_milestones;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.in_app_notifications;
  exception when duplicate_object then null;
  end;
end $$;
