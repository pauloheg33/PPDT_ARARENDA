-- ==========================================================
-- PPDT Ararendá — Módulo Instrumentais do PPDT
-- Migration: 010_instrumentais.sql
-- Apenas ADIÇÕES — nenhuma tabela existente é alterada.
-- ==========================================================

-- ==================== TABELAS ====================

CREATE TABLE public.instrumental_uploads (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  school_id     UUID        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  classroom_id  UUID        NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_id    UUID        REFERENCES public.students(id) ON DELETE SET NULL,
  type          TEXT        NOT NULL CHECK (type IN (
                              'ficha_biografica',
                              'registro_dialogos',
                              'situacoes_diversas',
                              'visita_domiciliar',
                              'ata_reuniao'
                            )),
  storage_path      TEXT    NOT NULL,
  original_filename TEXT,
  reference_date    DATE    NOT NULL DEFAULT CURRENT_DATE,
  observations      TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.biblioteca_modelos (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  category     TEXT    NOT NULL CHECK (category IN ('instrumentais_ppdt', 'documentos_apoio')),
  name         TEXT    NOT NULL,
  description  TEXT,
  external_url TEXT    NOT NULL,
  file_type    TEXT    CHECK (file_type IN ('word', 'pdf', 'outro')),
  active       BOOLEAN DEFAULT true,
  created_by   UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- ==================== ÍNDICES ====================

CREATE INDEX idx_instrumental_uploads_classroom ON public.instrumental_uploads(classroom_id);
CREATE INDEX idx_instrumental_uploads_uploaded_by ON public.instrumental_uploads(uploaded_by);
CREATE INDEX idx_instrumental_uploads_student ON public.instrumental_uploads(student_id);
CREATE INDEX idx_biblioteca_modelos_category ON public.biblioteca_modelos(category);

-- ==================== STORAGE ====================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'instrumentais',
  'instrumentais',
  false,
  10485760,  -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ==================== RLS ====================

ALTER TABLE public.instrumental_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biblioteca_modelos    ENABLE ROW LEVEL SECURITY;

-- ---- instrumental_uploads ----

-- DT: vê e gerencia apenas os próprios uploads
CREATE POLICY "instr_uploads_select_own"
  ON public.instrumental_uploads FOR SELECT
  USING (
    public.get_user_role() = 'DT'
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "instr_uploads_insert_dt"
  ON public.instrumental_uploads FOR INSERT
  WITH CHECK (
    public.get_user_role() IN ('ADMIN_SME', 'DT')
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "instr_uploads_update_own"
  ON public.instrumental_uploads FOR UPDATE
  USING (
    public.get_user_role() = 'DT'
    AND uploaded_by = auth.uid()
  );

-- Gestor: visualiza uploads da própria escola
CREATE POLICY "instr_uploads_select_gestor"
  ON public.instrumental_uploads FOR SELECT
  USING (
    public.get_user_role() = 'GESTOR_ESCOLA'
    AND school_id = public.get_user_school_id()
  );

-- Coord e Admin: visualiza tudo
CREATE POLICY "instr_uploads_select_admin_coord"
  ON public.instrumental_uploads FOR SELECT
  USING (public.get_user_role() IN ('ADMIN_SME', 'COORD_PPDT'));

-- Admin: pode excluir qualquer upload
CREATE POLICY "instr_uploads_delete_admin"
  ON public.instrumental_uploads FOR DELETE
  USING (public.get_user_role() = 'ADMIN_SME');

-- ---- biblioteca_modelos ----

-- Todos autenticados: leitura de modelos ativos
CREATE POLICY "biblioteca_select_auth"
  ON public.biblioteca_modelos FOR SELECT
  USING (auth.uid() IS NOT NULL AND active = true);

-- Admin: leitura total (inclusive inativos)
CREATE POLICY "biblioteca_select_admin"
  ON public.biblioteca_modelos FOR SELECT
  USING (public.get_user_role() = 'ADMIN_SME');

-- Admin: escrita total
CREATE POLICY "biblioteca_insert_admin"
  ON public.biblioteca_modelos FOR INSERT
  WITH CHECK (public.get_user_role() = 'ADMIN_SME');

CREATE POLICY "biblioteca_update_admin"
  ON public.biblioteca_modelos FOR UPDATE
  USING (public.get_user_role() = 'ADMIN_SME');

CREATE POLICY "biblioteca_delete_admin"
  ON public.biblioteca_modelos FOR DELETE
  USING (public.get_user_role() = 'ADMIN_SME');

-- ==================== STORAGE POLICIES ====================

CREATE POLICY "instr_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'instrumentais'
    AND public.get_user_role() IN ('ADMIN_SME', 'DT')
  );

CREATE POLICY "instr_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'instrumentais');

CREATE POLICY "instr_storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'instrumentais'
    AND public.get_user_role() IN ('ADMIN_SME', 'DT')
  );

CREATE POLICY "instr_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'instrumentais'
    AND public.get_user_role() IN ('ADMIN_SME', 'DT')
  );
