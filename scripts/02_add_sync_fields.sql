-- =============================================
-- MIGRACIÓN CONTACTOS: SOPORTE SINCRONIZACIÓN
-- =============================================

-- 1. Agregar columnas para IDs externos si no existen
-- Nota: google_contact_id y outlook_contact_id ya podrían estar en los types pero verificamos en BD

DO $$ 
BEGIN 
    -- Columna Google Contact ID (Resource Name de People API)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contactos' AND column_name = 'google_contact_id') THEN
        ALTER TABLE public.contactos ADD COLUMN google_contact_id TEXT;
    END IF;

    -- Columna Outlook (Microsoft Graph ID)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contactos' AND column_name = 'outlook_contact_id') THEN
        ALTER TABLE public.contactos ADD COLUMN outlook_contact_id TEXT;
    END IF;

    -- Columna Estado de Sincronización
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contactos' AND column_name = 'sync_status') THEN
        ALTER TABLE public.contactos ADD COLUMN sync_status TEXT DEFAULT 'pending'; -- pending, synced, error
    END IF;

    -- Columna Fecha Última Sincronización
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contactos' AND column_name = 'last_synced_at') THEN
        ALTER TABLE public.contactos ADD COLUMN last_synced_at TIMESTAMPTZ;
    END IF;

    -- Columna para Errores de Sincronización
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contactos' AND column_name = 'sync_error') THEN
        ALTER TABLE public.contactos ADD COLUMN sync_error TEXT;
    END IF;
END $$;

-- 2. Crear índices para búsquedas rápidas en sincronización inversa
CREATE INDEX IF NOT EXISTS idx_contactos_google_id ON public.contactos(google_contact_id);
CREATE INDEX IF NOT EXISTS idx_contactos_outlook_id ON public.contactos(outlook_contact_id);
