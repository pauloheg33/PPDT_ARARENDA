-- ==========================================================
-- PPDT Ararendá — Storage Bucket Setup
-- Migration: 003_storage_setup.sql
-- ==========================================================

-- Criar bucket para fotos dos alunos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-photos',
  'student-photos',
  false,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Política: qualquer autenticado pode ver fotos
CREATE POLICY "student_photos_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'student-photos' AND auth.uid() IS NOT NULL);

-- Política: DT e ADMIN podem inserir
CREATE POLICY "student_photos_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'student-photos'
    AND (
      EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('ADMIN_SME', 'DT'))
    )
  );

-- Política: DT e ADMIN podem atualizar
CREATE POLICY "student_photos_storage_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'student-photos'
    AND (
      EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('ADMIN_SME', 'DT'))
    )
  );

-- Política: DT e ADMIN podem deletar
CREATE POLICY "student_photos_storage_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'student-photos'
    AND (
      EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('ADMIN_SME', 'DT'))
    )
  );
