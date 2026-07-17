-- Migration: 008_allow_logistics_profiles_select
-- Description: Allow logistics employees to view customer profiles (using public.is_staff instead of public.is_admin)
-- Rollback:
--   drop policy if exists profiles_select on public.profiles;
--   create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_admin(auth.uid())));

drop policy if exists profiles_select on public.profiles;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid())
         or (select public.is_staff(auth.uid())));
