-- ==========================================================
-- PPDT Ararendá — Auto-create profile on user signup
-- Migration: 004_auto_profile_trigger.sql
-- ==========================================================

-- Trigger function: cria automaticamente o registro em profiles
-- quando um novo usuário é criado no auth.users.
-- Os dados (role, school_id, classroom_id, full_name) vêm do
-- campo raw_user_meta_data passado no signUp().

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role      TEXT;
  v_full_name TEXT;
  v_school    UUID;
  v_classroom UUID;
BEGIN
  v_role      := COALESCE(NEW.raw_user_meta_data->>'role', 'DT');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_school    := NULLIF(NEW.raw_user_meta_data->>'school_id', '')::UUID;
  v_classroom := NULLIF(NEW.raw_user_meta_data->>'classroom_id', '')::UUID;

  -- Validar role
  IF v_role NOT IN ('ADMIN_SME','COORD_PPDT','GESTOR_ESCOLA','DT','ALUNO') THEN
    v_role := 'DT';
  END IF;

  INSERT INTO public.profiles (user_id, role, full_name, school_id, classroom_id)
  VALUES (NEW.id, v_role, v_full_name, v_school, v_classroom)
  ON CONFLICT (user_id) DO UPDATE SET
    role         = EXCLUDED.role,
    full_name    = EXCLUDED.full_name,
    school_id    = EXCLUDED.school_id,
    classroom_id = EXCLUDED.classroom_id;

  -- Se DT, vincular à turma
  IF v_role = 'DT' AND v_classroom IS NOT NULL THEN
    UPDATE public.classrooms
    SET dt_user_id = NEW.id
    WHERE id = v_classroom;
  END IF;

  RETURN NEW;
END;
$$;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
