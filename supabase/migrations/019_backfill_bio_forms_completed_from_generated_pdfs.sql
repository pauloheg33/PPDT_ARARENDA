-- ==========================================================
-- PPDT Ararendá — Reconciliação de fichas concluídas a partir de PDFs gerados
-- Migration: 019_backfill_bio_forms_completed_from_generated_pdfs.sql
-- ==========================================================

-- Garante que alunos com instrumental de ficha biográfica já gerado
-- apareçam como ficha concluída no dashboard, inclusive para registros antigos.

INSERT INTO public.bio_forms (student_id, sections_json, completed, updated_at)
SELECT DISTINCT
  iu.student_id,
  '{}'::jsonb,
  true,
  now()
FROM public.instrumental_uploads iu
LEFT JOIN public.bio_forms bf
  ON bf.student_id = iu.student_id
WHERE iu.type = 'ficha_biografica'
  AND iu.student_id IS NOT NULL
  AND bf.student_id IS NULL;

UPDATE public.bio_forms bf
SET
  completed = true,
  updated_at = now()
FROM public.instrumental_uploads iu
WHERE iu.type = 'ficha_biografica'
  AND iu.student_id IS NOT NULL
  AND iu.student_id = bf.student_id
  AND bf.completed IS DISTINCT FROM true;
