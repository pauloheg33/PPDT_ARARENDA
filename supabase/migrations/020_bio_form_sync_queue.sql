-- ==========================================================
-- PPDT Ararendá — Fila de sincronização da ficha biográfica
-- Migration: 020_bio_form_sync_queue.sql
-- ==========================================================

CREATE TABLE public.bio_form_sync_queue (
  student_id    UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'error')),
  requested_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  synced_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_error    TEXT,
  synced_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bio_form_sync_queue_status
  ON public.bio_form_sync_queue(status, updated_at DESC);

ALTER TABLE public.bio_form_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bio_form_sync_queue_select_admin"
  ON public.bio_form_sync_queue FOR SELECT
  USING (public.get_user_role() = 'ADMIN_SME');

CREATE POLICY "bio_form_sync_queue_insert_admin"
  ON public.bio_form_sync_queue FOR INSERT
  WITH CHECK (public.get_user_role() = 'ADMIN_SME');

CREATE POLICY "bio_form_sync_queue_update_admin"
  ON public.bio_form_sync_queue FOR UPDATE
  USING (public.get_user_role() = 'ADMIN_SME')
  WITH CHECK (public.get_user_role() = 'ADMIN_SME');

CREATE POLICY "bio_form_sync_queue_delete_admin"
  ON public.bio_form_sync_queue FOR DELETE
  USING (public.get_user_role() = 'ADMIN_SME');

INSERT INTO public.bio_form_sync_queue (student_id, status)
SELECT bf.student_id, 'pending'
FROM public.bio_forms bf
WHERE bf.completed = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.instrumental_uploads iu
    WHERE iu.student_id = bf.student_id
      AND iu.type = 'ficha_biografica'
  )
ON CONFLICT (student_id) DO NOTHING;
