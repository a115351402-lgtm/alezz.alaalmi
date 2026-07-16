-- ═══════════════════════════════════════════════════════════════
-- 001_core_tables.sql — Al-Ezz International: core schema
-- The 7 base tables + updated_at automation + FK/policy indexes.
-- Idempotent (safe to re-run).
--
-- Rollback:
--   drop table if exists public.in_app_notifications cascade;
--   drop table if exists public.order_milestones cascade;
--   drop table if exists public.orders cascade;
--   drop table if exists public.favorites cascade;
--   drop table if exists public.vehicles cascade;
--   drop table if exists public.user_roles cascade;
--   drop table if exists public.profiles cascade;
--   drop function if exists public.set_updated_at();
-- ═══════════════════════════════════════════════════════════════

-- profiles: one row per auth user (created automatically by the
-- signup trigger in 002; email is copied from auth.users so the
-- admin dashboard can list customers without the auth admin API)
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  phone_number text unique,
  full_name    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- user_roles: RBAC. unique(user_id, role) prevents duplicate rows.
create table if not exists public.user_roles (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null
              check (role in ('super_admin','admin','logistics','customer')),
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (user_id, role)
);

-- vehicles: curated inventory + server-made snapshots of external
-- listings (Encar via Carapis / Lotte auctions / manual entries)
create table if not exists public.vehicles (
  id                    uuid primary key default gen_random_uuid(),
  vin                   text unique,
  source                text not null
                        check (source in ('encar','auction','manual')),
  source_id             text,
  make                  text,
  model                 text,
  year                  integer,
  price_krw             numeric,
  price_sar             numeric,
  specs                 jsonb not null default '{}'::jsonb,
  status                text not null default 'pending'
                        check (status in ('pending','approved','sold','hidden')),
  images                text[] not null default '{}',
  inspection_report_url text,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now()
);

-- exactly one snapshot per external listing → idempotent upsert
create unique index if not exists vehicles_source_source_id_key
  on public.vehicles (source, source_id)
  where source_id is not null;

create table if not exists public.favorites (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, vehicle_id)
);

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles(id),
  vehicle_id      uuid not null references public.vehicles(id),
  final_price_sar numeric,
  status          text not null default 'pending_payment'
                  check (status in ('pending_payment','secured_in_korea',
                    'shipping','at_port','customs','ready_for_delivery',
                    'delivered')),
  created_at      timestamptz not null default now()
);

-- order_milestones: the logistics timeline shown to the customer
create table if not exists public.order_milestones (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  step_title       text not null,
  step_description text,
  location         text,
  completed_at     timestamptz not null default now(),
  created_by       uuid references public.profiles(id) on delete set null
);

create table if not exists public.in_app_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  message    text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── updated_at automation ────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── indexes on every FK / policy path ────────────────────────────
create index if not exists idx_user_roles_user_id
  on public.user_roles (user_id);
create index if not exists idx_user_roles_assigned_by
  on public.user_roles (assigned_by);
create index if not exists idx_vehicles_status
  on public.vehicles (status);
create index if not exists idx_vehicles_created_by
  on public.vehicles (created_by);
create index if not exists idx_favorites_user_id
  on public.favorites (user_id);
create index if not exists idx_favorites_vehicle_id
  on public.favorites (vehicle_id);
create index if not exists idx_orders_customer_id
  on public.orders (customer_id);
create index if not exists idx_orders_vehicle_id
  on public.orders (vehicle_id);
create index if not exists idx_orders_status
  on public.orders (status);
create index if not exists idx_order_milestones_order_id
  on public.order_milestones (order_id);
create index if not exists idx_order_milestones_created_by
  on public.order_milestones (created_by);
create index if not exists idx_notifications_user_unread
  on public.in_app_notifications (user_id, is_read);
