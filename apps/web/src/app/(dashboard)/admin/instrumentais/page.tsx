'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { InstrumentalViewerDialog } from '@/components/instrumentais/instrumental-viewer-dialog';
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
  Trash2,
  Plus,
  Pencil,
  Library,
  BarChart3,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

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

interface UploadRow {
  id: string;
  type: TipoInstrumental;
  storage_path: string;
  original_filename: string | null;
  reference_date: string;
  observations: string | null;
  created_at: string;
  uploaded_by: string | null;
  school_id: string;
  classroom_id: string;
  student_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  school?: { name: string } | null;
  classroom?: { year_grade: string; label: string } | null;
  student?: { name: string } | null;
}

interface Profile {
  user_id: string;
  full_name: string;
}

interface Modelo {
  id: string;
  category: Categoria;
  name: string;
  description: string | null;
  external_url: string;
  file_type: string | null;
  active: boolean;
}

const EMPTY_MODELO: Omit<Modelo, 'id' | 'active'> = {
  category: 'instrumentais_ppdt',
  name: '',
  description: '',
  external_url: '',
  file_type: 'word',
};

export default function AdminInstrumentaisPage() {
  const { user, profile } = useAuth();

  // ---- Monitoramento ----
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [filterSchool, setFilterSchool] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterUploader, setFilterUploader] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterReviewed, setFilterReviewed] = useState<'todos' | 'revisados' | 'pendentes'>('todos');
  const [reviewDialog, setReviewDialog] = useState<UploadRow | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [viewerUpload, setViewerUpload] = useState<UploadRow | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  // ---- Biblioteca ----
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loadingModelos, setLoadingModelos] = useState(true);
  const [modeloDialog, setModeloDialog] = useState(false);
  const [editingModelo, setEditingModelo] = useState<Modelo | null>(null);
  const [modeloForm, setModeloForm] = useState<Omit<Modelo, 'id' | 'active'>>(EMPTY_MODELO);
  const [savingModelo, setSavingModelo] = useState(false);

  useEffect(() => {
    fetchUploads();
    fetchModelos();
    fetchSchools();
  }, []);

  const isAdminSme = profile?.role === 'ADMIN_SME';
  const canManageUploads = isAdminSme;

  async function fetchUploads() {
    setLoadingUploads(true);
    const [uploadsRes, profilesRes] = await Promise.all([
      supabase
        .from('instrumental_uploads')
        .select('*, school:schools(name), classroom:classrooms(year_grade,label), student:students(name)')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('user_id, full_name'),
    ]);
    setUploads((uploadsRes.data as UploadRow[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
    setLoadingUploads(false);
  }

  async function handleMarkReviewed(upload: UploadRow) {
    if (!user?.id) return;
    const { error } = await supabase
      .from('instrumental_uploads')
      .update({
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes,
      })
      .eq('id', upload.id);
    if (error) {
      alert(`Não foi possível marcar o arquivo como revisado: ${error.message}`);
      return;
    }

    if (upload.uploaded_by) {
      const studentName = upload.student?.name?.trim() || null;
      const reviewTitle = studentName
        ? `${TIPO_LABELS[upload.type]} de ${studentName} revisado`
        : `${TIPO_LABELS[upload.type]} revisado`;
      const reviewMessage = reviewNotes?.trim()
        ? studentName
          ? `Seu instrumental "${TIPO_LABELS[upload.type]}" do aluno ${studentName} foi revisado.\n\nObservação: ${reviewNotes.trim()}`
          : `Seu instrumental "${TIPO_LABELS[upload.type]}" foi revisado.\n\nObservação: ${reviewNotes.trim()}`
        : studentName
          ? `Seu instrumental "${TIPO_LABELS[upload.type]}" do aluno ${studentName} foi revisado sem observações adicionais.`
          : `Seu instrumental "${TIPO_LABELS[upload.type]}" foi revisado sem observações adicionais.`;

      const { error: notificationError } = await supabase.from('notifications').insert({
        recipient_user_id: upload.uploaded_by,
        created_by: user.id,
        type: 'instrumental_review',
        title: reviewTitle,
        message: reviewMessage,
        link_path: '/dt/instrumentais',
        metadata: {
          upload_id: upload.id,
          type: upload.type,
          student_id: upload.student_id,
          student_name: studentName,
          review_notes: reviewNotes?.trim() || null,
          reviewer_name: profile?.full_name ?? 'Administrador SME',
          reviewed_at: new Date().toISOString(),
        },
      });

      if (notificationError) {
        console.error('[Instrumentais Admin] Erro ao criar notificação de revisão:', notificationError.message);
      } else {
        await logAudit('CREATE', 'notifications', upload.id, {
          action: 'instrumental_review_notification_created',
          upload_id: upload.id,
          recipient_user_id: upload.uploaded_by,
        });
      }
    }

    await logAudit('UPDATE', 'instrumental_uploads', upload.id, { action: 'marked_reviewed', review_notes: reviewNotes });
    setReviewDialog(null);
    setReviewNotes('');
    fetchUploads();
  }

  async function fetchSchools() {
    const { data } = await supabase.from('schools').select('id, name').order('name');
    setSchools(data ?? []);
  }

  async function fetchModelos() {
    setLoadingModelos(true);
    const { data } = await supabase
      .from('biblioteca_modelos')
      .select('*')
      .order('category')
      .order('name');
    setModelos((data as Modelo[]) ?? []);
    setLoadingModelos(false);
  }

  function getUploaderName(userId: string | null) {
    if (!userId) return '—';
    return profiles.find((p) => p.user_id === userId)?.full_name ?? '—';
  }

  function getReviewSummary(upload: UploadRow) {
    if (!upload.reviewed_by) return null;

    const reviewer = getUploaderName(upload.reviewed_by);
    const reviewedAt = upload.reviewed_at
      ? new Date(upload.reviewed_at).toLocaleString('pt-BR')
      : null;

    return {
      reviewer,
      reviewedAt,
      notes: upload.review_notes?.trim() || null,
    };
  }

  async function logInstrumentalFileAccess(upload: UploadRow, action: 'view' | 'download') {
    if (!user?.id) return;

    const metadata = {
      type: upload.type,
      file_name: upload.original_filename,
      storage_path: upload.storage_path,
      access_action: action,
    };

    const [auditResult, accessLogResult] = await Promise.all([
      logAudit(action === 'view' ? 'VIEW' : 'DOWNLOAD', 'instrumental_uploads', upload.id, metadata),
      supabase.from('instrumental_downloads_log').insert({
        admin_user_id: user.id,
        upload_id: upload.id,
        action,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }),
    ]);

    if (accessLogResult.error) {
      console.error(`[Instrumentais Admin] Erro ao registrar ${action}:`, accessLogResult.error.message);
    }

    return auditResult;
  }

  async function handleOpenPdf(upload: UploadRow) {
    const { data, error } = await supabase.storage
      .from('instrumentais')
      .createSignedUrl(upload.storage_path, 120);
    if (error || !data?.signedUrl) {
      alert(`Não foi possível abrir o arquivo${error ? `: ${error.message}` : '.'}`);
      return;
    }

    await logInstrumentalFileAccess(upload, 'view');
    setViewerUpload(upload);
    setViewerUrl(data.signedUrl);
  }

  async function handleDownloadPdf(upload: UploadRow) {
    const { data, error } = await supabase.storage
      .from('instrumentais')
      .createSignedUrl(upload.storage_path, 120);
    if (error || !data?.signedUrl) {
      alert(`Não foi possível baixar o arquivo${error ? `: ${error.message}` : '.'}`);
      return;
    }

    await logInstrumentalFileAccess(upload, 'download');
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = upload.original_filename ?? `instrumental-${upload.id}.pdf`;
    a.click();
  }

  async function handleDeleteUpload(upload: UploadRow) {
    if (!confirm(`Excluir o arquivo "${upload.original_filename ?? upload.id}"?`)) return;
    const { error: storageError } = await supabase.storage.from('instrumentais').remove([upload.storage_path]);
    if (storageError) {
      alert(`Não foi possível remover o arquivo do storage: ${storageError.message}`);
      return;
    }

    const { error: deleteError } = await supabase.from('instrumental_uploads').delete().eq('id', upload.id);
    if (deleteError) {
      alert(`Não foi possível excluir o registro: ${deleteError.message}`);
      return;
    }

    await logAudit('DELETE', 'instrumental_uploads', upload.id, { type: upload.type });
    fetchUploads();
  }

  function openNewModelo() {
    setEditingModelo(null);
    setModeloForm(EMPTY_MODELO);
    setModeloDialog(true);
  }

  function openEditModelo(m: Modelo) {
    setEditingModelo(m);
    setModeloForm({
      category: m.category,
      name: m.name,
      description: m.description ?? '',
      external_url: m.external_url,
      file_type: m.file_type ?? 'word',
    });
    setModeloDialog(true);
  }

  async function handleSaveModelo() {
    if (!modeloForm.name || !modeloForm.external_url) return;
    setSavingModelo(true);

    if (editingModelo) {
      await supabase
        .from('biblioteca_modelos')
        .update({ ...modeloForm, updated_at: new Date().toISOString() })
        .eq('id', editingModelo.id);
    } else {
      await supabase.from('biblioteca_modelos').insert({
        ...modeloForm,
        created_by: user?.id,
      });
    }

    setSavingModelo(false);
    setModeloDialog(false);
    fetchModelos();
  }

  async function handleToggleModelo(m: Modelo) {
    await supabase
      .from('biblioteca_modelos')
      .update({ active: !m.active, updated_at: new Date().toISOString() })
      .eq('id', m.id);
    fetchModelos();
  }

  async function handleDeleteModelo(m: Modelo) {
    if (!confirm(`Excluir o modelo "${m.name}"?`)) return;
    await supabase.from('biblioteca_modelos').delete().eq('id', m.id);
    fetchModelos();
  }

  const filteredUploads = uploads.filter((u) => {
    if (filterSchool && u.school_id !== filterSchool) return false;
    if (filterTipo && u.type !== filterTipo) return false;
    if (filterUploader && u.uploaded_by !== filterUploader) return false;
    if (filterDateFrom && new Date(u.created_at) < new Date(filterDateFrom + 'T00:00:00')) return false;
    if (filterDateTo && new Date(u.created_at) > new Date(filterDateTo + 'T23:59:59')) return false;
    if (filterReviewed === 'revisados' && !u.reviewed_by) return false;
    if (filterReviewed === 'pendentes' && u.reviewed_by) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Instrumentais do PPDT</h1>
        <p className="text-muted-foreground">Monitoramento de envios e gestão da biblioteca</p>
      </div>

      <Tabs defaultValue="monitoramento">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="monitoramento" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Monitoramento
          </TabsTrigger>
          <TabsTrigger value="biblioteca" className="flex items-center gap-2">
            <Library className="h-4 w-4" /> Biblioteca de Modelos
          </TabsTrigger>
        </TabsList>

        {/* ====== ABA: MONITORAMENTO ====== */}
        <TabsContent value="monitoramento" className="space-y-4 pt-4">

          {/* Indicadores rápidos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-2xl font-bold">{uploads.length}</p>
                <p className="text-xs text-muted-foreground">Total de envios</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-2xl font-bold">
                  {new Set(uploads.map((u) => u.uploaded_by)).size}
                </p>
                <p className="text-xs text-muted-foreground">DTs ativos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-2xl font-bold">
                  {new Set(uploads.map((u) => u.school_id)).size}
                </p>
                <p className="text-xs text-muted-foreground">Escolas com envios</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-2xl font-bold">
                  {new Set(uploads.filter((u) => u.student_id).map((u) => u.student_id)).size}
                </p>
                <p className="text-xs text-muted-foreground">Alunos com registro</p>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <Select
                value={filterSchool || '__all'}
                onValueChange={(v) => setFilterSchool(v === '__all' ? '' : v)}
              >
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Filtrar por escola" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todas as escolas</SelectItem>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
                value={filterUploader || '__all'}
                onValueChange={(v) => setFilterUploader(v === '__all' ? '' : v)}
              >
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Filtrar por Professor DT" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todos os DTs</SelectItem>
                  {Array.from(new Set(uploads.map((u) => u.uploaded_by))).map((userId) => userId && (
                    <SelectItem key={userId} value={userId}>
                      {getUploaderName(userId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filterReviewed}
                onValueChange={(v) => setFilterReviewed(v as 'todos' | 'revisados' | 'pendentes')}
              >
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Status de revisão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendentes">Pendentes de revisão</SelectItem>
                  <SelectItem value="revisados">Já revisados</SelectItem>
                </SelectContent>
              </Select>

              {(filterSchool || filterTipo || filterUploader || filterReviewed !== 'todos') && (
                <Button variant="ghost" size="sm" onClick={() => { 
                  setFilterSchool(''); 
                  setFilterTipo(''); 
                  setFilterUploader('');
                  setFilterReviewed('todos');
                  setFilterDateFrom('');
                  setFilterDateTo('');
                }}>
                  Limpar todos
                </Button>
              )}
            </div>
            
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Data de: </Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data até: </Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              {loadingUploads ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : filteredUploads.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum envio encontrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Professor DT</TableHead>
                      <TableHead>Escola</TableHead>
                      <TableHead>Turma</TableHead>
                      <TableHead>Aluno</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Revisado</TableHead>
                      <TableHead className="w-40">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUploads.map((u) => {
                      const reviewSummary = getReviewSummary(u);

                      return (
                        <TableRow key={u.id} className={u.reviewed_by ? 'opacity-75' : ''}>
                          <TableCell className="font-medium">
                            {getUploaderName(u.uploaded_by)}
                          </TableCell>
                          <TableCell>{u.school?.name ?? '—'}</TableCell>
                          <TableCell>
                            {u.classroom ? `${u.classroom.year_grade} ${u.classroom.label}` : '—'}
                          </TableCell>
                          <TableCell>{u.student?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{TIPO_LABELS[u.type]}</Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(u.reference_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            {u.reviewed_by ? (
                              <div className="space-y-1">
                                <Badge variant="default" className="bg-green-600">✓ Revisado</Badge>
                                <div className="text-xs text-muted-foreground">
                                  <p>{reviewSummary?.reviewer ?? '—'}</p>
                                  {reviewSummary?.reviewedAt && <p>{reviewSummary.reviewedAt}</p>}
                                  {reviewSummary?.notes && <p>{reviewSummary.notes}</p>}
                                </div>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-yellow-600">⏳ Pendente</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" title="Visualizar" onClick={() => handleOpenPdf(u)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Baixar" onClick={() => handleDownloadPdf(u)}>
                                <Download className="h-4 w-4" />
                              </Button>
                              {canManageUploads && !u.reviewed_by && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Marcar como revisado"
                                  onClick={() => { setReviewDialog(u); setReviewNotes(''); }}
                                  className="text-blue-600"
                                >
                                  <BarChart3 className="h-4 w-4" />
                                </Button>
                              )}
                              {canManageUploads && (
                                <Button variant="ghost" size="icon" title="Excluir" onClick={() => handleDeleteUpload(u)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== ABA: BIBLIOTECA ====== */}
        <TabsContent value="biblioteca" className="space-y-4 pt-4">
          {isAdminSme && (
            <div className="flex justify-end">
              <Button onClick={openNewModelo}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar Modelo
              </Button>
            </div>
          )}

          <Card>
            <CardContent className="pt-6">
              {loadingModelos ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : modelos.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum modelo cadastrado ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-36">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelos.map((m) => (
                      <TableRow key={m.id} className={!m.active ? 'opacity-50' : ''}>
                        <TableCell>
                          <p className="font-medium">{m.name}</p>
                          {m.description && (
                            <p className="text-xs text-muted-foreground">{m.description}</p>
                          )}
                        </TableCell>
                        <TableCell>{CATEGORY_LABELS[m.category]}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {m.file_type === 'word' ? 'Word' : m.file_type === 'pdf' ? 'PDF' : 'Outro'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={m.active ? 'default' : 'outline'}>
                            {m.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Abrir link"
                              onClick={() => window.open(m.external_url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            {isAdminSme && (
                              <>
                                <Button variant="ghost" size="icon" title="Editar" onClick={() => openEditModelo(m)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={m.active ? 'Desativar' : 'Ativar'}
                                  onClick={() => handleToggleModelo(m)}
                                >
                                  {m.active
                                    ? <ToggleRight className="h-4 w-4 text-primary" />
                                    : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Excluir"
                                  onClick={() => handleDeleteModelo(m)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
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
      </Tabs>

      {/* ====== DIALOG: MARCAR COMO REVISADO ====== */}
      <Dialog open={!!reviewDialog} onOpenChange={(open) => !open && setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Revisado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">Arquivo: {reviewDialog?.original_filename ?? 'Sem nome'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Enviado em: {reviewDialog?.created_at ? new Date(reviewDialog.created_at).toLocaleDateString('pt-BR') : '—'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Adicione observações sobre a revisão..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(null)}>Cancelar</Button>
            <Button onClick={() => reviewDialog && handleMarkReviewed(reviewDialog)}>Confirmar Revisão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== DIALOG: ADICIONAR / EDITAR MODELO ====== */}
      <Dialog open={modeloDialog} onOpenChange={setModeloDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModelo ? 'Editar Modelo' : 'Novo Modelo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do documento <span className="text-destructive">*</span></Label>
              <Input
                value={modeloForm.name}
                onChange={(e) => setModeloForm({ ...modeloForm, name: e.target.value })}
                placeholder="Ex: Ficha Biográfica"
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={modeloForm.category}
                onValueChange={(v) => setModeloForm({ ...modeloForm, category: v as Categoria })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de arquivo</Label>
              <Select
                value={modeloForm.file_type ?? 'word'}
                onValueChange={(v) => setModeloForm({ ...modeloForm, file_type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="word">Word (editável)</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Link do Google Drive <span className="text-destructive">*</span></Label>
              <Input
                value={modeloForm.external_url}
                onChange={(e) => setModeloForm({ ...modeloForm, external_url: e.target.value })}
                placeholder="https://drive.google.com/..."
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={modeloForm.description ?? ''}
                onChange={(e) => setModeloForm({ ...modeloForm, description: e.target.value })}
                placeholder="Informações adicionais sobre o documento..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModeloDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveModelo}
              disabled={!modeloForm.name || !modeloForm.external_url || savingModelo}
            >
              {savingModelo ? 'Salvando...' : 'Salvar'}
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
            ? [
                viewerUpload.school?.name,
                viewerUpload.classroom ? `${viewerUpload.classroom.year_grade} ${viewerUpload.classroom.label}` : null,
                viewerUpload.student?.name ?? null,
              ]
                .filter(Boolean)
                .join(' · ')
            : null
        }
        storagePath={viewerUpload?.storage_path}
      />
    </div>
  );
}
