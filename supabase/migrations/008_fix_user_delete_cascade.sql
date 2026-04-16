-- ==========================================================
-- Fix: FK constraints blocking auth.users deletion
-- Migration: 008_fix_user_delete_cascade.sql
-- ==========================================================

-- classrooms.dt_user_id → SET NULL ao deletar o usuário DT
ALTER TABLE public.classrooms
  DROP CONSTRAINT IF EXISTS classrooms_dt_user_id_fkey;
ALTER TABLE public.classrooms
  ADD CONSTRAINT classrooms_dt_user_id_fkey
    FOREIGN KEY (dt_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- access_locks.locked_by → SET NULL ao deletar o usuário
ALTER TABLE public.access_locks
  DROP CONSTRAINT IF EXISTS access_locks_locked_by_fkey;
ALTER TABLE public.access_locks
  ADD CONSTRAINT access_locks_locked_by_fkey
    FOREIGN KEY (locked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- student_photos.updated_by → permitir null + SET NULL
ALTER TABLE public.student_photos
  ALTER COLUMN updated_by DROP NOT NULL;
ALTER TABLE public.student_photos
  DROP CONSTRAINT IF EXISTS student_photos_updated_by_fkey;
ALTER TABLE public.student_photos
  ADD CONSTRAINT student_photos_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- seat_maps.updated_by → permitir null + SET NULL
ALTER TABLE public.seat_maps
  ALTER COLUMN updated_by DROP NOT NULL;
ALTER TABLE public.seat_maps
  DROP CONSTRAINT IF EXISTS seat_maps_updated_by_fkey;
ALTER TABLE public.seat_maps
  ADD CONSTRAINT seat_maps_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- attendance_logs.created_by → remover FK (manter histórico mesmo sem o usuário)
ALTER TABLE public.attendance_logs
  DROP CONSTRAINT IF EXISTS attendance_logs_created_by_fkey;

-- audit_log.actor_user_id → remover FK (log imutável, não deve ser deletado junto)
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_actor_user_id_fkey;
