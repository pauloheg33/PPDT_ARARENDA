-- ==========================================================
-- PPDT Ararendá — Correções seguras de acesso admin/coord
-- Migration: 013_instrumentais_admin_review_access.sql
-- ==========================================================

-- Admin SME: permitir revisão/atualização de uploads
DROP POLICY IF EXISTS "instr_uploads_update_admin" ON public.instrumental_uploads;
CREATE POLICY "instr_uploads_update_admin"
  ON public.instrumental_uploads FOR UPDATE
  USING (public.get_user_role() = 'ADMIN_SME')
  WITH CHECK (public.get_user_role() = 'ADMIN_SME');

-- Expandir auditoria de acesso a arquivos para ADMIN_SME e COORD_PPDT
DROP POLICY IF EXISTS "downloads_log_insert_admin" ON public.instrumental_downloads_log;
CREATE POLICY "downloads_log_insert_admin_coord"
  ON public.instrumental_downloads_log FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('ADMIN_SME', 'COORD_PPDT')
    AND admin_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "downloads_log_select_admin" ON public.instrumental_downloads_log;
CREATE POLICY "downloads_log_select_admin_coord"
  ON public.instrumental_downloads_log FOR SELECT
  USING (public.get_user_role() IN ('ADMIN_SME', 'COORD_PPDT'));
