-- ==========================================================
-- PPDT Ararendá — Schema Principal
-- Migration: 001_create_tables.sql
-- ==========================================================

-- Extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== SCHOOLS ====================
CREATE TABLE public.schools (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inep       TEXT UNIQUE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== CLASSROOMS ====================
CREATE TABLE public.classrooms (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  year_grade  TEXT NOT NULL,        -- ex: '6º Ano', '9º Ano'
  label       TEXT NOT NULL,        -- ex: 'A', 'B'
  shift       TEXT NOT NULL DEFAULT 'Manhã', -- 'Manhã', 'Tarde', 'Integral'
  dt_user_id  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== PROFILES (RBAC) ====================
CREATE TABLE public.profiles (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('ADMIN_SME','COORD_PPDT','GESTOR_ESCOLA','DT','ALUNO')),
  school_id    UUID REFERENCES public.schools(id),
  classroom_id UUID REFERENCES public.classrooms(id),
  full_name    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== STUDENTS ====================
CREATE TABLE public.students (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  classroom_id     UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  enrollment_code  TEXT,
  name             TEXT NOT NULL,
  birthdate        DATE,
  responsible_name TEXT,
  responsible_phone TEXT,
  status           TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo','Inativo','Transferido')),
  is_leader        BOOLEAN NOT NULL DEFAULT false,
  is_vice_leader   BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para importação: duplicidade por matrícula+nascimento
CREATE UNIQUE INDEX idx_students_enrollment_birth
  ON public.students(enrollment_code, birthdate)
  WHERE enrollment_code IS NOT NULL;

-- ==================== ACCESS LOCKS (Cadeado Ficha Biográfica) ====================
CREATE TABLE public.access_locks (
  classroom_id    UUID PRIMARY KEY REFERENCES public.classrooms(id) ON DELETE CASCADE,
  bio_form_locked BOOLEAN NOT NULL DEFAULT true,
  locked_at       TIMESTAMPTZ DEFAULT now(),
  locked_by       UUID REFERENCES auth.users(id)
);

-- ==================== STUDENT PHOTOS ====================
CREATE TABLE public.student_photos (
  student_id   UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID NOT NULL REFERENCES auth.users(id)
);

-- ==================== SEAT MAPS (Mapeamento de Sala) ====================
CREATE TABLE public.seat_maps (
  classroom_id UUID PRIMARY KEY REFERENCES public.classrooms(id) ON DELETE CASCADE,
  layout_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID NOT NULL REFERENCES auth.users(id)
);

-- ==================== BIO FORMS (Ficha Biográfica) ====================
CREATE TABLE public.bio_forms (
  student_id    UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  sections_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed     BOOLEAN NOT NULL DEFAULT false,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== ATTENDANCE / CONTACT LOG ====================
CREATE TABLE public.attendance_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  classroom_id  UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('Atendimento','Contato Família','Observação')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID NOT NULL REFERENCES auth.users(id)
);

-- ==================== AUDIT LOG ====================
CREATE TABLE public.audit_log (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action         TEXT NOT NULL,
  entity         TEXT NOT NULL,
  entity_id      TEXT NOT NULL,
  actor_user_id  UUID NOT NULL REFERENCES auth.users(id),
  metadata       JSONB DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================== VIEWS para Relatórios ====================

-- View: Caracterização da Turma
CREATE OR REPLACE VIEW public.v_classroom_characterization AS
SELECT
  s.classroom_id,
  s.id AS student_id,
  s.name AS student_name,
  s.birthdate,
  s.responsible_name,
  s.status,
  bf.sections_json,
  bf.completed AS bio_completed,
  sp.storage_path AS photo_path
FROM public.students s
LEFT JOIN public.bio_forms bf ON bf.student_id = s.id
LEFT JOIN public.student_photos sp ON sp.student_id = s.id
WHERE s.status = 'Ativo';

-- View: Dados Estatísticos por Turma
CREATE OR REPLACE VIEW public.v_classroom_stats AS
SELECT
  c.id AS classroom_id,
  c.school_id,
  c.year_grade,
  c.label,
  c.shift,
  COUNT(s.id) AS total_students,
  COUNT(bf.student_id) FILTER (WHERE bf.completed = true) AS bio_completed,
  COUNT(bf.student_id) FILTER (WHERE bf.completed = false OR bf.student_id IS NULL) AS bio_pending,
  COUNT(sp.student_id) AS photos_uploaded,
  COUNT(s.id) - COUNT(sp.student_id) AS photos_missing
FROM public.classrooms c
LEFT JOIN public.students s ON s.classroom_id = c.id AND s.status = 'Ativo'
LEFT JOIN public.bio_forms bf ON bf.student_id = s.id
LEFT JOIN public.student_photos sp ON sp.student_id = s.id
GROUP BY c.id, c.school_id, c.year_grade, c.label, c.shift;

-- Índices para performance
CREATE INDEX idx_students_classroom ON public.students(classroom_id);
CREATE INDEX idx_students_school ON public.students(school_id);
CREATE INDEX idx_bio_forms_student ON public.bio_forms(student_id);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity, entity_id);
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_user_id);
