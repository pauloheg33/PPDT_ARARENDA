-- ==========================================================
-- PPDT Ararendá — Seed Data (Exemplo)
-- Execute APÓS criar um usuário ADMIN_SME via Supabase Auth
-- ==========================================================

-- ATENÇÃO: Substitua 'SEU_ADMIN_USER_ID' pelo UUID real do usuário criado no Auth.
-- Para facilitar, o sistema usa o primeiro usuário cadastrado como ADMIN.

-- ==================== ESCOLAS ====================
INSERT INTO public.schools (id, inep, name) VALUES
  ('a1000000-0000-0000-0000-000000000001', '23045001', 'EEIEF Antônio Gomes de Barros'),
  ('a1000000-0000-0000-0000-000000000002', '23045002', 'EEIEF Maria José de Sousa'),
  ('a1000000-0000-0000-0000-000000000003', NULL, 'EEIEF Francisco Rodrigues Lima');

-- ==================== TURMAS ====================
INSERT INTO public.classrooms (id, school_id, year_grade, label, shift) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '6º Ano', 'A', 'Manhã'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', '7º Ano', 'A', 'Manhã'),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', '8º Ano', 'A', 'Tarde'),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', '6º Ano', 'A', 'Manhã'),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', '9º Ano', 'A', 'Tarde'),
  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000003', '7º Ano', 'B', 'Manhã');

-- ==================== ACCESS LOCKS (tudo bloqueado inicialmente) ====================
INSERT INTO public.access_locks (classroom_id, bio_form_locked) VALUES
  ('b1000000-0000-0000-0000-000000000001', true),
  ('b1000000-0000-0000-0000-000000000002', true),
  ('b1000000-0000-0000-0000-000000000003', true),
  ('b1000000-0000-0000-0000-000000000004', true),
  ('b1000000-0000-0000-0000-000000000005', true),
  ('b1000000-0000-0000-0000-000000000006', true);

-- ==================== ALUNOS DE EXEMPLO ====================
INSERT INTO public.students (school_id, classroom_id, enrollment_code, name, birthdate, responsible_name, responsible_phone) VALUES
  -- Escola 1, 6º Ano A
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'MAT001', 'Ana Clara Sousa', '2014-03-15', 'Maria de Sousa', '(88) 99999-0001'),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'MAT002', 'Pedro Henrique Lima', '2014-07-22', 'José Lima', '(88) 99999-0002'),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'MAT003', 'Maria Eduarda Oliveira', '2013-11-08', 'Francisca Oliveira', '(88) 99999-0003'),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'MAT004', 'João Vítor Santos', '2014-01-30', 'Antônia Santos', '(88) 99999-0004'),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'MAT005', 'Beatriz Ferreira', '2014-05-12', 'Raimunda Ferreira', '(88) 99999-0005'),
  -- Escola 1, 7º Ano A
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'MAT006', 'Lucas Gabriel Rocha', '2013-02-14', 'Francisco Rocha', '(88) 99999-0006'),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'MAT007', 'Sophia Almeida Costa', '2013-09-25', 'Tereza Costa', '(88) 99999-0007'),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'MAT008', 'Miguel Araújo Silva', '2013-06-03', 'José Silva', '(88) 99999-0008'),
  -- Escola 2, 6º Ano A
  ('a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 'MAT009', 'Laura Beatriz Melo', '2014-04-18', 'Joana Melo', '(88) 99999-0009'),
  ('a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 'MAT010', 'Davi Lucca Pereira', '2014-08-07', 'Marcos Pereira', '(88) 99999-0010');

-- ==================== NOTA ====================
-- Para criar o profile do ADMIN, execute após criar o usuário no Auth:
-- INSERT INTO public.profiles (user_id, role, full_name)
-- VALUES ('UUID-DO-USUARIO-AUTH', 'ADMIN_SME', 'Administrador SME');
