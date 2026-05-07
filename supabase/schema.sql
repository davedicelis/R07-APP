-- ============================================================
-- R07 APP — Schema Supabase
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

-- ============================================================
-- TABLA: profiles
-- Se llena automáticamente con datos de Google OAuth al registrar
-- ============================================================
create table if not exists public.profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  full_name  text,
  avatar_url text,
  email      text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Perfiles visibles para todos"
  on public.profiles for select using (true);

create policy "Solo el dueño puede editar su perfil"
  on public.profiles for all
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- Trigger: crear perfil automáticamente al registrar con Google
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- TABLA: r07_data
-- Datos de discipulado por usuario por día
-- ============================================================
create table if not exists public.r07_data (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  day_key    text        not null,   -- formato "YYYY-M-D"  ej. "2026-4-15"
  data       jsonb       not null default '{}',
  updated_at timestamptz not null default now(),

  constraint r07_data_user_day_uq unique (user_id, day_key)
);

-- Índice para cargar un mes completo de forma eficiente
create index if not exists r07_data_user_month_idx
  on public.r07_data (user_id, left(day_key, 7));

alter table public.r07_data enable row level security;

create policy "Solo el dueño accede a sus datos R07"
  on public.r07_data for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger: updated_at automático en cada UPDATE
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger r07_data_updated_at
  before update on public.r07_data
  for each row execute function public.set_updated_at();

-- ============================================================
-- Relaciones:
--   auth.users (Supabase managed)
--     ├─< profiles   (1:1 — creado por trigger)
--     └─< r07_data   (1:N — un usuario, muchos días)
-- ============================================================
