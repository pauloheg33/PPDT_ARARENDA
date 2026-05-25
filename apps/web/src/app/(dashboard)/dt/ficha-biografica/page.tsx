'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Save, Check, ArrowLeft, FileDown } from 'lucide-react';
import {
  syncBioFormInstrumental,
  triggerBrowserDownload,
  type BioFormSections,
  type BioFormInstrumentalStudent,
} from '@/lib/bio-form-instrumental';


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

interface StudentDetails extends BioFormInstrumentalStudent {
  id: string;
  name: string;
  enrollment_code: string | null;
  classroom_id: string;
  school_id: string;
  classrooms?: {
    year_grade: string;
    label: string;
    schools?: {
      name: string;
    } | null;
  } | null;
}

function cloneDefaultSections() {
  return JSON.parse(JSON.stringify(defaultSections)) as Record<string, Record<string, string>>;
}

function slugifyFilePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function fileDateStamp(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
}

function FichaBiograficaPageContent() {
  const searchParams = useSearchParams();
  const turmaId = searchParams.get('turmaId') || '';
  const alunoId = searchParams.get('alunoId') || '';
  const { user, profile } = useAuth();
  const router = useRouter();

  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [sections, setSections] = useState<BioFormSections>(
    cloneDefaultSections()
  );
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (!alunoId) return;
    async function load() {
      const [studentRes, bioRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, name, enrollment_code, classroom_id, school_id, classrooms(year_grade, label, schools(name))')
          .eq('id', alunoId)
          .single(),
        supabase.from('bio_forms').select('*').eq('student_id', alunoId).single(),
      ]);

      setStudent((studentRes.data as unknown as StudentDetails) ?? null);
      if (bioRes.data?.sections_json && Object.keys(bioRes.data.sections_json).length > 0) {
        // Merge with defaults to ensure all fields exist
        const loaded = bioRes.data.sections_json as Record<string, Record<string, string>>;
        const merged = cloneDefaultSections();
        for (const [sectionKey, sectionFields] of Object.entries(loaded)) {
          if (merged[sectionKey]) {
            for (const [field, value] of Object.entries(sectionFields)) {
              merged[sectionKey][field] = value;
            }
          }
        }
        setSections(merged);
      }
      setCompleted(bioRes.data?.completed ?? false);
      setLoading(false);
    }
    load();
  }, [alunoId]);

  function updateField(section: string, field: string, value: string) {
    setSections((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  }

  async function saveBioForm(markComplete = false) {
    setSaving(true);
    const isComplete = markComplete || completed;

    const { error } = await supabase
      .from('bio_forms')
      .upsert({
        student_id: alunoId,
        sections_json: sections,
        completed: isComplete,
        updated_at: new Date().toISOString(),
      });

    if (!error) {
      setCompleted(isComplete);
      setLastSaved(new Date());
      await logAudit('UPDATE', 'bio_forms', alunoId, {
        completed: isComplete,
        updated_by: user?.id,
      });
    }
    setSaving(false);

    return { error, isComplete };
  }

  async function handleSave(markComplete = false) {
    await saveBioForm(markComplete);
  }

  async function persistGeneratedPdf() {
    if (!user || !student || !profile?.classroom_id || !profile?.school_id) return;

    setGeneratingPdf(true);

    try {
      const saveResult = await saveBioForm(true);
      if (saveResult.error) {
        alert(`Não foi possível salvar a ficha antes de gerar o PDF: ${saveResult.error.message}`);
        return;
      }

      const syncResult = await syncBioFormInstrumental({
        actorUserId: user.id,
        actorUserName: profile.full_name ?? 'Professor Diretor de Turma',
        uploadedByUserId: user.id,
        dtName: profile.full_name ?? '',
        student,
        sections,
        completed: saveResult.isComplete,
      });
      triggerBrowserDownload(syncResult.blob, syncResult.filename);
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleGeneratePdfClick() {
    await persistGeneratedPdf();
  }

  async function handleCompleteAndSync() {
    await persistGeneratedPdf();
  }

  // Autosave a cada 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && student) {
        handleSave(false);
      }
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, loading]);

  function getSectionCompleteness(sectionId: string): number {
    const fields = sections[sectionId] ?? {};
    const total = Object.keys(fields).length;
    if (total === 0) return 0;
    const filled = Object.values(fields).filter((v) => v.trim() !== '').length;
    return Math.round((filled / total) * 100);
  }

  if (!turmaId || !alunoId) {
    return <div className="text-red-500">Parâmetros turmaId e alunoId são obrigatórios na URL.</div>;
  }

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Carregando ficha...</div>;
  }

  if (!student) {
    return <p className="text-destructive">Aluno não encontrado.</p>;
  }

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
            {student.classrooms
              ? `${student.classrooms.year_grade} ${student.classrooms.label} · ${student.classrooms.schools?.name ?? 'Escola não vinculada'}`
              : 'Turma não vinculada'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-muted-foreground">
              Salvo às {lastSaved.toLocaleTimeString('pt-BR')}
            </span>
          )}
          <Badge variant={completed ? 'success' : 'warning'}>
            {completed ? 'Completa' : 'Pendente'}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="familia">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {SECTIONS.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="relative">
              {s.label}
              <span
                className={`ml-2 text-[10px] ${
                  getSectionCompleteness(s.id) === 100
                    ? 'text-green-600'
                    : 'text-muted-foreground'
                }`}
              >
                {getSectionCompleteness(s.id)}%
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {SECTIONS.map((section) => (
          <TabsContent key={section.id} value={section.id}>
            <Card>
              <CardHeader>
                <CardTitle>{section.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(sections[section.id] ?? {}).map(([field, value]) => {
                  const label = fieldLabels[field] ?? field;
                  const isTextArea = field.includes('observa') || field.includes('opiniao') || field.includes('expectativa');

                  return (
                    <div key={field} className="space-y-1">
                      <Label>{label}</Label>
                      {isTextArea ? (
                        <Textarea
                          value={value}
                          onChange={(e) => updateField(section.id, field, e.target.value)}
                          rows={3}
                        />
                      ) : (
                        <Input
                          value={value}
                          onChange={(e) => updateField(section.id, field, e.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex flex-wrap justify-end gap-4">
        <Button variant="secondary" onClick={handleGeneratePdfClick} disabled={saving || generatingPdf}>
          <FileDown className="mr-2 h-4 w-4" />
          {generatingPdf ? 'Gerando PDF...' : 'Gerar PDF da Ficha'}
        </Button>
        <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Rascunho'}
        </Button>
        {!completed && (
          <Button onClick={handleCompleteAndSync} disabled={saving || generatingPdf}>
            <Check className="mr-2 h-4 w-4" />
            {generatingPdf ? 'Concluindo...' : 'Marcar como Completa'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function FichaBiograficaPage() {
  return (
    <Suspense fallback={<div className="animate-pulse text-muted-foreground">Carregando...</div>}>
      <FichaBiograficaPageContent />
    </Suspense>
  );
}
