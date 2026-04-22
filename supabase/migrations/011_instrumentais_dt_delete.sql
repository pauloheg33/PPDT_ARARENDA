-- ==========================================================
-- PPDT Ararendá — Permitir DT excluir seus próprios uploads
-- Migration: 011_instrumentais_dt_delete.sql
-- ==========================================================

CREATE POLICY "instr_uploads_delete_dt"
  ON public.instrumental_uploads FOR DELETE
  USING (
    public.get_user_role() = 'DT'
    AND uploaded_by = auth.uid()
  );
