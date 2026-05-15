-- ==========================================================
-- PPDT Ararendá — Escopo escolar para COORD_PPDT
-- Migration: 015_coord_escolar_scope.sql
-- ==========================================================

-- ==================== SCHOOLS ====================
DROP POLICY IF EXISTS "schools_select_admin_coord" ON public.schools;

CREATE POLICY "schools_select_admin"
  ON public.schools FOR SELECT
  USING (public.get_user_role() = 'ADMIN_SME');

CREATE POLICY "schools_select_coord_school"
  ON public.schools FOR SELECT
  USING (
    public.get_user_role() = 'COORD_PPDT'
    AND id = public.get_user_school_id()
  );

-- ==================== CLASSROOMS ====================
DROP POLICY IF EXISTS "classrooms_select_admin_coord" ON public.classrooms;

CREATE POLICY "classrooms_select_admin"
  ON public.classrooms FOR SELECT
  USING (public.get_user_role() = 'ADMIN_SME');

CREATE POLICY "classrooms_select_coord_school"
  ON public.classrooms FOR SELECT
  USING (
    public.get_user_role() = 'COORD_PPDT'
    AND school_id = public.get_user_school_id()
  );

-- ==================== PROFILES ====================
CREATE POLICY "profiles_select_coord_school"
  ON public.profiles FOR SELECT
  USING (
    public.get_user_role() = 'COORD_PPDT'
    AND (
      school_id = public.get_user_school_id()
      OR role = 'ADMIN_SME'
    )
  );

-- ==================== STUDENTS ====================
DROP POLICY IF EXISTS "students_select_admin_coord" ON public.students;

CREATE POLICY "students_select_admin"
  ON public.students FOR SELECT
  USING (public.get_user_role() = 'ADMIN_SME');

CREATE POLICY "students_select_coord_school"
  ON public.students FOR SELECT
  USING (
    public.get_user_role() = 'COORD_PPDT'
    AND school_id = public.get_user_school_id()
  );

-- ==================== BIO FORMS ====================
DROP POLICY IF EXISTS "bio_forms_select_admin_dt" ON public.bio_forms;

CREATE POLICY "bio_forms_select_admin_gestor_dt"
  ON public.bio_forms FOR SELECT
  USING (public.get_user_role() IN ('ADMIN_SME', 'GESTOR_ESCOLA', 'DT'));

CREATE POLICY "bio_forms_select_coord_school"
  ON public.bio_forms FOR SELECT
  USING (
    public.get_user_role() = 'COORD_PPDT'
    AND EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = bio_forms.student_id
        AND s.school_id = public.get_user_school_id()
    )
  );

-- ==================== ATTENDANCE LOGS ====================
DROP POLICY IF EXISTS "attendance_logs_select_admin_dt" ON public.attendance_logs;

CREATE POLICY "attendance_logs_select_admin_gestor_dt"
  ON public.attendance_logs FOR SELECT
  USING (public.get_user_role() IN ('ADMIN_SME', 'GESTOR_ESCOLA', 'DT'));

CREATE POLICY "attendance_logs_select_coord_school"
  ON public.attendance_logs FOR SELECT
  USING (
    public.get_user_role() = 'COORD_PPDT'
    AND EXISTS (
      SELECT 1
      FROM public.classrooms c
      WHERE c.id = attendance_logs.classroom_id
        AND c.school_id = public.get_user_school_id()
    )
  );

-- ==================== INSTRUMENTAL_UPLOADS ====================
DROP POLICY IF EXISTS "instr_uploads_select_admin_coord" ON public.instrumental_uploads;

CREATE POLICY "instr_uploads_select_admin"
  ON public.instrumental_uploads FOR SELECT
  USING (public.get_user_role() = 'ADMIN_SME');

CREATE POLICY "instr_uploads_select_coord_school"
  ON public.instrumental_uploads FOR SELECT
  USING (
    public.get_user_role() = 'COORD_PPDT'
    AND school_id = public.get_user_school_id()
  );

-- ==================== DOWNLOAD LOGS ====================
DROP POLICY IF EXISTS "downloads_log_select_admin_coord" ON public.instrumental_downloads_log;

CREATE POLICY "downloads_log_select_admin_coord_own"
  ON public.instrumental_downloads_log FOR SELECT
  USING (
    public.get_user_role() = 'ADMIN_SME'
    OR (
      public.get_user_role() = 'COORD_PPDT'
      AND admin_user_id = auth.uid()
    )
  );
