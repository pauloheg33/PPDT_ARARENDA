-- ==========================================================
-- PPDT Ararendá — Reforço de escopo por papel (RLS)
-- Migration: 022_harden_role_scopes.sql
--
-- Não altera dados ou estrutura de tabelas. Esta migration substitui
-- políticas permissivas por regras baseadas no vínculo do perfil.
-- ==========================================================

-- Views devem respeitar a sessão de quem consulta (PostgreSQL 15 / Supabase).
-- Sem esta opção, uma view criada pelo owner pode contornar as RLS das tabelas.
ALTER VIEW public.v_classroom_stats SET (security_invoker = true);
ALTER VIEW public.v_classroom_characterization SET (security_invoker = true);

-- Helpers SECURITY DEFINER evitam depender da visibilidade RLS das tabelas
-- de apoio ao avaliar uma política.
CREATE OR REPLACE FUNCTION public.can_read_student_resource(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = p_student_id
      AND (
        public.get_user_role() = 'ADMIN_SME'
        OR (
          public.get_user_role() IN ('COORD_PPDT', 'GESTOR_ESCOLA')
          AND s.school_id = public.get_user_school_id()
        )
        OR (
          public.get_user_role() = 'DT'
          AND EXISTS (
            SELECT 1 FROM public.classrooms c
            WHERE c.id = s.classroom_id AND c.dt_user_id = auth.uid()
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_student_resource(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = p_student_id
      AND (
        public.get_user_role() = 'ADMIN_SME'
        OR (
          public.get_user_role() = 'DT'
          AND EXISTS (
            SELECT 1 FROM public.classrooms c
            WHERE c.id = s.classroom_id AND c.dt_user_id = auth.uid()
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_classroom_resource(p_classroom_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_role() = 'ADMIN_SME'
    OR EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = p_classroom_id
        AND public.get_user_role() = 'DT'
        AND c.dt_user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.can_read_classroom_resource(p_classroom_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms c
    WHERE c.id = p_classroom_id
      AND (
        public.get_user_role() = 'ADMIN_SME'
        OR (
          public.get_user_role() IN ('COORD_PPDT', 'GESTOR_ESCOLA')
          AND c.school_id = public.get_user_school_id()
        )
        OR (public.get_user_role() = 'DT' AND c.dt_user_id = auth.uid())
        OR (
          public.get_user_role() = 'ALUNO'
          AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = public.get_user_student_id()
              AND s.classroom_id = c.id
          )
        )
      )
  );
$$;

-- Alunos: DT só cria/altera registros da turma que dirige. Gestor mantém a
-- importação, limitada às turmas da própria escola.
DROP POLICY IF EXISTS "students_insert_admin_dt" ON public.students;
DROP POLICY IF EXISTS "students_update_admin_dt" ON public.students;
CREATE POLICY "students_insert_admin_or_dt_classroom"
  ON public.students FOR INSERT
  WITH CHECK (
    public.get_user_role() = 'ADMIN_SME'
    OR (
      public.get_user_role() = 'DT'
      AND public.can_manage_classroom_resource(classroom_id)
      AND EXISTS (
        SELECT 1 FROM public.classrooms c
        WHERE c.id = students.classroom_id AND c.school_id = students.school_id
      )
    )
    OR (
      public.get_user_role() = 'GESTOR_ESCOLA'
      AND EXISTS (
        SELECT 1 FROM public.classrooms c
        WHERE c.id = students.classroom_id
          AND c.school_id = students.school_id
          AND c.school_id = public.get_user_school_id()
      )
    )
  );
CREATE POLICY "students_update_admin_or_dt_classroom"
  ON public.students FOR UPDATE
  USING (public.can_manage_student_resource(id))
  WITH CHECK (
    public.get_user_role() = 'ADMIN_SME'
    OR (
      public.get_user_role() = 'DT'
      AND public.can_manage_classroom_resource(classroom_id)
      AND EXISTS (
        SELECT 1 FROM public.classrooms c
        WHERE c.id = students.classroom_id AND c.school_id = students.school_id
      )
    )
  );

-- Fichas: leitura/edição sempre é limitada ao aluno, turma ou escola vinculada.
DROP POLICY IF EXISTS "bio_forms_select_admin_gestor_dt" ON public.bio_forms;
DROP POLICY IF EXISTS "bio_forms_select_coord_school" ON public.bio_forms;
DROP POLICY IF EXISTS "bio_forms_select_aluno" ON public.bio_forms;
DROP POLICY IF EXISTS "bio_forms_insert_dt_aluno" ON public.bio_forms;
DROP POLICY IF EXISTS "bio_forms_update_dt_aluno" ON public.bio_forms;
CREATE POLICY "bio_forms_select_scoped"
  ON public.bio_forms FOR SELECT
  USING (
    public.can_read_student_resource(student_id)
    OR (
      public.get_user_role() = 'ALUNO'
      AND student_id = public.get_user_student_id()
      AND EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.access_locks al ON al.classroom_id = s.classroom_id
        WHERE s.id = bio_forms.student_id AND al.bio_form_locked = false
      )
    )
  );
CREATE POLICY "bio_forms_insert_scoped"
  ON public.bio_forms FOR INSERT
  WITH CHECK (
    public.can_manage_student_resource(student_id)
    OR (
      public.get_user_role() = 'ALUNO'
      AND student_id = public.get_user_student_id()
      AND EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.access_locks al ON al.classroom_id = s.classroom_id
        WHERE s.id = bio_forms.student_id AND al.bio_form_locked = false
      )
    )
  );
CREATE POLICY "bio_forms_update_scoped"
  ON public.bio_forms FOR UPDATE
  USING (
    public.can_manage_student_resource(student_id)
    OR (public.get_user_role() = 'ALUNO' AND student_id = public.get_user_student_id())
  )
  WITH CHECK (
    public.can_manage_student_resource(student_id)
    OR (
      public.get_user_role() = 'ALUNO'
      AND student_id = public.get_user_student_id()
      AND EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.access_locks al ON al.classroom_id = s.classroom_id
        WHERE s.id = bio_forms.student_id AND al.bio_form_locked = false
      )
    )
  );

-- Atendimentos e cadeados passam a respeitar a turma.
DROP POLICY IF EXISTS "attendance_logs_select_admin_gestor_dt" ON public.attendance_logs;
DROP POLICY IF EXISTS "attendance_logs_select_coord_school" ON public.attendance_logs;
DROP POLICY IF EXISTS "attendance_logs_insert_dt" ON public.attendance_logs;
CREATE POLICY "attendance_logs_select_scoped"
  ON public.attendance_logs FOR SELECT
  USING (public.can_read_classroom_resource(classroom_id));
CREATE POLICY "attendance_logs_insert_scoped"
  ON public.attendance_logs FOR INSERT
  WITH CHECK (
    public.can_manage_classroom_resource(classroom_id)
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = attendance_logs.student_id AND s.classroom_id = attendance_logs.classroom_id
    )
  );
DROP POLICY IF EXISTS "access_locks_select_all_auth" ON public.access_locks;
DROP POLICY IF EXISTS "access_locks_insert_dt" ON public.access_locks;
DROP POLICY IF EXISTS "access_locks_update_dt" ON public.access_locks;
CREATE POLICY "access_locks_select_scoped"
  ON public.access_locks FOR SELECT
  USING (public.can_read_classroom_resource(classroom_id));
CREATE POLICY "access_locks_insert_scoped"
  ON public.access_locks FOR INSERT
  WITH CHECK (public.can_manage_classroom_resource(classroom_id));
CREATE POLICY "access_locks_update_scoped"
  ON public.access_locks FOR UPDATE
  USING (public.can_manage_classroom_resource(classroom_id))
  WITH CHECK (public.can_manage_classroom_resource(classroom_id));

-- Fotos e mapeamento: acesso pela turma/aluno correspondente.
DROP POLICY IF EXISTS "student_photos_select_auth" ON public.student_photos;
DROP POLICY IF EXISTS "student_photos_insert_dt" ON public.student_photos;
DROP POLICY IF EXISTS "student_photos_update_dt" ON public.student_photos;
DROP POLICY IF EXISTS "student_photos_delete_dt" ON public.student_photos;
CREATE POLICY "student_photos_select_scoped"
  ON public.student_photos FOR SELECT
  USING (public.can_read_student_resource(student_id));
CREATE POLICY "student_photos_insert_scoped"
  ON public.student_photos FOR INSERT
  WITH CHECK (public.can_manage_student_resource(student_id));
CREATE POLICY "student_photos_update_scoped"
  ON public.student_photos FOR UPDATE
  USING (public.can_manage_student_resource(student_id))
  WITH CHECK (public.can_manage_student_resource(student_id));
CREATE POLICY "student_photos_delete_scoped"
  ON public.student_photos FOR DELETE
  USING (public.can_manage_student_resource(student_id));
DROP POLICY IF EXISTS "seat_maps_select_auth" ON public.seat_maps;
DROP POLICY IF EXISTS "seat_maps_upsert_dt" ON public.seat_maps;
DROP POLICY IF EXISTS "seat_maps_update_dt" ON public.seat_maps;
CREATE POLICY "seat_maps_select_scoped"
  ON public.seat_maps FOR SELECT
  USING (public.can_read_classroom_resource(classroom_id));
CREATE POLICY "seat_maps_insert_scoped"
  ON public.seat_maps FOR INSERT
  WITH CHECK (public.can_manage_classroom_resource(classroom_id));
CREATE POLICY "seat_maps_update_scoped"
  ON public.seat_maps FOR UPDATE
  USING (public.can_manage_classroom_resource(classroom_id))
  WITH CHECK (public.can_manage_classroom_resource(classroom_id));

-- Arquivos privados: a leitura do storage acompanha o registro do upload.
DROP POLICY IF EXISTS "student_photos_storage_select" ON storage.objects;
CREATE POLICY "student_photos_storage_select_scoped"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND EXISTS (
      SELECT 1 FROM public.student_photos sp
      WHERE sp.storage_path = name
        AND public.can_read_student_resource(sp.student_id)
    )
  );
DROP POLICY IF EXISTS "student_photos_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "student_photos_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "student_photos_storage_delete" ON storage.objects;
CREATE POLICY "student_photos_storage_insert_scoped"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-photos'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE name LIKE s.classroom_id::text || '/' || s.id::text || '.%'
        AND public.can_manage_student_resource(s.id)
    )
  );
CREATE POLICY "student_photos_storage_update_scoped"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE name LIKE s.classroom_id::text || '/' || s.id::text || '.%'
        AND public.can_manage_student_resource(s.id)
    )
  )
  WITH CHECK (
    bucket_id = 'student-photos'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE name LIKE s.classroom_id::text || '/' || s.id::text || '.%'
        AND public.can_manage_student_resource(s.id)
    )
  );
CREATE POLICY "student_photos_storage_delete_scoped"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE name LIKE s.classroom_id::text || '/' || s.id::text || '.%'
        AND public.can_manage_student_resource(s.id)
    )
  );
DROP POLICY IF EXISTS "instr_storage_select" ON storage.objects;
CREATE POLICY "instr_storage_select_scoped"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'instrumentais'
    AND EXISTS (
      SELECT 1 FROM public.instrumental_uploads iu
      WHERE iu.storage_path = name
        AND (
          public.get_user_role() = 'ADMIN_SME'
          OR (public.get_user_role() IN ('COORD_PPDT', 'GESTOR_ESCOLA') AND iu.school_id = public.get_user_school_id())
          OR (public.get_user_role() = 'DT' AND iu.uploaded_by = auth.uid())
        )
    )
  );

-- Evita que um DT assuma ou edite arbitrariamente turma de terceiros.
DROP POLICY IF EXISTS "classrooms_update_dt_claim" ON public.classrooms;
CREATE POLICY "classrooms_update_dt_claim"
  ON public.classrooms FOR UPDATE
  USING (
    public.get_user_role() = 'DT'
    AND dt_user_id IS NULL
  )
  WITH CHECK (
    public.get_user_role() = 'DT'
    AND dt_user_id = auth.uid()
  );
