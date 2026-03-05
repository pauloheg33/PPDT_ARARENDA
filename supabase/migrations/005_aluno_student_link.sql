-- ==========================================================
-- PPDT Ararendá — Link ALUNO profile to student record
-- Migration: 005_aluno_student_link.sql
-- ==========================================================

-- Adicionar coluna student_id em profiles para vincular ALUNO ao seu registro de aluno
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id) ON DELETE SET NULL;

-- Helper function para obter student_id do usuário
CREATE OR REPLACE FUNCTION public.get_user_student_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT student_id FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Corrigir policy do ALUNO que estava quebrada (comparava students.id com profiles.classroom_id)
DROP POLICY IF EXISTS "students_select_aluno" ON public.students;

CREATE POLICY "students_select_aluno"
  ON public.students FOR SELECT
  USING (
    public.get_user_role() = 'ALUNO'
    AND id = public.get_user_student_id()
  );
