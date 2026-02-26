'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Camera, Upload, Star, Download, User, Image as ImageIcon } from 'lucide-react';
import jsPDF from 'jspdf';

interface StudentWithPhoto {
  id: string;
  name: string;
  enrollment_code: string | null;
  is_leader: boolean;
  is_vice_leader: boolean;
  photoUrl: string | null;
  storage_path: string | null;
}

export default function RegistroFotograficoPage() {
  const searchParams = useSearchParams();
  const turmaId = searchParams.get('turmaId') || '';
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [students, setStudents] = useState<StudentWithPhoto[]>([]);
  const [classroom, setClassroom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!turmaId) return;
    loadData();
  }, [turmaId]);

  async function loadData() {
    setLoading(true);
    const [classRes, studentsRes, photosRes] = await Promise.all([
      supabase.from('classrooms').select('*, schools(name)').eq('id', turmaId).single(),
      supabase
        .from('students')
        .select('id, name, enrollment_code, is_leader, is_vice_leader')
        .eq('classroom_id', turmaId)
        .eq('status', 'Ativo')
        .order('name'),
      supabase.from('student_photos').select('student_id, storage_path'),
    ]);

    setClassroom(classRes.data);

    const photoMap = new Map<string, string>();
    (photosRes.data ?? []).forEach((p: any) => {
      photoMap.set(p.student_id, p.storage_path);
    });

    const withPhotos: StudentWithPhoto[] = (studentsRes.data ?? []).map((s: any) => {
      const storagePath = photoMap.get(s.id) ?? null;
      let photoUrl: string | null = null;
      if (storagePath) {
        const { data } = supabase.storage.from('student-photos').getPublicUrl(storagePath);
        photoUrl = data?.publicUrl ?? null;
      }
      return { ...s, photoUrl, storage_path: storagePath };
    });

    setStudents(withPhotos);
    setLoading(false);
  }

  function openUploadDialog(studentId: string) {
    setUploadingFor(studentId);
    setPreviewUrl(null);
    setPreviewFile(null);
    setDialogOpen(true);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('A foto deve ter no máximo 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
      setPreviewFile(file);
    };
    reader.readAsDataURL(file);
  }

  async function handleUpload() {
    if (!uploadingFor || !previewFile || !user) return;

    const ext = previewFile.name.split('.').pop() ?? 'jpg';
    const path = `${turmaId}/${uploadingFor}.${ext}`;

    const student = students.find((s) => s.id === uploadingFor);
    if (student?.storage_path) {
      await supabase.storage.from('student-photos').remove([student.storage_path]);
    }

    const { error: uploadError } = await supabase.storage
      .from('student-photos')
      .upload(path, previewFile, { upsert: true });

    if (uploadError) {
      alert(`Erro ao enviar foto: ${uploadError.message}`);
      return;
    }

    await supabase
      .from('student_photos')
      .upsert({
        student_id: uploadingFor,
        storage_path: path,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      });

    await logAudit('UPDATE', 'student_photos', uploadingFor, { path });
    setDialogOpen(false);
    loadData();
  }

  async function toggleLeader(studentId: string, field: 'is_leader' | 'is_vice_leader') {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const newValue = !student[field];

    if (newValue) {
      const otherIds = students.filter((s) => s.id !== studentId && s[field]).map((s) => s.id);
      if (otherIds.length > 0) {
        await supabase
          .from('students')
          .update({ [field]: false })
          .in('id', otherIds);
      }
    }

    await supabase
      .from('students')
      .update({ [field]: newValue })
      .eq('id', studentId);

    loadData();
  }

  async function exportPDF() {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.text('Registro Fotográfico', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(
      `${classroom?.schools?.name ?? ''} — ${classroom?.year_grade} ${classroom?.label} (${classroom?.shift})`,
      pageWidth / 2,
      22,
      { align: 'center' }
    );

    const cols = 4;
    const cellW = 40;
    const cellH = 55;
    const startX = (pageWidth - cols * cellW) / 2;
    let x = startX;
    let y = 30;

    for (let i = 0; i < students.length; i++) {
      const s = students[i];

      if (y + cellH > 280) {
        doc.addPage();
        y = 15;
      }

      doc.setDrawColor(200);
      doc.rect(x + 5, y, 30, 35);

      if (s.photoUrl) {
        try {
          const img = await loadImage(s.photoUrl);
          doc.addImage(img, 'JPEG', x + 5, y, 30, 35);
        } catch {
          doc.setFontSize(8);
          doc.text('Sem foto', x + 12, y + 18);
        }
      } else {
        doc.setFontSize(8);
        doc.text('Sem foto', x + 12, y + 18);
      }

      doc.setFontSize(7);
      const displayName = s.name.length > 20 ? s.name.substring(0, 20) + '...' : s.name;
      doc.text(displayName, x + 20, y + 40, { align: 'center' });

      if (s.is_leader) {
        doc.setFontSize(6);
        doc.text('LÍDER', x + 20, y + 44, { align: 'center' });
      } else if (s.is_vice_leader) {
        doc.setFontSize(6);
        doc.text('VICE-LÍDER', x + 20, y + 44, { align: 'center' });
      }

      x += cellW;
      if ((i + 1) % cols === 0) {
        x = startX;
        y += cellH;
      }
    }

    doc.save(`registro_fotografico_${classroom?.year_grade}_${classroom?.label}.pdf`);
  }

  function loadImage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d')?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  if (!turmaId) {
    return <div className="text-red-500">Parâmetro turmaId não encontrado na URL.</div>;
  }

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Registro Fotográfico</h1>
          <p className="text-muted-foreground">
            {classroom?.schools?.name} — {classroom?.year_grade} {classroom?.label}
          </p>
        </div>
        <Button onClick={exportPDF} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {students.map((s) => (
          <Card
            key={s.id}
            className="group relative overflow-hidden hover:shadow-md transition-shadow"
          >
            <CardContent className="p-3 text-center">
              <div
                className="relative mx-auto mb-2 h-32 w-28 rounded-md overflow-hidden bg-muted cursor-pointer"
                onClick={() => openUploadDialog(s.id)}
              >
                {s.photoUrl ? (
                  <img src={s.photoUrl} alt={s.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <User className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="h-8 w-8 text-white" />
                </div>
              </div>

              <p className="text-xs font-medium truncate" title={s.name}>{s.name}</p>

              <div className="mt-1 flex justify-center gap-1 flex-wrap">
                {s.is_leader && (
                  <Badge variant="default" className="text-[10px] px-1.5 py-0">Líder</Badge>
                )}
                {s.is_vice_leader && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Vice-Líder</Badge>
                )}
              </div>

              <div className="mt-2 flex justify-center gap-1">
                <Button
                  variant={s.is_leader ? 'default' : 'ghost'}
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => toggleLeader(s.id, 'is_leader')}
                  title="Líder de turma"
                >
                  <Star className="h-3 w-3" />
                </Button>
                <Button
                  variant={s.is_vice_leader ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => toggleLeader(s.id, 'is_vice_leader')}
                  title="Vice-líder"
                >
                  V
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload de Foto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Aluno: <strong>{students.find((s) => s.id === uploadingFor)?.name}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Formato: JPG, PNG ou WebP. Máximo: 2MB. Tamanho ideal: 3x4.
            </p>

            {previewUrl ? (
              <div className="flex justify-center">
                <img src={previewUrl} alt="Preview" className="max-h-64 rounded-lg border object-contain" />
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Clique para selecionar a foto</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />

            {previewUrl && (
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                Escolher outra foto
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={!previewFile}>
              <Upload className="mr-2 h-4 w-4" />
              Enviar Foto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
