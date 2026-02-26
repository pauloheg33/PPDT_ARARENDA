'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, Check, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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

export default function FichaBiograficaPage() {
  const params = useParams();
  const turmaId = params.turmaId as string;
  const alunoId = params.alunoId as string;
  const { user, profile } = useAuth();
  const router = useRouter();

  const [student, setStudent] = useState<any>(null);
  const [sections, setSections] = useState<Record<string, Record<string, string>>>(
    JSON.parse(JSON.stringify(defaultSections))
  );
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [studentRes, bioRes] = await Promise.all([
        supabase.from('students').select('*').eq('id', alunoId).single(),
        supabase.from('bio_forms').select('*').eq('student_id', alunoId).single(),
      ]);

      setStudent(studentRes.data);
      if (bioRes.data?.sections_json && Object.keys(bioRes.data.sections_json).length > 0) {
        // Merge with defaults to ensure all fields exist
        const loaded = bioRes.data.sections_json as Record<string, Record<string, string>>;
        const merged = JSON.parse(JSON.stringify(defaultSections));
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

  async function handleSave(markComplete = false) {
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

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Carregando ficha...</div>;
  }

  if (!student) {
    return <p className="text-destructive">Aluno não encontrado.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/alunos`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Ficha Biográfica</h1>
          <p className="text-muted-foreground">
            {student.name} — {student.enrollment_code ?? 'Sem matrícula'}
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

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Rascunho'}
        </Button>
        {!completed && (
          <Button onClick={() => handleSave(true)} disabled={saving}>
            <Check className="mr-2 h-4 w-4" />
            Marcar como Completa
          </Button>
        )}
      </div>
    </div>
  );
}
