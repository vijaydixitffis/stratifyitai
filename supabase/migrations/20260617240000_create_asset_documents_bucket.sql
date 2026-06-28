-- ─────────────────────────────────────────────────────────────────────────────
-- Create the asset-documents Storage bucket and RLS policies
-- Path structure: {org_code}/{asset_id}/{filename}
-- e.g.  ACME-CORP/550e8400-e29b-41d4-a716-446655440000/architecture-design.pdf
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: return the org_code for the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_current_user_org_code()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_code FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Create the bucket (private by default; access via signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'asset-documents',
  'asset-documents',
  false,
  52428800,   -- 50 MB per file
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   -- .docx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', -- .pptx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',         -- .xlsx
    'application/msword',
    'text/plain',
    'text/markdown',
    'text/csv',
    'image/png',
    'image/jpeg'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage RLS policies for asset-documents bucket
-- ─────────────────────────────────────────────────────────────────────────────

-- Admin users: full access to all org folders
CREATE POLICY "admin_full_access_asset_documents"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'asset-documents'
    AND public.is_admin_user()
  )
  WITH CHECK (
    bucket_id = 'asset-documents'
    AND public.is_admin_user()
  );

-- Client users: read/write only their own org's folder (first path segment = org_code)
CREATE POLICY "client_read_own_org_asset_documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'asset-documents'
    AND (storage.foldername(name))[1] = public.get_current_user_org_code()
  );

CREATE POLICY "client_insert_own_org_asset_documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'asset-documents'
    AND (storage.foldername(name))[1] = public.get_current_user_org_code()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('admin', 'admin-super', 'client-architect')
    )
  );

CREATE POLICY "client_delete_own_org_asset_documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'asset-documents'
    AND (storage.foldername(name))[1] = public.get_current_user_org_code()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('admin', 'admin-super', 'client-architect')
    )
  );

-- Service role: unrestricted (for edge functions uploading/reading on behalf of users)
CREATE POLICY "service_role_bypass_asset_documents"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'asset-documents')
  WITH CHECK (bucket_id = 'asset-documents');
