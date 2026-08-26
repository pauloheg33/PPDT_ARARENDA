-- ==========================================================
-- PPDT Ararendá — Cadastro público seguro de DT
-- Migration: 023_harden_self_signup.sql
--
-- Perfis privilegiados e alunos vinculados são provisionados pelo admin.
-- O cadastro público cria somente DT e aceita turma apenas se ela estiver
-- disponível; a escola é sempre derivada da turma, nunca do formulário.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role             TEXT;
  v_full_name        TEXT;
  v_requested_class  UUID;
  v_school           UUID;
  v_classroom        UUID;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'DT');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_requested_class := NULLIF(NEW.raw_user_meta_data->>'classroom_id', '')::UUID;

  -- A tela pública é destinada ao Professor Diretor de Turma. Perfis de
  -- aluno precisam do vínculo prévio com o registro do estudante.
  IF v_role <> 'DT' THEN
    v_role := 'DT';
  END IF;

  -- Só vincula uma turma existente que ainda não possui DT. Caso contrário,
  -- cria o perfil sem turma para escolha posterior pelo fluxo controlado.
  IF v_requested_class IS NOT NULL THEN
    SELECT c.id, c.school_id
      INTO v_classroom, v_school
      FROM public.classrooms c
     WHERE c.id = v_requested_class
       AND c.dt_user_id IS NULL;
  END IF;

  INSERT INTO public.profiles (user_id, role, full_name, school_id, classroom_id)
  VALUES (NEW.id, v_role, v_full_name, v_school, v_classroom)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    school_id = EXCLUDED.school_id,
    classroom_id = EXCLUDED.classroom_id;

  IF v_classroom IS NOT NULL THEN
    UPDATE public.classrooms
       SET dt_user_id = NEW.id
     WHERE id = v_classroom
       AND dt_user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;
