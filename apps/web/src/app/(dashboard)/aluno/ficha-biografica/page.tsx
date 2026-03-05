'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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

export default function AlunoFichaBiograficaPage() {
  const { user, profile } = useAuth();
  const studentId = profile?.student_id;

  const [student, setStudent] = useState<any>(null);
  const [sections, setSections] = useState<Record<string, Record<string, string>>>(
    JSON.parse(JSON.stringify(defaultSections))
  );
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    async function load() {
      const [studentRes, bioRes] = await Promise.all([
        supabase.from('students').select('*').eq('id', studentId).single(),
        supabase.from('bio_forms').select('*').eq('student_id', studentId).maybeSingle(),
      ]);

      setStudent(studentRes.data);

      if (bioRes.data?.sections_json && Object.keys(bioRes.data.sections_json).length > 0) {
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

      // Verificar se está desbloqueado
      if (studentRes.data?.classroom_id) {
        const { data: lockData } = await supabase
          .from('access_locks')
          .select('bio_form_locked')
          .eq('classroom_id', studentRes.data.classroom_id)
          .maybeSingle();
        setIsUnlocked(lockData ? !lockData.bio_form_locked : false);
      }

      setLoading(false);
    }
    load();
  }, [studentId]);

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
    if (!studentId) return;
    setSaving(true);
    const isComplete = markComplete || completed;

    const { error } = await supabase
      .from('bio_forms')
      .upsert({
        student_id: studentId,
        sections_json: sections,
        completed: isComplete,
        updated_at: new Date().toISOString(),
      });

    if (!error) {
      setCompleted(isComplete);
      setLastSaved(new Date());
      await logAudit('UPDATE', 'bio_forms', studentId, {
        completed: isComplete,
        updated_by: user?.id,
      });
    }
    setSaving(false);
  }

  // Autosave a cada 30s
  useEffect(() => {
    if (!isUnlocked || loading || !student) return;
    const interval = setInterval(() => {
      handleSave(false);
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, loading, isUnlocked]);

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

  if (!studentId || !student) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-destructive">Vínculo não encontrado</h1>
        <p className="text-muted-foreground">
          Seu perfil não está vinculado a um registro de estudante.
          Entre em contato com o Diretor de Turma.
        </p>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Ficha Biográfica</h1>
        <p className="text-muted-foreground">
          A ficha biográfica está bloqueada. Aguarde o Diretor de Turma liberar o preenchimento.
        </p>
        <Link href="/aluno">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/aluno">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Minha Ficha Biográfica</h1>
          <p className="text-muted-foreground">{student.name}</p>
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
            <TabsTrigger key={s.id} value={s.id} className="text-xs">
              {s.label} ({getSectionCompleteness(s.id)}%)
            </TabsTrigger>
          ))}
        </TabsList>

        {SECTIONS.map((s) => (
          <TabsContent key={s.id} value={s.id}>
            <Card>
              <CardHeader>
                <CardTitle>{s.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.keys(sections[s.id] ?? {}).map((field) => (
                  <div key={field} className="space-y-1">
                    <Label>{fieldLabels[field] ?? field}</Label>
                    {field.includes('observacoes') || field.includes('opiniao') || field.includes('expectativa') ? (
                      <Textarea
                        value={sections[s.id][field]}
                        onChange={(e) => updateField(s.id, field, e.target.value)}
                        rows={3}
                      />
                    ) : (
                      <Input
                        value={sections[s.id][field]}
                        onChange={(e) => updateField(s.id, field, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Rascunho'}
        </Button>
        {!completed && (
          <Button onClick={() => handleSave(true)} disabled={saving}>
            <Check className="mr-2 h-4 w-4" />
            Finalizar Ficha
          </Button>
        )}
      </div>
    </div>
  );
}
