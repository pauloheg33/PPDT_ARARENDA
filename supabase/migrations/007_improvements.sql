-- ==========================================================
-- PPDT Ararendá — Melhorias e correções
-- Migration: 007_improvements.sql
-- ==========================================================

-- 1. Adicionar school_name na view v_classroom_stats
DROP VIEW IF EXISTS public.v_classroom_stats;
CREATE VIEW public.v_classroom_stats AS
SELECT
  c.id AS classroom_id,
  c.school_id,
  sc.name AS school_name,
  c.year_grade,
  c.label,
  c.shift,
  COUNT(s.id) AS total_students,
  COUNT(bf.student_id) FILTER (WHERE bf.completed = true) AS bio_completed,
  COUNT(bf.student_id) FILTER (WHERE bf.completed = false OR bf.student_id IS NULL) AS bio_pending,
  COUNT(sp.student_id) AS photos_uploaded,
  COUNT(s.id) - COUNT(sp.student_id) AS photos_missing
FROM public.classrooms c
JOIN public.schools sc ON sc.id = c.school_id
LEFT JOIN public.students s ON s.classroom_id = c.id AND s.status = 'Ativo'
LEFT JOIN public.bio_forms bf ON bf.student_id = s.id
LEFT JOIN public.student_photos sp ON sp.student_id = s.id
GROUP BY c.id, c.school_id, sc.name, c.year_grade, c.label, c.shift;

-- 2. Garantir que DT não possa modificar seu próprio role via update do profile
-- A policy permite update de school_id e classroom_id, mas
-- precisamos restringir para que o DT não altere seu role
DROP POLICY IF EXISTS "profiles_update_self_dt" ON public.profiles;
CREATE POLICY "profiles_update_self_dt"
  ON public.profiles FOR UPDATE
  USING (
    user_id = auth.uid()
    AND public.get_user_role() = 'DT'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'DT'
  );

-- 3. Criar index para busca rápida de turmas por escola
CREATE INDEX IF NOT EXISTS idx_classrooms_school ON public.classrooms(school_id);

-- 4. Criar index para busca de profiles por role
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
