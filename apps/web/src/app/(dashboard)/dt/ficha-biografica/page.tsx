'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
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
  type BioFormInstrumentalStudent,
} from '@/lib/bio-form-instrumental';
import {
  BIO_FORM_FIELD_LABELS,
  BIO_FORM_SECTIONS,
  cloneBioFormSections,
  getBioFormStatus,
  mergeBioFormSections,
  type BioFormSections,
} from '@/lib/bio-form-status';

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

function FichaBiograficaPageContent() {
  const searchParams = useSearchParams();
  const turmaId = searchParams.get('turmaId') || '';
  const alunoId = searchParams.get('alunoId') || '';
  const { user, profile } = useAuth();
  const router = useRouter();

  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [sections, setSections] = useState<BioFormSections>(
    cloneBioFormSections()
  );
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null);
  const [lastSavedCompleted, setLastSavedCompleted] = useState<boolean | null>(null);

  const bioStatus = useMemo(() => getBioFormStatus(sections), [sections]);
  const sectionsSnapshot = useMemo(() => JSON.stringify(sections), [sections]);

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
      const mergedSections = mergeBioFormSections(
        (bioRes.data?.sections_json as Record<string, Record<string, string>> | undefined) ?? null
      );
      setSections(mergedSections);
      setLastSavedSnapshot(JSON.stringify(mergedSections));
      setLastSavedCompleted(Boolean(bioRes.data?.completed));
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

  async function saveBioForm() {
    setSaving(true);
    const isComplete = getBioFormStatus(sections).isComplete;

    if (
      lastSavedSnapshot === sectionsSnapshot &&
      lastSavedCompleted === isComplete
    ) {
      setSaving(false);
      return { error: null, isComplete, skipped: true };
    }

    const { error } = await supabase
      .from('bio_forms')
      .upsert({
        student_id: alunoId,
        sections_json: sections,
        completed: isComplete,
        updated_at: new Date().toISOString(),
      });

    if (!error) {
      setLastSaved(new Date());
      setLastSavedSnapshot(sectionsSnapshot);
      setLastSavedCompleted(isComplete);
      await logAudit('UPDATE', 'bio_forms', alunoId, {
        completed: isComplete,
        updated_by: user?.id,
      });
    }
    setSaving(false);

    return { error, isComplete, skipped: false };
  }

  async function handleSave() {
    await saveBioForm();
  }

  async function persistGeneratedPdf() {
    if (!user || !student || !profile?.classroom_id || !profile?.school_id) return;

    setGeneratingPdf(true);

    try {
      const saveResult = await saveBioForm();
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
        handleSave();
      }
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionsSnapshot, loading, student]);

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
          <Badge variant={bioStatus.isComplete ? 'success' : 'warning'}>
            {bioStatus.isComplete ? 'Completa' : 'Pendente'}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="familia">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {BIO_FORM_SECTIONS.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="relative">
              {s.label}
              <span
                className={`ml-2 text-[10px] ${
                  bioStatus.sectionCompletion[s.id] === 100
                    ? 'text-green-600'
                    : 'text-muted-foreground'
                }`}
              >
                {bioStatus.sectionCompletion[s.id]}%
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {BIO_FORM_SECTIONS.map((section) => (
          <TabsContent key={section.id} value={section.id}>
            <Card>
              <CardHeader>
                <CardTitle>{section.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(sections[section.id] ?? {}).map(([field, value]) => {
                  const label = BIO_FORM_FIELD_LABELS[field] ?? field;
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
        <Button variant="outline" onClick={() => handleSave()} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Ficha'}
        </Button>
        <Button onClick={handleCompleteAndSync} disabled={saving || generatingPdf}>
          <Check className="mr-2 h-4 w-4" />
          {generatingPdf ? 'Sincronizando...' : 'Salvar e Sincronizar PDF'}
        </Button>
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
