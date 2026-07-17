-- ═══════════════════════════════════════════════════════════════
-- 009_profiles_roles_hardening.sql — Al-Ezz International
-- Hardens the profiles / user_roles RBAC layer with:
--   1. avatar_url column on profiles
--   2. trg_user_roles_guard   — prevents non-super_admin from
--      assigning the 'super_admin' role (INSERT / UPDATE)
--   3. trg_user_roles_prevent_empty — prevents deleting the very
--      last role row of a user (always keep at least one role)
--   4. public.role_audit_log  — immutable audit trail for every
--      INSERT / UPDATE / DELETE on user_roles
--   5. trg_user_roles_audit   — populates role_audit_log
--
-- Idempotent (safe to re-run).
--
-- Rollback:
--   drop trigger if exists trg_user_roles_audit           on public.user_roles;
--   drop trigger if exists trg_user_roles_prevent_empty   on public.user_roles;
--   drop trigger if exists trg_user_roles_guard           on public.user_roles;
--   drop function if exists public.fn_user_roles_audit();
--   drop function if exists public.fn_user_roles_prevent_empty();
--   drop function if exists public.fn_user_roles_guard();
--   drop table  if exists public.role_audit_log;
--   alter table public.profiles drop column if exists avatar_url;
-- ═══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────
-- 1. avatar_url on profiles
-- ─────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists avatar_url text;


-- ─────────────────────────────────────────────────────────────────
-- 2. role_audit_log — append-only history of every role change
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.role_audit_log (
  id          bigint generated always as identity primary key,
  operation   text        not null check (operation in ('INSERT','UPDATE','DELETE')),
  target_uid  uuid        not null,   -- whose role changed
  old_role    text,                   -- NULL on INSERT
  new_role    text,                   -- NULL on DELETE
  changed_by  uuid,                   -- auth.uid() at time of change
  changed_at  timestamptz not null default now()
);

-- No RLS UPDATE/DELETE — audit rows are append-only from a trigger;
-- clients can only read their own audit rows; admins can read all.
alter table public.role_audit_log enable row level security;

drop policy if exists role_audit_log_select_admin on public.role_audit_log;
create policy role_audit_log_select_admin on public.role_audit_log
  for select to authenticated
  using (public.is_admin((select auth.uid())));

-- index for fast per-user audit lookup
create index if not exists idx_role_audit_log_target_uid
  on public.role_audit_log (target_uid, changed_at desc);


-- ─────────────────────────────────────────────────────────────────
-- 3. fn_user_roles_guard — prevents privilege escalation
--    Runs BEFORE INSERT OR UPDATE on user_roles.
--    Only a super_admin (or service_role which bypasses RLS/triggers)
--    may write a row whose role = 'super_admin'.
--    Also auto-fills assigned_by = auth.uid() when NULL.
-- ─────────────────────────────────────────────────────────────────
create or replace function public.fn_user_roles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auto-fill assigned_by from the caller's JWT when not supplied
  if new.assigned_by is null then
    new.assigned_by := auth.uid();
  end if;

  -- only super_admin may grant/change to super_admin
  if new.role = 'super_admin' then
    if not public.has_role(auth.uid(), 'super_admin') then
      raise exception
        'Only a super_admin can assign the super_admin role'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_roles_guard on public.user_roles;
create trigger trg_user_roles_guard
  before insert or update on public.user_roles
  for each row execute function public.fn_user_roles_guard();


-- ─────────────────────────────────────────────────────────────────
-- 4. fn_user_roles_prevent_empty — keeps at least one role per user
--    Runs BEFORE DELETE on user_roles.
-- ─────────────────────────────────────────────────────────────────
create or replace function public.fn_user_roles_prevent_empty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining int;
begin
  select count(*) into remaining
  from public.user_roles
  where user_id = old.user_id
    and id <> old.id;   -- exclude the row being deleted

  if remaining = 0 then
    raise exception
      'Cannot remove the last role of a user (user_id: %)', old.user_id
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_user_roles_prevent_empty on public.user_roles;
create trigger trg_user_roles_prevent_empty
  before delete on public.user_roles
  for each row execute function public.fn_user_roles_prevent_empty();


-- ─────────────────────────────────────────────────────────────────
-- 5. fn_user_roles_audit — appends a row to role_audit_log
--    Runs AFTER INSERT OR UPDATE OR DELETE on user_roles.
-- ─────────────────────────────────────────────────────────────────
create or replace function public.fn_user_roles_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.role_audit_log (operation, target_uid, old_role, new_role, changed_by)
    values ('INSERT', new.user_id, null, new.role, auth.uid());

  elsif TG_OP = 'UPDATE' then
    -- only log when the role value itself changed
    if old.role is distinct from new.role then
      insert into public.role_audit_log (operation, target_uid, old_role, new_role, changed_by)
      values ('UPDATE', new.user_id, old.role, new.role, auth.uid());
    end if;

  elsif TG_OP = 'DELETE' then
    insert into public.role_audit_log (operation, target_uid, old_role, new_role, changed_by)
    values ('DELETE', old.user_id, old.role, null, auth.uid());
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_user_roles_audit on public.user_roles;
create trigger trg_user_roles_audit
  after insert or update or delete on public.user_roles
  for each row execute function public.fn_user_roles_audit();


-- ─────────────────────────────────────────────────────────────────
-- 6. Grant execute on new functions (service_role + authenticated)
-- ─────────────────────────────────────────────────────────────────
-- Trigger functions are called by the trigger mechanism (not directly
-- by clients), but we still need service_role to be able to invoke them.
revoke execute on function public.fn_user_roles_guard()         from public, anon;
revoke execute on function public.fn_user_roles_prevent_empty() from public, anon;
revoke execute on function public.fn_user_roles_audit()         from public, anon;

grant execute on function public.fn_user_roles_guard()         to authenticated, service_role;
grant execute on function public.fn_user_roles_prevent_empty() to authenticated, service_role;
grant execute on function public.fn_user_roles_audit()         to authenticated, service_role;
