-- ==========================================================
-- PPDT Ararendá — Auditoria de Instrumentais para Admin
-- Migration: 012_admin_instrumental_audit.sql
-- ==========================================================

-- ==================== ADICIONAR CAMPOS DE AUDITORIA ====================

ALTER TABLE public.instrumental_uploads
ADD COLUMN reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN reviewed_at TIMESTAMPTZ,
ADD COLUMN review_notes TEXT;

-- ==================== CRIAR TABELA DE LOG DE DOWNLOADS ====================

CREATE TABLE public.instrumental_downloads_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  upload_id     UUID        NOT NULL REFERENCES public.instrumental_uploads(id) ON DELETE CASCADE,
  action        TEXT        NOT NULL CHECK (action IN ('view', 'download')),
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ==================== ÍNDICES ====================

CREATE INDEX idx_instrumental_reviewed ON public.instrumental_uploads(reviewed_by, reviewed_at);
CREATE INDEX idx_downloads_log_admin ON public.instrumental_downloads_log(admin_user_id);
CREATE INDEX idx_downloads_log_upload ON public.instrumental_downloads_log(upload_id);

-- ==================== RLS ====================

ALTER TABLE public.instrumental_downloads_log ENABLE ROW LEVEL SECURITY;

-- Admin: escrita total (insere seus próprios logs)
CREATE POLICY "downloads_log_insert_admin"
  ON public.instrumental_downloads_log FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() = 'ADMIN_SME'
    AND admin_user_id = auth.uid()
  );

-- Admin: leitura de todos os logs
CREATE POLICY "downloads_log_select_admin"
  ON public.instrumental_downloads_log FOR SELECT
  USING (public.get_user_role() = 'ADMIN_SME');

-- ==================== TRIGGER PARA ATUALIZAR AUDIT ====================

CREATE OR REPLACE FUNCTION fn_log_instrumental_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reviewed_by IS NOT NULL AND OLD.reviewed_by IS NULL THEN
    -- Quando marca como revisado, registra timestamp se não estiver preenchido
    IF NEW.reviewed_at IS NULL THEN
      NEW.reviewed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_instrumental_review_update
BEFORE UPDATE ON public.instrumental_uploads
FOR EACH ROW
EXECUTE FUNCTION fn_log_instrumental_update();
