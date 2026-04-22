-- ==========================================================
-- PPDT Ararendá — Leitura pública de escolas e turmas
-- Migration: 009_public_schools_classrooms_read.sql
--
-- Permite que usuários não autenticados (anon) leiam escolas
-- e turmas para preencher o formulário de auto-cadastro.
-- Dados de estrutura organizacional não são sensíveis.
-- ==========================================================

CREATE POLICY "schools_select_anon"
  ON public.schools FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "classrooms_select_anon"
  ON public.classrooms FOR SELECT
  TO anon
  USING (true);
