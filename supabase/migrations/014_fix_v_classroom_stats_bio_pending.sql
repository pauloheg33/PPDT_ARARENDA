-- ==========================================================
-- PPDT Ararendá — Corrigir contagem de fichas pendentes
-- Migration: 014_fix_v_classroom_stats_bio_pending.sql
-- ==========================================================

-- A view anterior contava bio_pending com COUNT(bf.student_id), o que
-- ignorava alunos ativos sem linha em bio_forms. Aqui, "pendente" passa
-- a significar qualquer aluno ativo cuja ficha não esteja concluída.
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
  COUNT(s.id) FILTER (WHERE bf.completed = true) AS bio_completed,
  COUNT(s.id) FILTER (WHERE bf.completed IS NOT TRUE) AS bio_pending,
  COUNT(sp.student_id) AS photos_uploaded,
  COUNT(s.id) - COUNT(sp.student_id) AS photos_missing
FROM public.classrooms c
JOIN public.schools sc ON sc.id = c.school_id
LEFT JOIN public.students s ON s.classroom_id = c.id AND s.status = 'Ativo'
LEFT JOIN public.bio_forms bf ON bf.student_id = s.id
LEFT JOIN public.student_photos sp ON sp.student_id = s.id
GROUP BY c.id, c.school_id, sc.name, c.year_grade, c.label, c.shift;
