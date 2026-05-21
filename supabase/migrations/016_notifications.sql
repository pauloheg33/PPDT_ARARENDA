-- ==========================================================
-- PPDT Ararendá — Sistema interno de notificações
-- Migration: 016_notifications.sql
-- ==========================================================

CREATE TABLE public.notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type              TEXT NOT NULL CHECK (type IN ('instrumental_review', 'admin_notice')),
  notice_group_id   UUID,
  title             TEXT NOT NULL,
  message           TEXT NOT NULL,
  link_path         TEXT,
  read_at           TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient_created_at
  ON public.notifications(recipient_user_id, created_at DESC);

CREATE INDEX idx_notifications_group
  ON public.notifications(notice_group_id);

CREATE INDEX idx_notifications_created_by
  ON public.notifications(created_by, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_recipient"
  ON public.notifications FOR SELECT
  USING (recipient_user_id = auth.uid());

CREATE POLICY "notifications_select_admin_created"
  ON public.notifications FOR SELECT
  USING (
    public.get_user_role() = 'ADMIN_SME'
    AND created_by = auth.uid()
  );

CREATE POLICY "notifications_insert_admin"
  ON public.notifications FOR INSERT
  WITH CHECK (
    public.get_user_role() = 'ADMIN_SME'
    AND created_by = auth.uid()
  );

CREATE POLICY "notifications_update_recipient"
  ON public.notifications FOR UPDATE
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

CREATE POLICY "notifications_update_admin_created"
  ON public.notifications FOR UPDATE
  USING (
    public.get_user_role() = 'ADMIN_SME'
    AND created_by = auth.uid()
    AND type = 'admin_notice'
  )
  WITH CHECK (
    public.get_user_role() = 'ADMIN_SME'
    AND created_by = auth.uid()
    AND type = 'admin_notice'
  );
