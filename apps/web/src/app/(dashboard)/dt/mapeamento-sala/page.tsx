'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Save, Download, Plus, Minus, User, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';

interface StudentSeat {
  id: string;
  name: string;
  photoUrl: string | null;
  is_leader: boolean;
  is_vice_leader: boolean;
}

interface SeatLayout {
  rows: number;
  cols: number;
  seats: (string | null)[][];
}

function MapeamentoSalaPageContent() {
  const searchParams = useSearchParams();
  const turmaId = searchParams.get('turmaId') || '';
  const { user } = useAuth();

  const [classroom, setClassroom] = useState<any>(null);
  const [students, setStudents] = useState<StudentSeat[]>([]);
  const [layout, setLayout] = useState<SeatLayout>({ rows: 5, cols: 6, seats: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedStudent, setDraggedStudent] = useState<string | null>(null);

  useEffect(() => {
    if (!turmaId) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaId]);

  async function loadData() {
    setLoading(true);
    const [classRes, studentsRes, seatMapRes] = await Promise.all([
      supabase.from('classrooms').select('*, schools(name)').eq('id', turmaId).single(),
      supabase
        .from('students')
        .select('id, name, is_leader, is_vice_leader')
        .eq('classroom_id', turmaId)
        .eq('status', 'Ativo')
        .order('name'),
      supabase.from('seat_maps').select('layout_json').eq('classroom_id', turmaId).single(),
    ]);

    setClassroom(classRes.data);

    // Buscar fotos apenas dos alunos desta turma
    const studentIds = (studentsRes.data ?? []).map((s) => s.id);
    let photosRes: any = { data: [] };
    if (studentIds.length > 0) {
      photosRes = await supabase
        .from('student_photos')
        .select('student_id, storage_path')
        .in('student_id', studentIds);
    }

    const photoMap = new Map<string, string>();
    const photos = photosRes.data ?? [];
    if (photos.length > 0) {
      const results = await Promise.all(
        photos.map((photo: any) =>
          supabase.storage
            .from('student-photos')
            .createSignedUrl(photo.storage_path, 3600)
            .then(({ data }) => ({ studentId: photo.student_id, signedUrl: data?.signedUrl ?? null }))
            .catch(() => ({ studentId: photo.student_id, signedUrl: null as string | null }))
        )
      );
      for (const { studentId, signedUrl } of results) {
        if (signedUrl) photoMap.set(studentId, signedUrl);
      }
    }

    const studentsWithPhotos: StudentSeat[] = (studentsRes.data ?? []).map((s: any) => ({
      ...s,
      photoUrl: photoMap.get(s.id) ?? null,
    }));
    setStudents(studentsWithPhotos);

    if (seatMapRes.data?.layout_json) {
      const saved = seatMapRes.data.layout_json as any;
      setLayout({
        rows: saved.rows ?? 5,
        cols: saved.cols ?? 6,
        seats: saved.seats ?? createEmptySeats(saved.rows ?? 5, saved.cols ?? 6),
      });
    } else {
      setLayout({ rows: 5, cols: 6, seats: createEmptySeats(5, 6) });
    }

    setLoading(false);
  }

  function createEmptySeats(rows: number, cols: number): (string | null)[][] {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
  }

  function getAssignedStudentIds(): Set<string> {
    const ids = new Set<string>();
    layout.seats.forEach((row) => row.forEach((id) => id && ids.add(id)));
    return ids;
  }

  function getUnassignedStudents(): StudentSeat[] {
    const assigned = getAssignedStudentIds();
    return students.filter((s) => !assigned.has(s.id));
  }

  function getStudentById(id: string | null): StudentSeat | undefined {
    if (!id) return undefined;
    return students.find((s) => s.id === id);
  }

  function handleDragStart(studentId: string) {
    setDraggedStudent(studentId);
  }

  function handleDrop(rowIdx: number, colIdx: number) {
    if (!draggedStudent) return;
    const newSeats = layout.seats.map((row) => row.map((id) => (id === draggedStudent ? null : id)));
    newSeats[rowIdx][colIdx] = draggedStudent;
    setLayout({ ...layout, seats: newSeats });
    setDraggedStudent(null);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function removeSeat(rowIdx: number, colIdx: number) {
    const newSeats = [...layout.seats];
    newSeats[rowIdx] = [...newSeats[rowIdx]];
    newSeats[rowIdx][colIdx] = null;
    setLayout({ ...layout, seats: newSeats });
  }

  function changeGridSize(rows: number, cols: number) {
    const newSeats = createEmptySeats(rows, cols);
    for (let r = 0; r < Math.min(rows, layout.rows); r++) {
      for (let c = 0; c < Math.min(cols, layout.cols); c++) {
        newSeats[r][c] = layout.seats[r]?.[c] ?? null;
      }
    }
    setLayout({ rows, cols, seats: newSeats });
  }

  function resetLayout() {
    if (!confirm('Limpar todo o mapeamento?')) return;
    setLayout({ ...layout, seats: createEmptySeats(layout.rows, layout.cols) });
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    await supabase.from('seat_maps').upsert({
      classroom_id: turmaId,
      layout_json: layout,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    });
    await logAudit('UPDATE', 'seat_maps', turmaId, { rows: layout.rows, cols: layout.cols });
    setSaving(false);
  }

  async function exportPDF() {
    // Desenha tudo num canvas HTML (suporte nativo a círculos) e embute no PDF
    const S = 4; // px por mm (96 dpi ≈ 3.78; usando 4 para qualidade)
    const PW = 297 * S; // canvas largura (A4 landscape)
    const PH = 210 * S; // canvas altura

    const canvas = document.createElement('canvas');
    canvas.width = PW;
    canvas.height = PH;
    const ctx = canvas.getContext('2d')!;

    // Fundo branco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PW, PH);

    const mg = 12 * S;
    const hdrH = 30 * S;

    // ── Cabeçalho ──
    ctx.textAlign = 'center';
    ctx.fillStyle = '#111827';
    ctx.font = `bold ${13 * S}px sans-serif`;
    ctx.fillText('Mapeamento de Sala', PW / 2, 11 * S);

    ctx.font = `${8 * S}px sans-serif`;
    ctx.fillStyle = '#374151';
    ctx.fillText(
      `${classroom?.schools?.name ?? ''} — ${classroom?.year_grade} ${classroom?.label} (${classroom?.shift})`,
      PW / 2, 18 * S,
    );

    // Barra QUADRO
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(PW / 2 - 38 * S, 21 * S, 76 * S, 7 * S);
    ctx.fillStyle = '#374151';
    ctx.font = `bold ${7 * S}px sans-serif`;
    ctx.fillText('QUADRO / LOUSA', PW / 2, 26 * S);

    // ── Carregar todas as fotos em paralelo ──
    const imgMap = new Map<string, HTMLImageElement>();
    await Promise.all(
      students
        .filter((s) => s.photoUrl)
        .map(
          (s) =>
            new Promise<void>((resolve) => {
              const img = new window.Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => { imgMap.set(s.id, img); resolve(); };
              img.onerror = () => resolve();
              img.src = s.photoUrl!;
            }),
        ),
    );

    // ── Grid ──
    const gridW = PW - mg * 2;
    const gridH = PH - hdrH - mg;
    const cellW = gridW / layout.cols;
    const cellH = gridH / layout.rows;
    const namePad = 8 * S;
    const pad = 2 * S;
    const photoR = Math.min(cellW - pad * 2, cellH - namePad - pad * 2) / 2; // raio

    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        const x = mg + c * cellW;
        const y = hdrH + r * cellH;
        const student = getStudentById(layout.seats[r]?.[c]);

        // Borda da célula
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 0.5 * S;
        ctx.strokeRect(x, y, cellW, cellH);

        if (!student) continue;

        const cx = x + cellW / 2;         // centro X da célula
        const cy = y + pad + photoR;      // centro Y da foto

        // ── Foto circular ──
        const img = imgMap.get(student.id);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, photoR, 0, Math.PI * 2);
        ctx.closePath();

        if (img) {
          ctx.clip();
          // object-cover: escala para cobrir o círculo sem deformar
          const sc = Math.max((photoR * 2) / img.width, (photoR * 2) / img.height);
          const dw = img.width * sc;
          const dh = img.height * sc;
          ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
        } else {
          // Placeholder cinza
          ctx.fillStyle = '#e5e7eb';
          ctx.fill();
        }
        ctx.restore();

        // Borda do círculo
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 0.8 * S;
        ctx.beginPath();
        ctx.arc(cx, cy, photoR, 0, Math.PI * 2);
        ctx.stroke();

        // ── Nome ──
        const parts = student.name.trim().split(' ');
        const displayName =
          parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0];
        const fontSize = Math.max(5 * S, Math.min(7 * S, cellW / 9));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = '#111827';
        ctx.textAlign = 'center';
        ctx.fillText(
          displayName.length > 16 ? displayName.substring(0, 15) + '.' : displayName,
          cx,
          y + cellH - 2 * S,
        );

        // ── Badge líder / vice ──
        if (student.is_leader || student.is_vice_leader) {
          const bw = 9 * S, bh = 3.5 * S, br = 1.5 * S;
          const bx = x + cellW - bw - 1 * S;
          const by = y + 1 * S;
          ctx.fillStyle = student.is_leader ? '#16a34a' : '#6b7280';
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, br);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${3.5 * S}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(student.is_leader ? 'LÍDER' : 'VICE', bx + bw / 2, by + bh * 0.72);
        }
      }
    }

    // ── Embute canvas como imagem no PDF ──
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.addImage(imgData, 'JPEG', 0, 0, 297, 210);
    doc.save(`mapeamento_sala_${classroom?.year_grade}_${classroom?.label}.pdf`);
  }

  if (!turmaId) {
    return <div className="text-red-500">Parâmetro turmaId não encontrado na URL.</div>;
  }

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Carregando mapeamento...</div>;
  }

  const unassigned = getUnassignedStudents();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mapeamento de Sala</h1>
          <p className="text-muted-foreground">{classroom?.schools?.name} — {classroom?.year_grade} {classroom?.label}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPDF}><Download className="mr-2 h-4 w-4" />PDF</Button>
          <Button onClick={handleSave} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Filas:</Label>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => layout.rows > 1 && changeGridSize(layout.rows - 1, layout.cols)}><Minus className="h-3 w-3" /></Button>
              <span className="w-8 text-center font-mono">{layout.rows}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeGridSize(layout.rows + 1, layout.cols)}><Plus className="h-3 w-3" /></Button>
            </div>
            <div className="flex items-center gap-2">
              <Label>Colunas:</Label>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => layout.cols > 1 && changeGridSize(layout.rows, layout.cols - 1)}><Minus className="h-3 w-3" /></Button>
              <span className="w-8 text-center font-mono">{layout.cols}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeGridSize(layout.rows, layout.cols + 1)}><Plus className="h-3 w-3" /></Button>
            </div>
            <Button variant="ghost" size="sm" onClick={resetLayout}><RotateCcw className="mr-1 h-3 w-3" />Limpar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-6">
        <Card>
          <CardHeader>
            <div className="bg-muted rounded-md py-2 text-center text-sm font-medium text-muted-foreground">QUADRO / LOUSA</div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}>
              {layout.seats.map((row, rIdx) =>
                row.map((studentId, cIdx) => {
                  const student = getStudentById(studentId);
                  return (
                    <div
                      key={`${rIdx}-${cIdx}`}
                      className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-2 min-h-[120px] transition-colors hover:border-primary/50 cursor-pointer bg-background"
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(rIdx, cIdx)}
                      onClick={() => studentId && removeSeat(rIdx, cIdx)}
                      title={student ? `${student.name} (clique para remover)` : 'Arraste um aluno aqui'}
                    >
                      {student ? (
                        <>
                          {student.photoUrl ? (
                            <img src={student.photoUrl} alt={student.name} className="h-20 w-20 rounded-full object-cover mb-1 flex-shrink-0" />
                          ) : (
                            <User className="h-16 w-16 text-muted-foreground mb-1 flex-shrink-0" />
                          )}
                          <span className="text-[8px] text-center leading-tight truncate w-full px-1">{student.name.split(' ').slice(0, 2).join(' ')}</span>
                          {student.is_leader && <Badge className="text-[7px] px-1 py-0 mt-0.5" variant="default">L</Badge>}
                        </>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Vazio</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Alunos sem lugar ({unassigned.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
            {unassigned.length === 0 ? (
              <p className="text-xs text-muted-foreground">Todos posicionados!</p>
            ) : (
              unassigned.map((s) => (
                <div key={s.id} draggable onDragStart={() => handleDragStart(s.id)} className="flex items-center gap-2 p-2 rounded-md border cursor-grab hover:bg-accent transition-colors">
                  {s.photoUrl ? (
                    <img src={s.photoUrl} alt={s.name} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"><User className="h-4 w-4 text-muted-foreground" /></div>
                  )}
                  <span className="text-xs font-medium truncate">{s.name}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function MapeamentoSalaPage() {
  return (
    <Suspense fallback={<div className="animate-pulse text-muted-foreground">Carregando...</div>}>
      <MapeamentoSalaPageContent />
    </Suspense>
  );
}
