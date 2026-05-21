-- ==========================================================
-- PPDT Ararendá — Configuração de modo de revisão de instrumentais
-- Migration: 017_instrumental_review_mode.sql
-- ==========================================================

CREATE TABLE public.instrumental_review_settings (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  review_mode_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.instrumental_review_settings (id, review_mode_enabled)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.instrumental_review_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_settings_select_auth"
  ON public.instrumental_review_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "review_settings_insert_admin"
  ON public.instrumental_review_settings FOR INSERT
  WITH CHECK (
    public.get_user_role() = 'ADMIN_SME'
    AND updated_by = auth.uid()
  );

CREATE POLICY "review_settings_update_admin"
  ON public.instrumental_review_settings FOR UPDATE
  USING (public.get_user_role() = 'ADMIN_SME')
  WITH CHECK (
    public.get_user_role() = 'ADMIN_SME'
    AND updated_by = auth.uid()
  );
