-- ═══════════════════════════════════════════════════════════════
-- 006_lint_polish.sql — satisfy performance lint 0003 exactly
--
-- The write-action policies from 005 used
--   (select public.is_admin(auth.uid()))
-- which already evaluates once per statement, but the linter wants
-- the auth.uid() itself wrapped too. Rewrite the 13 flagged policies
-- with the fully-wrapped form:
--   (select public.is_admin((select auth.uid())))
-- Behavior is identical; advisor output becomes clean.
-- ═══════════════════════════════════════════════════════════════

-- profiles
alter policy profiles_insert_admin on public.profiles
  with check ((select public.is_admin((select auth.uid()))));

alter policy profiles_delete_admin on public.profiles
  using ((select public.is_admin((select auth.uid()))));

-- user_roles
alter policy user_roles_insert_superadmin on public.user_roles
  with check ((select public.has_role((select auth.uid()), 'super_admin')));

alter policy user_roles_update_superadmin on public.user_roles
  using ((select public.has_role((select auth.uid()), 'super_admin')))
  with check ((select public.has_role((select auth.uid()), 'super_admin')));

alter policy user_roles_delete_superadmin on public.user_roles
  using ((select public.has_role((select auth.uid()), 'super_admin')));

-- vehicles
alter policy vehicles_insert_admin on public.vehicles
  with check ((select public.is_admin((select auth.uid()))));

alter policy vehicles_update_admin on public.vehicles
  using ((select public.is_admin((select auth.uid()))))
  with check ((select public.is_admin((select auth.uid()))));

alter policy vehicles_delete_admin on public.vehicles
  using ((select public.is_admin((select auth.uid()))));

-- orders
alter policy orders_update_staff on public.orders
  using ((select public.is_staff((select auth.uid()))))
  with check ((select public.is_staff((select auth.uid()))));

alter policy orders_insert_admin on public.orders
  with check ((select public.is_admin((select auth.uid()))));

-- order_milestones
alter policy milestones_insert_staff on public.order_milestones
  with check ((select public.is_staff((select auth.uid()))));

alter policy milestones_update_staff on public.order_milestones
  using ((select public.is_staff((select auth.uid()))))
  with check ((select public.is_staff((select auth.uid()))));

alter policy milestones_delete_admin on public.order_milestones
  using ((select public.is_admin((select auth.uid()))));
