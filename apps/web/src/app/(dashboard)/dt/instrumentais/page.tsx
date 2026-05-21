'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import {
  INSTRUMENTAL_FILE_ACCEPT,
  isSupportedInstrumentalFile,
  normalizeInstrumentalUpload,
} from '@/lib/instrumentais';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Eye,
  Download,
  RefreshCw,
  Trash2,
  Upload,
  FileText,
  Library,
  ExternalLink,
  FileDown,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InstrumentalViewerDialog } from '@/components/instrumentais/instrumental-viewer-dialog';

type TipoInstrumental =
  | 'ficha_biografica'
  | 'registro_dialogos'
  | 'situacoes_diversas'
  | 'visita_domiciliar'
  | 'ata_reuniao';

type Categoria = 'instrumentais_ppdt' | 'documentos_apoio';

const TIPO_LABELS: Record<TipoInstrumental, string> = {
  ficha_biografica: 'Ficha Biográfica',
  registro_dialogos: 'Registro de Diálogos',
  situacoes_diversas: 'Situações Diversas',
  visita_domiciliar: 'Visita Domiciliar',
  ata_reuniao: 'Ata de Reunião',
};

const CATEGORY_LABELS: Record<Categoria, string> = {
  instrumentais_ppdt: 'Instrumentais do PPDT',
  documentos_apoio: 'Documentos de Apoio',
};

interface Upload {
  id: string;
  type: TipoInstrumental;
  storage_path: string;
  original_filename: string | null;
  reference_date: string;
  observations: string | null;
  created_at: string;
  student_id: string | null;
  student?: { name: string } | null;
}

interface Student {
  id: string;
  name: string;
}

interface Modelo {
  id: string;
  category: Categoria;
  name: string;
  description: string | null;
  external_url: string;
  file_type: string | null;
}

export default function InstrumentaisPage() {
  const { profile, user } = useAuth();

  // ---- Meus Registros ----
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [filterTipo, setFilterTipo] = useState('');
  const [filterAluno, setFilterAluno] = useState('');

  // ---- Enviar ----
  const [students, setStudents] = useState<Student[]>([]);
  const [uploadForm, setUploadForm] = useState({
    student_id: '',
    type: '' as TipoInstrumental | '',
    reference_date: new Date().toISOString().split('T')[0],
    observations: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Substituir ----
  const [replaceTarget, setReplaceTarget] = useState<Upload | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [viewerUpload, setViewerUpload] = useState<Upload | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  // ---- Biblioteca ----
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loadingModelos, setLoadingModelos] = useState(true);

  // ---- Dados da turma (para geração de PDF) ----
  const [classroomInfo, setClassroomInfo] = useState<{
    year_grade: string;
    label: string;
    school_name: string;
  } | null>(null);
  const [generating, setGenerating] = useState(false);

  const classroomId = profile?.classroom_id;
  const schoolId = profile?.school_id;

  useEffect(() => {
    if (!classroomId) return;
    Promise.all([fetchUploads(), fetchStudents(), fetchModelos(), fetchClassroom()]);
  }, [classroomId]);

  async function fetchUploads() {
    setLoadingUploads(true);
    const { data } = await supabase
      .from('instrumental_uploads')
      .select('*, student:students(name)')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false });
    setUploads((data as Upload[]) ?? []);
    setLoadingUploads(false);
  }

  async function fetchStudents() {
    if (!classroomId) return;
    const { data } = await supabase
      .from('students')
      .select('id, name')
      .eq('classroom_id', classroomId)
      .eq('status', 'Ativo')
      .order('name');
    setStudents(data ?? []);
  }

  async function fetchClassroom() {
    if (!classroomId) return;
    const { data } = await supabase
      .from('classrooms')
      .select('year_grade, label, schools(name)')
      .eq('id', classroomId)
      .single();
    if (data) {
      setClassroomInfo({
        year_grade: data.year_grade,
        label: data.label,
        school_name: (data as any).schools?.name ?? '',
      });
    }
  }

  async function fetchModelos() {
    setLoadingModelos(true);
    const { data } = await supabase
      .from('biblioteca_modelos')
      .select('*')
      .eq('active', true)
      .order('category')
      .order('name');
    setModelos((data as Modelo[]) ?? []);
    setLoadingModelos(false);
  }

  async function handleOpenPdf(upload: Upload) {
    const { data, error } = await supabase.storage
      .from('instrumentais')
      .createSignedUrl(upload.storage_path, 120);
    if (error || !data?.signedUrl) {
      alert(`Não foi possível abrir o arquivo${error ? `: ${error.message}` : '.'}`);
      return;
    }

    setViewerUpload(upload);
    setViewerUrl(data.signedUrl);
  }

  async function handleDownloadPdf(upload: Upload) {
    const { data } = await supabase.storage
      .from('instrumentais')
      .createSignedUrl(upload.storage_path, 120);
    if (!data?.signedUrl) return;
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = upload.original_filename ?? `instrumental-${upload.id}.pdf`;
    a.click();
  }

  async function handleDeleteUpload(upload: Upload) {
    if (!confirm(`Excluir o registro "${upload.original_filename ?? TIPO_LABELS[upload.type]}"? Esta ação não pode ser desfeita.`)) return;
    await supabase.storage.from('instrumentais').remove([upload.storage_path]);
    await supabase.from('instrumental_uploads').delete().eq('id', upload.id);
    await logAudit('DELETE', 'instrumental_uploads', upload.id, { type: upload.type });
    fetchUploads();
  }

  async function handleSubmitUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError('');
    setUploadSuccess('');

    if (!uploadForm.type || !selectedFile || !classroomId || !schoolId || !user) {
      setUploadError('Preencha todos os campos obrigatórios e selecione um PDF ou uma foto do documento.');
      return;
    }

    if (!isSupportedInstrumentalFile(selectedFile)) {
      setUploadError('Envie um arquivo em PDF, JPG, PNG ou WEBP.');
      return;
    }

    setUploading(true);
    let preparedUpload: Awaited<ReturnType<typeof normalizeInstrumentalUpload>>;

    try {
      preparedUpload = await normalizeInstrumentalUpload(selectedFile);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Não foi possível preparar o arquivo para envio.');
      setUploading(false);
      return;
    }

    const path = `${user.id}/${uploadForm.type}/${crypto.randomUUID()}.pdf`;

    const { error: storageError } = await supabase.storage
      .from('instrumentais')
      .upload(path, preparedUpload.file, { contentType: 'application/pdf', upsert: false });

    if (storageError) {
      setUploadError(`Erro no upload: ${storageError.message}`);
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from('instrumental_uploads').insert({
      uploaded_by: user.id,
      school_id: schoolId,
      classroom_id: classroomId,
      student_id: uploadForm.student_id || null,
      type: uploadForm.type,
      storage_path: path,
      original_filename: preparedUpload.storedFilename,
      reference_date: uploadForm.reference_date,
      observations: uploadForm.observations || null,
    });

    if (dbError) {
      await supabase.storage.from('instrumentais').remove([path]);
      setUploadError(`Erro ao registrar: ${dbError.message}`);
      setUploading(false);
      return;
    }

    await logAudit('CREATE', 'instrumental_uploads', path, {
      type: uploadForm.type,
      classroom_id: classroomId,
      source_format: preparedUpload.sourceFormat,
      original_source_filename: preparedUpload.originalFilename,
    });

    setUploadForm({
      student_id: '',
      type: '',
      reference_date: new Date().toISOString().split('T')[0],
      observations: '',
    });
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploadSuccess('Instrumental enviado com sucesso. O arquivo já está disponível em "Meus Registros".');
    setUploading(false);
    fetchUploads();
  }

  async function handleReplace() {
    if (!replaceTarget || !replaceFile || !user) return;
    if (!isSupportedInstrumentalFile(replaceFile)) {
      alert('Envie um arquivo em PDF, JPG, PNG ou WEBP.');
      return;
    }

    setReplacing(true);

    let preparedUpload: Awaited<ReturnType<typeof normalizeInstrumentalUpload>>;

    try {
      preparedUpload = await normalizeInstrumentalUpload(replaceFile);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível preparar o arquivo para substituição.');
      setReplacing(false);
      return;
    }

    const newPath = `${user.id}/${replaceTarget.type}/${crypto.randomUUID()}.pdf`;

    const { error: storageError } = await supabase.storage
      .from('instrumentais')
      .upload(newPath, preparedUpload.file, { contentType: 'application/pdf', upsert: false });

    if (storageError) {
      alert(`Erro no upload: ${storageError.message}`);
      setReplacing(false);
      return;
    }

    await supabase.storage.from('instrumentais').remove([replaceTarget.storage_path]);

    await supabase
      .from('instrumental_uploads')
      .update({
        storage_path: newPath,
        original_filename: preparedUpload.storedFilename,
      })
      .eq('id', replaceTarget.id);

    await logAudit('UPDATE', 'instrumental_uploads', replaceTarget.id, {
      action: 'file_replaced',
      source_format: preparedUpload.sourceFormat,
      original_source_filename: preparedUpload.originalFilename,
    });

    setReplaceTarget(null);
    setReplaceFile(null);
    setReplacing(false);
    fetchUploads();
  }

  function svgUrlToBase64(url: string): Promise<string | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 5000);
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        clearTimeout(timer);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 256;
        canvas.height = img.naturalHeight || 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = url;
    });
  }

  async function gerarAtaAssembleia() {
    if (!classroomInfo) return;
    setGenerating(true);

    try {
      const logoBase64 = await svgUrlToBase64('/PPDT_ARARENDA/logo-blue.svg');

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageW = 210;
      const margin = 20;
      const contentW = pageW - margin * 2;

      const escola = classroomInfo.school_name;
      const turma = `${classroomInfo.year_grade} ${classroomInfo.label}`;
      const dtName = profile?.full_name ?? '';

      // === PÁGINA 1 ===

      // Cabeçalho: logo à esquerda + título central
      const headerH = 18;
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin, 4, 13, 13);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('PPDT Ararendá', margin + 15, 9);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text('Sistema Municipal DT', margin + 15, 13);
      } else {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('PPDT Ararendá', margin, 11);
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('PROFESSOR DIRETOR DE TURMA - PDT', pageW / 2, 11, { align: 'center' });

      // Linhas separadoras duplas
      doc.setLineWidth(0.5);
      doc.line(margin, headerH, pageW - margin, headerH);
      doc.line(margin, headerH + 1.5, pageW - margin, headerH + 1.5);

      // Título
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(
        'ATA DA ___ ASSEMBLEIA DOS REPRESENTANTES DE PAIS E RESPONSÁVEIS DA TURMA',
        pageW / 2, headerH + 10, { align: 'center' }
      );

      // Linha sob o título
      doc.setLineWidth(0.3);
      doc.line(margin, headerH + 13, pageW - margin, headerH + 13);

      // Parágrafo de abertura — sem align:justify para evitar overflow
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      let y = headerH + 22;

      const paragrafo =
        `Ao(s) _________ dia(s) do mês de ________________________ de _________________, ` +
        `às ____________ horas, realizou-se uma reunião com os pais/responsáveis da turma ` +
        `do(a) ${turma} da Escola ${escola} com a seguinte pauta de trabalho.`;

      // -4 de buffer para garantir que linhas com underscores não vazem
      const paraLines = doc.splitTextToSize(paragrafo, contentW - 4);
      doc.text(paraLines, margin, y);
      y += paraLines.length * 6 + 10;

      // Itens de pauta
      for (let i = 1; i <= 6; i++) {
        doc.text(`${i}.`, margin, y);
        doc.line(margin + 7, y + 0.5, pageW - margin, y + 0.5);
        y += 10;
      }

      y += 10;

      // Encerramento
      const encerramento =
        'Nada mais havendo a ser tratado, deu por encerrada a Assembleia de Pais/responsáveis ' +
        'dos estudantes desta turma e foi elaborada a presente ata que será assinada pelos ' +
        'organizadores da reunião e pelos pais/responsáveis.';
      const encLines = doc.splitTextToSize(encerramento, contentW - 4);
      doc.text(encLines, margin, y);
      y += encLines.length * 6 + 14;

      // Assinaturas
      const assinaturas = [
        `Diretor(a) de turma: ${dtName}`,
        'Secretário(a):',
        'Professor(a):',
        'Núcleo Gestor:',
        'Núcleo Gestor:',
      ];
      for (const label of assinaturas) {
        doc.text(label, margin, y);
        doc.line(margin + doc.getTextWidth(label) + 3, y + 0.5, pageW - margin, y + 0.5);
        y += 11;
      }

      // === PÁGINA 2 — Lista de alunos ===
      doc.addPage();

      autoTable(doc, {
        head: [['Nº', 'NOME DOS ESTUDANTES DA TURMA', 'PAIS/RESPONSÁVEIS (Assinatura)']],
        body: students.map((s, i) => [(i + 1).toString(), s.name, '']),
        startY: 15,
        styles: { fontSize: 9, cellPadding: 3.5 },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          lineWidth: 0.3,
          lineColor: [0, 0, 0],
        },
        bodyStyles: { lineWidth: 0.3, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
        columnStyles: {
          0: { cellWidth: 14, halign: 'center' },
          1: { cellWidth: 88 },
          2: { cellWidth: 68 },
        },
        margin: { left: margin, right: margin },
      });

      const escolaSlug = escola.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 25);
      const turmaSlug = turma.replace(/\s+/g, '');
      const ano = new Date().getFullYear();
      doc.save(`ATA_ASSEMBLEIA_${escolaSlug}_${turmaSlug}_${ano}.pdf`);

      logAudit('EXPORT', 'instrumental_uploads', classroomId!, { type: 'ata_assembleia' });
    } finally {
      setGenerating(false);
    }
  }

  const filteredUploads = uploads.filter((u) => {
    if (filterTipo && u.type !== filterTipo) return false;
    if (filterAluno && u.student_id !== filterAluno) return false;
    return true;
  });

  const modelosPorCategoria = (cat: Categoria) =>
    modelos.filter((m) => m.category === cat);

  if (!classroomId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Você ainda não está vinculado a uma turma.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Instrumentais do PPDT</h1>
        <p className="text-muted-foreground">Registros, envios e modelos de documentos</p>
      </div>

      <Tabs defaultValue="biblioteca">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="registros" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Meus Registros
          </TabsTrigger>
          <TabsTrigger value="enviar" className="flex items-center gap-2">
            <Upload className="h-4 w-4" /> Enviar Instrumental
          </TabsTrigger>
          <TabsTrigger value="biblioteca" className="flex items-center gap-2">
            <Library className="h-4 w-4" /> Biblioteca de Modelos
          </TabsTrigger>
        </TabsList>

        {/* ====== ABA: MEUS REGISTROS ====== */}
        <TabsContent value="registros" className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-3">
            <Select
              value={filterTipo || '__all'}
              onValueChange={(v) => setFilterTipo(v === '__all' ? '' : v)}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos os tipos</SelectItem>
                {Object.entries(TIPO_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterAluno || '__all'}
              onValueChange={(v) => setFilterAluno(v === '__all' ? '' : v)}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Filtrar por aluno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos os alunos</SelectItem>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(filterTipo || filterAluno) && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterTipo(''); setFilterAluno(''); }}>
                Limpar filtros
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="pt-6">
              {loadingUploads ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : filteredUploads.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum instrumental encontrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estudante</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead className="w-32">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUploads.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.student?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{TIPO_LABELS[u.type]}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(u.reference_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {u.original_filename ?? '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" title="Visualizar" onClick={() => handleOpenPdf(u)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Baixar" onClick={() => handleDownloadPdf(u)}>
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Substituir arquivo"
                              onClick={() => { setReplaceTarget(u); setReplaceFile(null); }}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Excluir registro"
                              onClick={() => handleDeleteUpload(u)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== ABA: ENVIAR INSTRUMENTAL ====== */}
        <TabsContent value="enviar" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmitUpload} className="space-y-5 max-w-lg">
                <div className="space-y-2">
                  <Label>Estudante <span className="text-muted-foreground">(opcional)</span></Label>
                  <Select
                    value={uploadForm.student_id || '__none'}
                    onValueChange={(v) => setUploadForm({ ...uploadForm, student_id: v === '__none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um aluno" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sem aluno específico</SelectItem>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Instrumental <span className="text-destructive">*</span></Label>
                  <Select
                    value={uploadForm.type}
                    onValueChange={(v) => setUploadForm({ ...uploadForm, type: v as TipoInstrumental })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data do Registro <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={uploadForm.reference_date}
                    onChange={(e) => setUploadForm({ ...uploadForm, reference_date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Arquivo do Instrumental <span className="text-destructive">*</span></Label>
                  <div
                    className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    {selectedFile ? (
                      <div className="space-y-1 text-center">
                        <p className="text-sm font-medium text-primary">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedFile.type === 'application/pdf'
                            ? 'PDF pronto para envio.'
                            : 'Imagem selecionada. Ela sera convertida em PDF antes do upload.'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1 text-center">
                        <p className="text-sm text-muted-foreground">
                          Clique para selecionar um PDF ou foto do documento (máx. 10 MB)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Imagens serao convertidas em PDF automaticamente.
                        </p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={INSTRUMENTAL_FILE_ACCEPT}
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={uploadForm.observations}
                    onChange={(e) => setUploadForm({ ...uploadForm, observations: e.target.value })}
                    placeholder="Informações adicionais sobre o documento..."
                    rows={3}
                  />
                </div>

                {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
                {uploadSuccess && (
                  <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                    {uploadSuccess}
                  </div>
                )}

                <Button type="submit" disabled={uploading} className="w-full">
                  {uploading ? 'Enviando...' : 'Enviar Instrumental'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== ABA: BIBLIOTECA DE MODELOS ====== */}
        <TabsContent value="biblioteca" className="pt-4 space-y-6">

          {/* Gerados automaticamente */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Gerado Automaticamente</h2>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">Ata de Assembleia dos Pais e Responsáveis</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {classroomInfo
                        ? `${classroomInfo.school_name} — ${classroomInfo.year_grade} ${classroomInfo.label} · ${students.length} aluno(s)`
                        : 'Carregando dados da turma...'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={gerarAtaAssembleia}
                    disabled={generating || !classroomInfo || students.length === 0}
                    className="shrink-0"
                  >
                    <FileDown className="h-4 w-4 mr-1" />
                    {generating ? 'Gerando...' : 'Gerar PDF'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {loadingModelos ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : modelos.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-sm">
                  Nenhum modelo disponível. O administrador ainda não cadastrou modelos.
                </p>
              </CardContent>
            </Card>
          ) : (
            (['instrumentais_ppdt', 'documentos_apoio'] as Categoria[]).map((cat) => {
              const items = modelosPorCategoria(cat);
              if (items.length === 0) return null;
              return (
                <div key={cat} className="space-y-3">
                  <h2 className="text-lg font-semibold">{CATEGORY_LABELS[cat]}</h2>
                  <Card>
                    <CardContent className="pt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Documento</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="w-24">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((m) => (
                            <TableRow key={m.id}>
                              <TableCell>
                                <p className="font-medium">{m.name}</p>
                                {m.description && (
                                  <p className="text-xs text-muted-foreground">{m.description}</p>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {m.file_type === 'word' ? 'Word' : m.file_type === 'pdf' ? 'PDF' : 'Arquivo'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(m.external_url, '_blank')}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  Baixar
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* ====== DIALOG: SUBSTITUIR ARQUIVO ====== */}
      <Dialog open={!!replaceTarget} onOpenChange={(open) => { if (!open) setReplaceTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Substituir Arquivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tipo: <strong>{replaceTarget ? TIPO_LABELS[replaceTarget.type] : ''}</strong>
            </p>
            <div
              className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-accent transition-colors"
              onClick={() => replaceInputRef.current?.click()}
            >
              <Upload className="h-6 w-6 text-muted-foreground mb-2" />
              {replaceFile ? (
                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium text-primary">{replaceFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {replaceFile.type === 'application/pdf'
                      ? 'PDF pronto para substituicao.'
                      : 'Imagem selecionada. Ela sera convertida em PDF antes do envio.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1 text-center">
                  <p className="text-sm text-muted-foreground">Selecione o novo PDF ou foto do documento</p>
                  <p className="text-xs text-muted-foreground">
                    Imagens serao convertidas em PDF automaticamente.
                  </p>
                </div>
              )}
            </div>
            <input
              ref={replaceInputRef}
              type="file"
              accept={INSTRUMENTAL_FILE_ACCEPT}
              className="hidden"
              onChange={(e) => setReplaceFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceTarget(null)}>Cancelar</Button>
            <Button onClick={handleReplace} disabled={!replaceFile || replacing}>
              {replacing ? 'Substituindo...' : 'Confirmar Substituição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InstrumentalViewerDialog
        open={!!viewerUpload}
        onOpenChange={(open) => {
          if (!open) {
            setViewerUpload(null);
            setViewerUrl(null);
          }
        }}
        fileUrl={viewerUrl}
        title={viewerUpload ? (viewerUpload.original_filename ?? TIPO_LABELS[viewerUpload.type]) : 'Visualizar instrumental'}
        description={
          viewerUpload
            ? `${TIPO_LABELS[viewerUpload.type]}${viewerUpload.student?.name ? ` · ${viewerUpload.student.name}` : ''}`
            : null
        }
        storagePath={viewerUpload?.storage_path}
      />
    </div>
  );
}
