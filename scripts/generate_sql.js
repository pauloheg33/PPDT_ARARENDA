const fs = require('fs');
const path = require('path');

const data = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../../turmas_ararendá_2026.json'),
    'utf8'
  )
);

function schoolUUID(inep) {
  // UUID v4 format: 8-4-4-4-12
  const hex = Buffer.from(inep).toString('hex').padEnd(24, '0');
  return hex.slice(0,8) + '-' + hex.slice(8,12) + '-4000-a000-' + hex.slice(12,24);
}

let classroomCounter = 0;
function classroomUUID() {
  classroomCounter++;
  const n = String(classroomCounter).padStart(12, '0');
  return 'bb000000-0000-4000-b000-' + n;
}

function esc(str) {
  return str.replace(/'/g, "''");
}

const lines = [];

lines.push('-- ==========================================================');
lines.push('-- PPDT Ararendá — Seed: Escolas, Turmas e Alunos 2026');
lines.push('-- Gerado automaticamente a partir de turmas_ararendá_2026.json');
lines.push('-- ==========================================================');
lines.push('');
lines.push('-- Limpar dados existentes (ordem respeitando FK)');
lines.push('DELETE FROM public.bio_forms;');
lines.push('DELETE FROM public.student_photos;');
lines.push('DELETE FROM public.attendance_logs;');
lines.push('DELETE FROM public.seat_maps;');
lines.push('DELETE FROM public.access_locks;');
lines.push('DELETE FROM public.students;');
lines.push('DELETE FROM public.classrooms;');
lines.push('DELETE FROM public.schools;');
lines.push('');

// Schools
lines.push('-- ==================== ESCOLAS ====================');
lines.push('INSERT INTO public.schools (id, inep, name) VALUES');
const schoolLines = data.escolas.map(
  (e) =>
    "  ('" + schoolUUID(e.inep) + "', '" + e.inep + "', '" + esc(e.nome) + "')"
);
lines.push(schoolLines.join(',\n') + ';');
lines.push('');

// Classrooms, Students, Access Locks
const classroomLines = [];
const studentLines = [];
const accessLockLines = [];

for (const escola of data.escolas) {
  const sid = schoolUUID(escola.inep);
  for (const oferta of escola.ofertas) {
    for (const turma of oferta.turmas) {
      const cid = classroomUUID();

      let yearGrade = oferta.oferta;
      let label = turma.turma;

      if (oferta.oferta === 'Multi-série') {
        yearGrade = turma.turma;
        label = 'Única';
      }
      if (label === 'Não enturmado') {
        label = 'NE';
      }

      classroomLines.push(
        "  ('" + cid + "', '" + sid + "', '" + esc(yearGrade) + "', '" + esc(label) + "', 'Manhã')"
      );
      accessLockLines.push("  ('" + cid + "', true)");

      for (const aluno of turma.alunos) {
        let bdate = 'NULL';
        if (aluno.data_nascimento) {
          const parts = aluno.data_nascimento.split('/');
          bdate = "'" + parts[2] + '-' + parts[1] + '-' + parts[0] + "'";
        }
        const nome = esc(aluno.nome);
        const matSige = aluno.mat_sige ? "'" + aluno.mat_sige + "'" : 'NULL';

        studentLines.push(
          "  ('" + sid + "', '" + cid + "', " + matSige + ", '" + nome + "', " + bdate + ')'
        );
      }
    }
  }
}

lines.push('-- ==================== TURMAS ====================');
lines.push('INSERT INTO public.classrooms (id, school_id, year_grade, label, shift) VALUES');
lines.push(classroomLines.join(',\n') + ';');
lines.push('');

lines.push('-- ==================== ACCESS LOCKS ====================');
lines.push('INSERT INTO public.access_locks (classroom_id, bio_form_locked) VALUES');
lines.push(accessLockLines.join(',\n') + ';');
lines.push('');

lines.push('-- ==================== ALUNOS ====================');
lines.push(
  'INSERT INTO public.students (school_id, classroom_id, enrollment_code, name, birthdate) VALUES'
);
lines.push(studentLines.join(',\n') + ';');

// Write output
const outPath = path.join(
  __dirname,
  '../supabase/seeds/002_seed_turmas_2026.sql'
);
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

console.log('Escolas:', data.escolas.length);
console.log('Turmas:', classroomCounter);
console.log('Alunos:', studentLines.length);
console.log('Arquivo gerado:', outPath);
