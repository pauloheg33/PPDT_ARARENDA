-- ==========================================================
-- PPDT Ararendá — Notificações automáticas de autoaprovação
-- Migration: 018_notifications_self_auto_review.sql
-- ==========================================================

CREATE POLICY "notifications_insert_self_instrumental_review"
  ON public.notifications FOR INSERT
  WITH CHECK (
    recipient_user_id = auth.uid()
    AND created_by = auth.uid()
    AND type = 'instrumental_review'
  );
