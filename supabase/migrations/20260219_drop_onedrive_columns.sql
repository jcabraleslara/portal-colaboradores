ALTER TABLE public.soportes_facturacion
  DROP COLUMN IF EXISTS onedrive_folder_id,
  DROP COLUMN IF EXISTS onedrive_folder_url,
  DROP COLUMN IF EXISTS onedrive_sync_status,
  DROP COLUMN IF EXISTS onedrive_sync_at;
