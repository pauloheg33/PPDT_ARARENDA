-- ==========================================================
-- PPDT Ararendá — Inserção de instrumentais pelo ADMIN_SME
-- Migration: 021_instrumental_uploads_admin_insert.sql
-- ==========================================================

-- Necessário para a sincronização administrativa de fichas biográficas
-- antigas, permitindo que o admin crie o instrumental em nome do DT
-- vinculado à turma sem reescrever policies históricas.

CREATE POLICY "instr_uploads_insert_admin"
  ON public.instrumental_uploads FOR INSERT
  WITH CHECK (public.get_user_role() = 'ADMIN_SME');
