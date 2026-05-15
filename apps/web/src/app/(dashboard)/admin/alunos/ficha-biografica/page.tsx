'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, FileText } from 'lucide-react';

const SECTIONS = [
  { id: 'familia', label: 'Composição Familiar' },
  { id: 'vida_escolar', label: 'Vida Escolar' },
  { id: 'tempo_livre', label: 'Tempo Livre' },
  { id: 'saude', label: 'Saúde / Alimentação' },
  { id: 'complementar', label: 'Atividades Complementares' },
];

const defaultSections: Record<string, Record<string, string>> = {
  familia: {
    com_quem_mora: '',
    numero_irmaos: '',
    profissao_pai: '',
    profissao_mae: '',
    renda_familiar: '',
    tipo_moradia: '',
    observacoes_familia: '',
  },
  vida_escolar: {
    disciplina_preferida: '',
    disciplina_dificuldade: '',
    apoio_pedagogico: '',
    deslocamento: '',
    profissao_desejada: '',
    repetencia: '',
    motivo_repetencia: '',
    opiniao_escola: '',
  },
  tempo_livre: {
    atividades_livres: '',
    usa_internet: '',
    horas_tela: '',
    pratica_esporte: '',
    qual_esporte: '',
    participa_grupo: '',
    qual_grupo: '',
  },
  saude: {
    problemas_saude: '',
    medicamento_continuo: '',
    qual_medicamento: '',
    alimentacao_escola: '',
    alergia_alimentar: '',
    qual_alergia: '',
    plano_saude: '',
  },
  complementar: {
    participa_programa_social: '',
    qual_programa: '',
    trabalha: '',
    onde_trabalha: '',
    carga_horaria_trabalho: '',
    expectativa_futuro: '',
    observacoes_gerais: '',
  },
};

const fieldLabels: Record<string, string> = {
  com_quem_mora: 'Com quem mora?',
  numero_irmaos: 'Número de irmãos',
  profissao_pai: 'Profissão do pai',
  profissao_mae: 'Profissão da mãe',
  renda_familiar: 'Renda familiar',
  tipo_moradia: 'Tipo de moradia',
  observacoes_familia: 'Observações',
  disciplina_preferida: 'Disciplina preferida',
  disciplina_dificuldade: 'Disciplina com dificuldade',
  apoio_pedagogico: 'Recebe apoio pedagógico?',
  deslocamento: 'Como se desloca até a escola?',
  profissao_desejada: 'Profissão desejada',
  repetencia: 'Já repetiu de ano?',
  motivo_repetencia: 'Motivo da repetência',
  opiniao_escola: 'O que acha da escola?',
  atividades_livres: 'Atividades nos tempos livres',
  usa_internet: 'Usa internet?',
  horas_tela: 'Horas de tela por dia',
  pratica_esporte: 'Pratica esporte?',
  qual_esporte: 'Qual esporte?',
  participa_grupo: 'Participa de algum grupo?',
  qual_grupo: 'Qual grupo?',
  problemas_saude: 'Problemas de saúde',
  medicamento_continuo: 'Usa medicamento contínuo?',
  qual_medicamento: 'Qual medicamento?',
  alimentacao_escola: 'Se alimenta na escola?',
  alergia_alimentar: 'Possui alergia alimentar?',
  qual_alergia: 'Qual alergia?',
  plano_saude: 'Possui plano de saúde?',
  participa_programa_social: 'Participa de programa social?',
  qual_programa: 'Qual programa?',
  trabalha: 'Trabalha?',
  onde_trabalha: 'Onde trabalha?',
  carga_horaria_trabalho: 'Carga horária de trabalho',
  expectativa_futuro: 'Expectativa para o futuro',
  observacoes_gerais: 'Observações gerais',
};

function AdminAlunoFichaBiograficaContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const alunoId = searchParams.get('alunoId') || '';

  const [student, setStudent] = useState<any>(null);
  const [sections, setSections] = useState<Record<string, Record<string, string>>>(
    JSON.parse(JSON.stringify(defaultSections))
  );
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!alunoId) {
      setLoading(false);
      return;
    }

    async function load() {
      const [studentRes, bioRes] = await Promise.all([
        supabase
          .from('students')
          .select('*, classrooms(year_grade, label, schools(name))')
          .eq('id', alunoId)
          .single(),
        supabase.from('bio_forms').select('*').eq('student_id', alunoId).maybeSingle(),
      ]);

      setStudent(studentRes.data);

      const merged = JSON.parse(JSON.stringify(defaultSections));
      const loaded = bioRes.data?.sections_json as Record<string, Record<string, string>> | undefined;
      if (loaded) {
        for (const [sectionKey, sectionFields] of Object.entries(loaded)) {
          if (merged[sectionKey]) {
            for (const [field, value] of Object.entries(sectionFields)) {
              merged[sectionKey][field] = value;
            }
          }
        }
      }

      setSections(merged);
      setCompleted(bioRes.data?.completed ?? false);
      setLoading(false);

      await logAudit('VIEW', 'bio_forms', alunoId, { viewer_area: 'admin_alunos' });
    }

    load();
  }, [alunoId]);

  function getSectionCompleteness(sectionId: string): number {
    const fields = sections[sectionId] ?? {};
    const total = Object.keys(fields).length;
    if (total === 0) return 0;
    const filled = Object.values(fields).filter((value) => value.trim() !== '').length;
    return Math.round((filled / total) * 100);
  }

  if (!alunoId) {
    return <div className="text-destructive">Parâmetro `alunoId` é obrigatório.</div>;
  }

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Carregando ficha...</div>;
  }

  if (!student) {
    return <p className="text-destructive">Aluno não encontrado.</p>;
  }

  const classroomLabel = student.classrooms
    ? `${student.classrooms.year_grade} ${student.classrooms.label}`
    : 'Turma não vinculada';

  const schoolName = student.classrooms?.schools?.name ?? 'Escola não vinculada';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Ficha Biográfica</h1>
          <p className="text-muted-foreground">
            {student.name} — {student.enrollment_code ?? 'Sem matrícula'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {classroomLabel} · {schoolName}
          </p>
        </div>
        <Badge variant={completed ? 'success' : 'warning'}>
          {completed ? 'Completa' : 'Em branco / pendente'}
        </Badge>
      </div>

      <Card className="border-primary/15">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Aluno</p>
              <p className="font-medium">{student.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Matrícula</p>
              <p className="font-medium">{student.enrollment_code ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Turma</p>
              <p className="font-medium">{classroomLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Escola</p>
              <p className="font-medium">{schoolName}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="familia">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {SECTIONS.map((section) => (
            <TabsTrigger key={section.id} value={section.id} className="relative">
              {section.label}
              <span
                className={`ml-2 text-[10px] ${
                  getSectionCompleteness(section.id) === 100
                    ? 'text-green-600'
                    : 'text-muted-foreground'
                }`}
              >
                {getSectionCompleteness(section.id)}%
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {SECTIONS.map((section) => (
          <TabsContent key={section.id} value={section.id}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {section.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(sections[section.id] ?? {}).map(([field, value]) => {
                  const label = fieldLabels[field] ?? field;
                  const isTextArea = field.includes('observa') || field.includes('opiniao') || field.includes('expectativa');

                  return (
                    <div key={field} className="space-y-1">
                      <Label>{label}</Label>
                      {isTextArea ? (
                        <Textarea value={value} readOnly rows={3} className="bg-muted/30" />
                      ) : (
                        <Input value={value} readOnly className="bg-muted/30" />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex justify-end">
        <Link href="/admin/alunos">
          <Button variant="outline">Voltar para Alunos</Button>
        </Link>
      </div>
    </div>
  );
}

export default function AdminAlunoFichaBiograficaPage() {
  return (
    <Suspense fallback={<div className="animate-pulse text-muted-foreground">Carregando...</div>}>
      <AdminAlunoFichaBiograficaContent />
    </Suspense>
  );
}
