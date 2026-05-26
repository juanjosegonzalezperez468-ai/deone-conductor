-- Deone – Supabase migration
-- Run this in the Supabase SQL Editor

-- 1. conductor_documentos
create table if not exists conductor_documentos (
  id            uuid primary key default gen_random_uuid(),
  conductor_id  text not null,
  tipo_documento text not null check (tipo_documento in (
    'foto_perfil', 'cedula_frente', 'cedula_reverso',
    'licencia', 'soat', 'foto_vehiculo'
  )),
  url_documento text,
  estado        text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  created_at    timestamptz default now()
);

create index if not exists idx_conductor_documentos_conductor_id
  on conductor_documentos (conductor_id);

-- 2. conductor_vehiculos
create table if not exists conductor_vehiculos (
  id            uuid primary key default gen_random_uuid(),
  conductor_id  text not null unique,
  marca         text,
  modelo        text,
  placa         text,
  color         text,
  año           int,
  tipo_servicio text,
  created_at    timestamptz default now()
);

-- 3. Storage bucket
-- Run in Storage → Create bucket:
--   Name: documentos-conductores
--   Public: false
--
-- Then add RLS policy to allow service-role inserts:
-- (handled via backend using service role key)

-- 4. Row-Level Security (optional hardening)
alter table conductor_documentos enable row level security;
alter table conductor_vehiculos  enable row level security;

-- Allow backend (service role) full access — no extra policy needed.
-- If using anon key from app, add policies here.
