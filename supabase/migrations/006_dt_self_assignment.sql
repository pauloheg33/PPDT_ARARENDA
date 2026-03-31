-- ==========================================================
-- PPDT Ararendá — DT Self-Assignment (Escolha de Turma pelo Professor)
-- Migration: 006_dt_self_assignment.sql
-- ==========================================================

-- Permitir DT ver TODAS as escolas (para poder escolher)
-- antes de se vincular a uma turma
DROP POLICY IF EXISTS "schools_select_dt" ON public.schools;
CREATE POLICY "schools_select_dt"
  ON public.schools FOR SELECT
  USING (public.get_user_role() = 'DT');

-- Permitir DT ver TODAS as turmas (para poder escolher)
-- antes de se vincular
DROP POLICY IF EXISTS "classrooms_select_dt" ON public.classrooms;
CREATE POLICY "classrooms_select_dt"
  ON public.classrooms FOR SELECT
  USING (public.get_user_role() = 'DT');

-- Permitir DT atualizar seu próprio perfil (school_id, classroom_id) UMA VEZ
DROP POLICY IF EXISTS "profiles_update_self_dt" ON public.profiles;
CREATE POLICY "profiles_update_self_dt"
  ON public.profiles FOR UPDATE
  USING (
    user_id = auth.uid()
    AND public.get_user_role() = 'DT'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.get_user_role() = 'DT'
  );

-- Permitir DT atualizar classroom para se vincular (dt_user_id)
DROP POLICY IF EXISTS "classrooms_update_dt_claim" ON public.classrooms;
CREATE POLICY "classrooms_update_dt_claim"
  ON public.classrooms FOR UPDATE
  USING (
    public.get_user_role() = 'DT'
    AND (dt_user_id IS NULL OR dt_user_id = auth.uid())
  )
  WITH CHECK (
    public.get_user_role() = 'DT'
    AND (dt_user_id IS NULL OR dt_user_id = auth.uid())
  );
