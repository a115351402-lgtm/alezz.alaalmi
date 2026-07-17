-- ═══════════════════════════════════════════════════════════════
-- 007_freeze_and_owner.sql — Al-Ezz International: account freeze & owner assign
-- Idempotent (safe to re-run).
--
-- Rollback:
--   drop trigger if exists trg_profiles_freeze_protection on public.profiles;
--   drop function if exists public.check_profile_freeze();
--   alter table public.profiles drop column if exists is_frozen;
-- ═══════════════════════════════════════════════════════════════

-- 1. Add is_frozen column to profiles if not exists
alter table public.profiles
  add column if not exists is_frozen boolean not null default false;

-- 2. Create or replace check_profile_freeze trigger function
create or replace function public.check_profile_freeze()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.is_frozen is distinct from new.is_frozen) then
    if not (exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'super_admin'
    )) then
      raise exception 'Only super_admin can freeze or unfreeze accounts';
    end if;
  end if;
  return new;
end;
$$;

-- 3. Bind the trigger to profiles table
drop trigger if exists trg_profiles_freeze_protection on public.profiles;
create trigger trg_profiles_freeze_protection
  before update on public.profiles
  for each row execute function public.check_profile_freeze();
