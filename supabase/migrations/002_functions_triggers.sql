-- ═══════════════════════════════════════════════════════════════
-- 002_functions_triggers.sql — role helpers + automation triggers
-- All functions: SECURITY DEFINER + pinned search_path (advisor-clean).
-- The definer functions are what lets RLS policies check roles
-- WITHOUT infinite recursion on user_roles.
--
-- Rollback:
--   drop trigger if exists on_auth_user_created on auth.users;
--   drop trigger if exists trg_orders_notify_status on public.orders;
--   drop function if exists public.handle_new_user();
--   drop function if exists public.notify_order_status();
--   drop function if exists public.phone_taken(text);
--   drop function if exists public.is_staff(uuid);
--   drop function if exists public.is_admin(uuid);
--   drop function if exists public.has_role(uuid, text);
-- ═══════════════════════════════════════════════════════════════

-- ── role checks ──────────────────────────────────────────────────
create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('admin','super_admin')
  );
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('admin','super_admin','logistics')
  );
$$;

-- role checks are for signed-in policy evaluation only — keep anon out
revoke execute on function public.has_role(uuid, text) from public, anon;
revoke execute on function public.is_admin(uuid)       from public, anon;
revoke execute on function public.is_staff(uuid)       from public, anon;
grant  execute on function public.has_role(uuid, text) to authenticated, service_role;
grant  execute on function public.is_admin(uuid)       to authenticated, service_role;
grant  execute on function public.is_staff(uuid)       to authenticated, service_role;

-- ── signup trigger: profile + hardcoded 'customer' role ─────────
-- SECURITY: the role is a literal 'customer'. Nothing a client puts
-- in signup metadata can ever influence the assigned role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  begin
    insert into public.profiles (id, email, full_name, phone_number)
    values (
      new.id,
      new.email,
      nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
      nullif(trim(coalesce(new.raw_user_meta_data->>'phone_number', '')), '')
    )
    on conflict (id) do nothing;
  exception when unique_violation then
    -- phone_number already taken by another account: never abort the
    -- signup — store the profile without the phone instead.
    insert into public.profiles (id, email, full_name)
    values (
      new.id,
      new.email,
      nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '')
    )
    on conflict (id) do nothing;
  end;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── order status → in-app notification ──────────────────────────
create or replace function public.notify_order_status()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_label text;
begin
  v_label := case new.status
    when 'pending_payment'    then 'بانتظار الدفع'
    when 'secured_in_korea'   then 'تم تأمين سيارتك في كوريا'
    when 'shipping'           then 'سيارتك في طريقها إليك (شحن بحري)'
    when 'at_port'            then 'وصلت سيارتك إلى الميناء'
    when 'customs'            then 'سيارتك في التخليص الجمركي'
    when 'ready_for_delivery' then 'سيارتك جاهزة للتسليم'
    when 'delivered'          then 'تم تسليم سيارتك بنجاح 🎉'
    else new.status
  end;

  insert into public.in_app_notifications (user_id, title, message)
  values (new.customer_id, 'تحديث حالة طلبك', 'حالة طلبك الآن: ' || v_label);

  return new;
end;
$$;

drop trigger if exists trg_orders_notify_status on public.orders;
create trigger trg_orders_notify_status
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function public.notify_order_status();

-- ── signup UX: pre-check phone uniqueness ────────────────────────
-- Called from auth.html BEFORE signUp() so the user gets a clear
-- Arabic error instead of an opaque "Database error saving new user".
create or replace function public.phone_taken(_phone text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where phone_number = _phone
  );
$$;

grant execute on function public.phone_taken(text) to anon, authenticated, service_role;
