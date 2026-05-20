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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Save, Check, ArrowLeft, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';


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

interface ExistingBioPdfUpload {
  id: string;
  storage_path: string;
  original_filename: string | null;
  created_at: string;
}

interface StudentDetails {
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

function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function svgUrlToBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 5000);
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      clearTimeout(timer);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || 256;
      canvas.height = image.naturalHeight || 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    image.src = url;
  });
}

async function buildBioFormPdf(params: {
  student: StudentDetails;
  sections: Record<string, Record<string, string>>;
  completed: boolean;
  dtName: string;
}) {
  const { student, sections, completed, dtName } = params;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const schoolName = student.classrooms?.schools?.name ?? 'Escola não vinculada';
  const classroomLabel = student.classrooms
    ? `${student.classrooms.year_grade} ${student.classrooms.label}`
    : 'Turma não vinculada';
  const generatedAt = new Date();
  const generatedAtLabel = generatedAt.toLocaleString('pt-BR');
  const statusLabel = completed ? 'Completa' : 'Pendente';
  const logoBase64 = await svgUrlToBase64('/PPDT_ARARENDA/logo-blue.svg');
  let y = 18;

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };

  const drawHeader = () => {
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', margin, 8, 14, 14);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('PPDT Ararendá', margin + 17, 13);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Sistema Municipal DT', margin + 17, 17);
    } else {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('PPDT Ararendá', margin, 13);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('PROJETO DIRETOR DE TURMA', pageWidth / 2, 13, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(margin, 24, pageWidth - margin, 24);
    doc.line(margin, 25.5, pageWidth - margin, 25.5);
    y = 34;
  };

  const addParagraph = (text: string, options?: { bold?: boolean; fontSize?: number; gapAfter?: number }) => {
    const lines = doc.splitTextToSize(text, contentWidth);
    ensureSpace(lines.length * 5 + 2);
    doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
    doc.setFontSize(options?.fontSize ?? 10);
    doc.text(lines, margin, y);
    y += lines.length * 5 + (options?.gapAfter ?? 4);
  };

  const addKeyValue = (label: string, value: string) => {
    const safeValue = value.trim() || '—';
    addParagraph(`${label}: ${safeValue}`, { gapAfter: 3 });
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(12);
    doc.setFillColor(176, 207, 95);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.rect(margin, y - 3, contentWidth, 9, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(title.toUpperCase(), margin + 2, y + 2.5);
    y += 10;
  };

  const addInlineFieldsRow = (items: Array<{ label: string; value: string; width?: number }>) => {
    const totalCustomWidth = items.reduce((sum, item) => sum + (item.width ?? 0), 0);
    const autoCount = items.filter((item) => !item.width).length;
    const remainingWidth = contentWidth - totalCustomWidth;
    const autoWidth = autoCount > 0 ? remainingWidth / autoCount : 0;
    const rowHeight = 8;

    ensureSpace(rowHeight + 2);

    let x = margin;
    doc.setFontSize(9);

    items.forEach((item) => {
      const width = item.width ?? autoWidth;
      const safeValue = (item.value || '').trim();
      const labelText = `${item.label}:`;
      doc.setFont('helvetica', 'bold');
      const labelWidth = doc.getTextWidth(labelText);
      const valueX = x + labelWidth + 3;
      const lineStart = x + labelWidth + 2;
      const lineEnd = x + width;

      doc.text(labelText, x, y);
      doc.setFont('helvetica', 'normal');

      if (safeValue) {
        const truncated = doc.splitTextToSize(safeValue, Math.max(width - labelWidth - 7, 12))[0] ?? safeValue;
        doc.text(truncated, valueX, y);
      }

      doc.line(lineStart, y + 1.2, lineEnd, y + 1.2);
      x += width;
    });

    y += rowHeight;
  };

  const addTwoColumnTable = (left: Array<{ label: string; value: string }>, right?: Array<{ label: string; value: string }>) => {
    const rowHeight = 9;
    const totalRows = Math.max(left.length, right?.length ?? 0);
    const columnWidth = contentWidth / 2;

    ensureSpace(totalRows * rowHeight + 8);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);

    for (let row = 0; row < totalRows; row += 1) {
      const rowTop = y + row * rowHeight;
      const leftItem = left[row];
      const rightItem = right?.[row];

      doc.rect(margin, rowTop, columnWidth, rowHeight);
      doc.rect(margin + columnWidth, rowTop, columnWidth, rowHeight);

      if (leftItem) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(leftItem.label.toUpperCase(), margin + 2, rowTop + 3);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const leftValue = doc.splitTextToSize((leftItem.value || '').trim() || '—', columnWidth - 4)[0] ?? '—';
        doc.text(leftValue, margin + 2, rowTop + 6.7);
      }

      if (rightItem) {
        const rightX = margin + columnWidth;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(rightItem.label.toUpperCase(), rightX + 2, rowTop + 3);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const rightValue = doc.splitTextToSize((rightItem.value || '').trim() || '—', columnWidth - 4)[0] ?? '—';
        doc.text(rightValue, rightX + 2, rowTop + 6.7);
      }
    }

    y += totalRows * rowHeight + 3;
  };

  drawHeader();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Ficha Biográfica do Estudante', pageWidth / 2, y, { align: 'center' });
  y += 8;

  if (!completed) {
    doc.setTextColor(146, 64, 14);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Documento gerado com ficha pendente de conclusão.', pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 7;
  }

  addSectionTitle('Identificação do Documento');
  addInlineFieldsRow([
    { label: 'Escola', value: schoolName, width: 104 },
    { label: 'Turma', value: classroomLabel, width: 74 },
  ]);
  addInlineFieldsRow([
    { label: 'Aluno', value: student.name, width: 104 },
    { label: 'Matrícula', value: student.enrollment_code ?? '—', width: 74 },
  ]);
  addInlineFieldsRow([
    { label: 'Professor Diretor de Turma', value: dtName || '—', width: 104 },
    { label: 'Gerado em', value: generatedAtLabel, width: 74 },
  ]);

  ensureSpace(11);
  doc.setFillColor(completed ? 230 : 255, completed ? 244 : 248, completed ? 234 : 220);
  doc.setDrawColor(completed ? 34 : 180, completed ? 120 : 83, completed ? 70 : 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.rect(margin, y - 1.5, contentWidth, 8.5, 'FD');
  doc.setTextColor(completed ? 22 : 120, completed ? 101 : 53, completed ? 52 : 15);
  doc.text(`Status da ficha: ${statusLabel}`, margin + 3, y + 4);
  doc.setTextColor(0, 0, 0);
  y += 10;

  for (const section of SECTIONS) {
    addSectionTitle(section.label);
    const entries = Object.entries(sections[section.id] ?? {}).map(([field, rawValue]) => ({
      label: fieldLabels[field] ?? field,
      value: rawValue,
    }));
    const midpoint = Math.ceil(entries.length / 2);
    addTwoColumnTable(entries.slice(0, midpoint), entries.slice(midpoint));
  }

  const pdfBlob = doc.output('blob');
  const filename = `FICHA_BIOGRAFICA_${slugifyFilePart(schoolName)}_${slugifyFilePart(student.name)}_${fileDateStamp(generatedAt)}.pdf`;

  return { blob: pdfBlob, filename, generatedAt };
}

function FichaBiograficaPageContent() {
  const searchParams = useSearchParams();
  const turmaId = searchParams.get('turmaId') || '';
  const alunoId = searchParams.get('alunoId') || '';
  const { user, profile } = useAuth();
  const router = useRouter();

  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [sections, setSections] = useState<Record<string, Record<string, string>>>(
    cloneDefaultSections()
  );
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [existingBioPdf, setExistingBioPdf] = useState<ExistingBioPdfUpload | null>(null);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);

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

  async function findLatestExistingBioPdf() {
    if (!user?.id || !alunoId) return null;

    const { data } = await supabase
      .from('instrumental_uploads')
      .select('id, storage_path, original_filename, created_at')
      .eq('uploaded_by', user.id)
      .eq('student_id', alunoId)
      .eq('type', 'ficha_biografica')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return (data as ExistingBioPdfUpload | null) ?? null;
  }

  async function persistGeneratedPdf(existingAction: 'create' | 'replace') {
    if (!user || !student || !profile?.classroom_id || !profile?.school_id) return;

    setGeneratingPdf(true);

    try {
      const saveResult = await saveBioForm(false);
      if (saveResult.error) {
        alert(`Não foi possível salvar a ficha antes de gerar o PDF: ${saveResult.error.message}`);
        return;
      }

      const generatedPdf = await buildBioFormPdf({
        student,
        sections,
        completed: saveResult.isComplete,
        dtName: profile.full_name ?? '',
      });

      const storagePath = `${user.id}/ficha_biografica/${crypto.randomUUID()}.pdf`;
      const pdfFile = new File([generatedPdf.blob], generatedPdf.filename, {
        type: 'application/pdf',
        lastModified: generatedPdf.generatedAt.getTime(),
      });

      const { error: uploadError } = await supabase.storage
        .from('instrumentais')
        .upload(storagePath, pdfFile, { contentType: 'application/pdf', upsert: false });

      if (uploadError) {
        alert(`Não foi possível salvar o PDF no storage: ${uploadError.message}`);
        return;
      }

      const existingUpload = existingAction === 'replace'
        ? existingBioPdf ?? (await findLatestExistingBioPdf())
        : null;

      let instrumentalId = '';

      if (existingAction === 'replace' && existingUpload) {
        const { error: replaceError } = await supabase
          .from('instrumental_uploads')
          .update({
            storage_path: storagePath,
            original_filename: generatedPdf.filename,
            reference_date: generatedPdf.generatedAt.toISOString().split('T')[0],
            observations: `Gerado automaticamente da ficha biográfica (${saveResult.isComplete ? 'completa' : 'pendente'})`,
          })
          .eq('id', existingUpload.id);

        if (replaceError) {
          await supabase.storage.from('instrumentais').remove([storagePath]);
          alert(`Não foi possível atualizar o instrumental existente: ${replaceError.message}`);
          return;
        }

        await supabase.storage.from('instrumentais').remove([existingUpload.storage_path]);
        instrumentalId = existingUpload.id;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('instrumental_uploads')
          .insert({
            uploaded_by: user.id,
            school_id: profile.school_id,
            classroom_id: profile.classroom_id,
            student_id: student.id,
            type: 'ficha_biografica',
            storage_path: storagePath,
            original_filename: generatedPdf.filename,
            reference_date: generatedPdf.generatedAt.toISOString().split('T')[0],
            observations: `Gerado automaticamente da ficha biográfica (${saveResult.isComplete ? 'completa' : 'pendente'})`,
          })
          .select('id')
          .single();

        if (insertError || !inserted?.id) {
          await supabase.storage.from('instrumentais').remove([storagePath]);
          alert(`Não foi possível registrar o instrumental gerado: ${insertError?.message ?? 'Erro desconhecido.'}`);
          return;
        }

        instrumentalId = inserted.id;
      }

      await logAudit(existingAction === 'replace' ? 'UPDATE' : 'CREATE', 'instrumental_uploads', instrumentalId, {
        action: 'generated_from_bio_form',
        student_id: student.id,
        student_name: student.name,
        bio_form_completed: saveResult.isComplete,
        generation_mode: existingAction,
      });

      triggerBrowserDownload(generatedPdf.blob, generatedPdf.filename);
      setExistingBioPdf({
        id: instrumentalId,
        storage_path: storagePath,
        original_filename: generatedPdf.filename,
        created_at: generatedPdf.generatedAt.toISOString(),
      });
      setVersionDialogOpen(false);
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleGeneratePdfClick() {
    const existingUpload = await findLatestExistingBioPdf();
    if (existingUpload) {
      setExistingBioPdf(existingUpload);
      setVersionDialogOpen(true);
      return;
    }

    await persistGeneratedPdf('create');
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
          <Button onClick={() => handleSave(true)} disabled={saving}>
            <Check className="mr-2 h-4 w-4" />
            Marcar como Completa
          </Button>
        )}
      </div>

      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ficha biográfica já gerada</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Já existe um PDF de ficha biográfica salvo para este aluno em seus instrumentais.
            </p>
            {existingBioPdf?.original_filename && (
              <p>
                Arquivo atual: <span className="font-medium text-foreground">{existingBioPdf.original_filename}</span>
              </p>
            )}
            <p>
              Escolha se deseja substituir o documento anterior ou criar um novo registro no histórico.
            </p>
            {!completed && (
              <Badge variant="warning" className="w-fit">
                A ficha será gerada como pendente
              </Badge>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setVersionDialogOpen(false)} disabled={generatingPdf}>
              Cancelar
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => persistGeneratedPdf('create')}
                disabled={generatingPdf}
              >
                Criar novo registro
              </Button>
              <Button onClick={() => persistGeneratedPdf('replace')} disabled={generatingPdf}>
                Substituir anterior
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
