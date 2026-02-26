-- ==========================================================
-- PPDT Ararendá — Row Level Security Policies
-- Migration: 002_rls_policies.sql
-- ==========================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bio_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ==================== Helper function ====================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT school_id FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_classroom_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT classroom_id FROM public.profiles WHERE user_id = auth.uid();
$$;

-- ==================== SCHOOLS ====================
-- ADMIN_SME & COORD_PPDT: leitura total; ADMIN_SME: escrita
CREATE POLICY "schools_select_admin_coord"
  ON public.schools FOR SELECT
  USING (public.get_user_role() IN ('ADMIN_SME', 'COORD_PPDT'));

CREATE POLICY "schools_select_gestor"
  ON public.schools FOR SELECT
  USING (
    public.get_user_role() = 'GESTOR_ESCOLA'
    AND id = public.get_user_school_id()
  );

CREATE POLICY "schools_select_dt"
  ON public.schools FOR SELECT
  USING (
    public.get_user_role() = 'DT'
    AND id = public.get_user_school_id()
  );

CREATE POLICY "schools_insert_admin"
  ON public.schools FOR INSERT
  WITH CHECK (public.get_user_role() = 'ADMIN_SME');

CREATE POLICY "schools_update_admin"
  ON public.schools FOR UPDATE
  USING (public.get_user_role() = 'ADMIN_SME');

CREATE POLICY "schools_delete_admin"
  ON public.schools FOR DELETE
  USING (public.get_user_role() = 'ADMIN_SME');

-- ==================== CLASSROOMS ====================
CREATE POLICY "classrooms_select_admin_coord"
  ON public.classrooms FOR SELECT
  USING (public.get_user_role() IN ('ADMIN_SME', 'COORD_PPDT'));

CREATE POLICY "classrooms_select_gestor"
  ON public.classrooms FOR SELECT
  USING (
    public.get_user_role() = 'GESTOR_ESCOLA'
    AND school_id = public.get_user_school_id()
  );

CREATE POLICY "classrooms_select_dt"
  ON public.classrooms FOR SELECT
  USING (
    public.get_user_role() = 'DT'
    AND (
      id = public.get_user_classroom_id()
      OR dt_user_id = auth.uid()
    )
  );

CREATE POLICY "classrooms_insert_admin"
  ON public.classrooms FOR INSERT
  WITH CHECK (public.get_user_role() = 'ADMIN_SME');

CREATE POLICY "classrooms_update_admin"
  ON public.classrooms FOR UPDATE
  USING (public.get_user_role() = 'ADMIN_SME');

CREATE POLICY "classrooms_delete_admin"
  ON public.classrooms FOR DELETE
  USING (public.get_user_role() = 'ADMIN_SME');

-- ==================== PROFILES ====================
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (public.get_user_role() = 'ADMIN_SME');

CREATE POLICY "profiles_insert_admin"
  ON public.profiles FOR INSERT
  WITH CHECK (public.get_user_role() = 'ADMIN_SME');

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.get_user_role() = 'ADMIN_SME');

CREATE POLICY "profiles_delete_admin"
  ON public.profiles FOR DELETE
  USING (public.get_user_role() = 'ADMIN_SME');

-- ==================== STUDENTS ====================
CREATE POLICY "students_select_admin_coord"
  ON public.students FOR SELECT
  USING (public.get_user_role() IN ('ADMIN_SME', 'COORD_PPDT'));

CREATE POLICY "students_select_gestor"
  ON public.students FOR SELECT
  USING (
    public.get_user_role() = 'GESTOR_ESCOLA'
    AND school_id = public.get_user_school_id()
  );

CREATE POLICY "students_select_dt"
  ON public.students FOR SELECT
  USING (
    public.get_user_role() = 'DT'
    AND classroom_id = public.get_user_classroom_id()
  );

CREATE POLICY "students_select_aluno"
  ON public.students FOR SELECT
  USING (
    public.get_user_role() = 'ALUNO'
    AND id::text = (SELECT classroom_id::text FROM public.profiles WHERE user_id = auth.uid())
    -- Aluno vê apenas seu próprio registro (via enrollment linkage)
  );

CREATE POLICY "students_insert_admin_dt"
  ON public.students FOR INSERT
  WITH CHECK (public.get_user_role() IN ('ADMIN_SME', 'DT', 'GESTOR_ESCOLA'));

CREATE POLICY "students_update_admin_dt"
  ON public.students FOR UPDATE
  USING (public.get_user_role() IN ('ADMIN_SME', 'DT'));

CREATE POLICY "students_delete_admin"
  ON public.students FOR DELETE
  USING (public.get_user_role() = 'ADMIN_SME');

-- ==================== ACCESS LOCKS ====================
CREATE POLICY "access_locks_select_all_auth"
  ON public.access_locks FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "access_locks_insert_dt"
  ON public.access_locks FOR INSERT
  WITH CHECK (
    public.get_user_role() IN ('ADMIN_SME', 'DT')
  );

CREATE POLICY "access_locks_update_dt"
  ON public.access_locks FOR UPDATE
  USING (
    public.get_user_role() IN ('ADMIN_SME', 'DT')
  );

-- ==================== STUDENT PHOTOS ====================
CREATE POLICY "student_photos_select_auth"
  ON public.student_photos FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "student_photos_insert_dt"
  ON public.student_photos FOR INSERT
  WITH CHECK (public.get_user_role() IN ('ADMIN_SME', 'DT'));

CREATE POLICY "student_photos_update_dt"
  ON public.student_photos FOR UPDATE
  USING (public.get_user_role() IN ('ADMIN_SME', 'DT'));

CREATE POLICY "student_photos_delete_dt"
  ON public.student_photos FOR DELETE
  USING (public.get_user_role() IN ('ADMIN_SME', 'DT'));

-- ==================== SEAT MAPS ====================
CREATE POLICY "seat_maps_select_auth"
  ON public.seat_maps FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "seat_maps_upsert_dt"
  ON public.seat_maps FOR INSERT
  WITH CHECK (public.get_user_role() IN ('ADMIN_SME', 'DT'));

CREATE POLICY "seat_maps_update_dt"
  ON public.seat_maps FOR UPDATE
  USING (public.get_user_role() IN ('ADMIN_SME', 'DT'));

-- ==================== BIO FORMS ====================
-- DT e ADMIN podem ver e editar; ALUNO só quando desbloqueado
CREATE POLICY "bio_forms_select_admin_dt"
  ON public.bio_forms FOR SELECT
  USING (public.get_user_role() IN ('ADMIN_SME', 'COORD_PPDT', 'GESTOR_ESCOLA', 'DT'));

CREATE POLICY "bio_forms_select_aluno"
  ON public.bio_forms FOR SELECT
  USING (
    public.get_user_role() = 'ALUNO'
    AND EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.access_locks al ON al.classroom_id = s.classroom_id
      WHERE s.id = bio_forms.student_id
        AND al.bio_form_locked = false
    )
  );

CREATE POLICY "bio_forms_insert_dt_aluno"
  ON public.bio_forms FOR INSERT
  WITH CHECK (
    public.get_user_role() IN ('ADMIN_SME', 'DT')
    OR (
      public.get_user_role() = 'ALUNO'
      AND EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.access_locks al ON al.classroom_id = s.classroom_id
        WHERE s.id = bio_forms.student_id
          AND al.bio_form_locked = false
      )
    )
  );

CREATE POLICY "bio_forms_update_dt_aluno"
  ON public.bio_forms FOR UPDATE
  USING (
    public.get_user_role() IN ('ADMIN_SME', 'DT')
    OR (
      public.get_user_role() = 'ALUNO'
      AND EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.access_locks al ON al.classroom_id = s.classroom_id
        WHERE s.id = bio_forms.student_id
          AND al.bio_form_locked = false
      )
    )
  );

-- ==================== ATTENDANCE LOGS ====================
CREATE POLICY "attendance_logs_select_admin_dt"
  ON public.attendance_logs FOR SELECT
  USING (public.get_user_role() IN ('ADMIN_SME', 'COORD_PPDT', 'GESTOR_ESCOLA', 'DT'));

CREATE POLICY "attendance_logs_insert_dt"
  ON public.attendance_logs FOR INSERT
  WITH CHECK (public.get_user_role() IN ('ADMIN_SME', 'DT'));

-- ==================== AUDIT LOG ====================
CREATE POLICY "audit_log_insert_auth"
  ON public.audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "audit_log_select_admin"
  ON public.audit_log FOR SELECT
  USING (public.get_user_role() = 'ADMIN_SME');

-- ==================== STORAGE POLICIES ====================
-- Bucket: student-photos
-- Criar via dashboard ou SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('student-photos', 'student-photos', false);

-- Políticas de storage (adaptar conforme Supabase Storage RLS)
-- SELECT para qualquer autenticado
-- INSERT/UPDATE/DELETE para DT e ADMIN_SME
