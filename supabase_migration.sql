-- Deone – Supabase migration
-- Pegar y ejecutar en: Supabase → SQL Editor

-- ─── 0. FCM token en tabla de conductores ─────────────────
-- Ejecutar en la base de datos del backend (Railway/Postgres)
-- ALTER TABLE conductores ADD COLUMN IF NOT EXISTS fcm_token TEXT;
-- ALTER TABLE conductores ADD COLUMN IF NOT EXISTS estado_cuenta TEXT NOT NULL DEFAULT 'pendiente'
--   CHECK (estado_cuenta IN ('pendiente', 'activo', 'rechazado'));
-- ALTER TABLE conductores ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;
--
-- Nuevos endpoints requeridos en el backend (FastAPI):
--
-- PATCH /conductor/{uid}/fcm-token
--   body: { fcm_token: str }
--   → UPDATE conductores SET fcm_token = :token WHERE uid = :uid
--
-- GET /conductor/{uid}/estado
--   → SELECT estado_cuenta, motivo_rechazo FROM conductores WHERE uid = :uid
--
-- PATCH /admin/conductor/{id}/aprobar  (ya existe, agregar FCM push)
--   → UPDATE conductores SET estado_cuenta = 'activo'
--   → messaging.send(Message(token=fcm_token,
--        notification=Notification(title="✅ Cuenta activada",
--                                  body="Ya puedes recibir viajes en Deone")))
--
-- PATCH /admin/conductor/{id}/rechazar  (ya existe, agregar FCM push)
--   → UPDATE conductores SET estado_cuenta = 'rechazado', motivo_rechazo = :motivo
--   → messaging.send(Message(token=fcm_token,
--        notification=Notification(title="Solicitud rechazada",
--                                  body=motivo)))
--
-- POST /services/crear  (cuando llega una nueva solicitud de cliente)
--   → SELECT fcm_token FROM conductores
--       WHERE disponible = true AND tipo_vehiculo = :tipo AND estado_cuenta = 'activo'
--   → messaging.send_each_for_multicast(MulticastMessage(
--        tokens=[...fcm_tokens],
--        notification=Notification(
--          title="Nueva solicitud 🚗",
--          body=f"{origen} → {destino} · ${precio:,}"),
--        data={"service_id": str(service_id), "screen": "Home"},
--        android=AndroidConfig(
--          priority="high",
--          notification=AndroidNotification(channel_id="solicitudes"))))
--

-- ─── 1. conductor_documentos ──────────────────────────────
CREATE TABLE IF NOT EXISTS conductor_documentos (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conductor_id   text        NOT NULL,
  tipo_documento text        NOT NULL CHECK (tipo_documento IN (
    'foto_perfil', 'cedula_frente', 'cedula_reverso',
    'licencia', 'soat', 'foto_vehiculo'
  )),
  url_documento  text,
  estado         text        NOT NULL DEFAULT 'pendiente'
                             CHECK (estado IN ('pendiente','aprobado','rechazado')),
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conductor_documentos_conductor_id
  ON conductor_documentos (conductor_id);

-- ─── 2. conductor_vehiculos ───────────────────────────────
CREATE TABLE IF NOT EXISTS conductor_vehiculos (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conductor_id   text        NOT NULL UNIQUE,
  marca          text,
  modelo         text,
  placa          text,
  color          text,
  año            int,
  tipo_servicio  text,
  created_at     timestamptz DEFAULT now()
);

-- ─── 3. Row-Level Security ────────────────────────────────
ALTER TABLE conductor_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE conductor_vehiculos  ENABLE ROW LEVEL SECURITY;
-- El backend usa service_role key → acceso total sin políticas adicionales.

-- ─── 4. Storage bucket: documentos-conductores ───────────
-- Crea el bucket con acceso público (o actualiza si ya existe).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-conductores',
  'documentos-conductores',
  true,        -- acceso público: las URLs funcionan sin autenticación
  5242880,     -- límite 5 MB por archivo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public            = true,
      file_size_limit   = 5242880,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- ─── 5. Políticas de Storage ──────────────────────────────
-- Eliminar políticas previas para que el script sea idempotente
DROP POLICY IF EXISTS "documentos_public_read"          ON storage.objects;
DROP POLICY IF EXISTS "documentos_service_insert"       ON storage.objects;
DROP POLICY IF EXISTS "documentos_service_update"       ON storage.objects;
DROP POLICY IF EXISTS "documentos_service_delete"       ON storage.objects;

-- Cualquier persona puede leer (URLs públicas funcionan)
CREATE POLICY "documentos_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'documentos-conductores');

-- Solo el service_role (backend) puede subir, actualizar y borrar
CREATE POLICY "documentos_service_insert"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'documentos-conductores');

CREATE POLICY "documentos_service_update"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'documentos-conductores');

CREATE POLICY "documentos_service_delete"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'documentos-conductores');
