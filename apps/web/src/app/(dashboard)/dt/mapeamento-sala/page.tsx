'use client';

import React, { useEffect, useState } from 'react';
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

export default function MapeamentoSalaPage() {
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
  }, [turmaId]);

  async function loadData() {
    setLoading(true);
    const [classRes, studentsRes, photosRes, seatMapRes] = await Promise.all([
      supabase.from('classrooms').select('*, schools(name)').eq('id', turmaId).single(),
      supabase
        .from('students')
        .select('id, name, is_leader, is_vice_leader')
        .eq('classroom_id', turmaId)
        .eq('status', 'Ativo')
        .order('name'),
      supabase.from('student_photos').select('student_id, storage_path'),
      supabase.from('seat_maps').select('layout_json').eq('classroom_id', turmaId).single(),
    ]);

    setClassroom(classRes.data);

    const photoMap = new Map<string, string>();
    (photosRes.data ?? []).forEach((p: any) => {
      const { data } = supabase.storage.from('student-photos').getPublicUrl(p.storage_path);
      photoMap.set(p.student_id, data?.publicUrl ?? '');
    });

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
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFontSize(16);
    doc.text('Mapeamento de Sala', pageWidth / 2, 12, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`${classroom?.schools?.name ?? ''} — ${classroom?.year_grade} ${classroom?.label} (${classroom?.shift})`, pageWidth / 2, 18, { align: 'center' });

    doc.setFillColor(200, 200, 200);
    doc.rect(pageWidth / 2 - 40, 22, 80, 6, 'F');
    doc.setFontSize(8);
    doc.text('QUADRO', pageWidth / 2, 26, { align: 'center' });

    const gridStartY = 32;
    const cellW = Math.min(35, (pageWidth - 30) / layout.cols);
    const cellH = Math.min(30, (pageHeight - gridStartY - 15) / layout.rows);
    const gridStartX = (pageWidth - layout.cols * cellW) / 2;

    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        const x = gridStartX + c * cellW;
        const y = gridStartY + r * cellH;
        const studentId = layout.seats[r]?.[c];
        const student = getStudentById(studentId);

        doc.setDrawColor(180);
        doc.rect(x, y, cellW, cellH);

        if (student) {
          doc.setFontSize(6);
          const name = student.name.length > 18 ? student.name.substring(0, 18) + '...' : student.name;
          doc.text(name, x + cellW / 2, y + cellH / 2, { align: 'center' });
          if (student.is_leader) {
            doc.setFontSize(5);
            doc.text('(L)', x + cellW / 2, y + cellH / 2 + 4, { align: 'center' });
          }
        }
      }
    }

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
                      className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-1 min-h-[70px] transition-colors hover:border-primary/50"
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(rIdx, cIdx)}
                      onClick={() => studentId && removeSeat(rIdx, cIdx)}
                      title={student ? `${student.name} (clique para remover)` : 'Arraste um aluno aqui'}
                    >
                      {student ? (
                        <>
                          {student.photoUrl ? (
                            <img src={student.photoUrl} alt={student.name} className="h-10 w-10 rounded-full object-cover mb-1" />
                          ) : (
                            <User className="h-8 w-8 text-muted-foreground mb-1" />
                          )}
                          <span className="text-[9px] text-center leading-tight truncate w-full">{student.name.split(' ').slice(0, 2).join(' ')}</span>
                          {student.is_leader && <Badge className="text-[8px] px-1 py-0 mt-0.5" variant="default">L</Badge>}
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
