'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface School {
  id: string;
  name: string;
}

interface Classroom {
  id: string;
  school_id: string;
  year_grade: string;
  label: string;
  shift: string;
  dt_user_id: string | null;
  schools?: { name: string };
}

export default function TurmasPage() {
  const { profile } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [form, setForm] = useState({
    school_id: '',
    year_grade: '',
    label: '',
    shift: 'Manhã',
  });

  const isAdmin = profile?.role === 'ADMIN_SME';

  useEffect(() => {
    Promise.all([fetchClassrooms(), fetchSchools()]);
  }, []);

  async function fetchClassrooms() {
    setLoading(true);
    const { data } = await supabase
      .from('classrooms')
      .select('*, schools(name)')
      .order('year_grade');
    setClassrooms((data as any[]) ?? []);
    setLoading(false);
  }

  async function fetchSchools() {
    const { data } = await supabase.from('schools').select('id, name').order('name');
    setSchools(data ?? []);
  }

  function openCreate() {
    setEditing(null);
    setForm({ school_id: '', year_grade: '', label: '', shift: 'Manhã' });
    setDialogOpen(true);
  }

  function openEdit(c: Classroom) {
    setEditing(c);
    setForm({
      school_id: c.school_id,
      year_grade: c.year_grade,
      label: c.label,
      shift: c.shift,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.school_id || !form.year_grade || !form.label) return;

    if (editing) {
      const { error } = await supabase
        .from('classrooms')
        .update(form)
        .eq('id', editing.id);
      if (!error) {
        await logAudit('UPDATE', 'classrooms', editing.id, form);
        // Garantir access_lock
      }
    } else {
      const { data, error } = await supabase
        .from('classrooms')
        .insert(form)
        .select()
        .single();
      if (!error && data) {
        await logAudit('CREATE', 'classrooms', data.id, form);
        // Criar access_lock padrão
        await supabase.from('access_locks').insert({
          classroom_id: data.id,
          bio_form_locked: true,
        });
      }
    }

    setDialogOpen(false);
    fetchClassrooms();
  }

  async function handleDelete(c: Classroom) {
    if (!confirm(`Excluir turma "${c.year_grade} ${c.label}"?`)) return;
    const { error } = await supabase.from('classrooms').delete().eq('id', c.id);
    if (!error) {
      await logAudit('DELETE', 'classrooms', c.id);
      fetchClassrooms();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Turmas</h1>
          <p className="text-muted-foreground">Gerenciamento de turmas da rede</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Turma
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : classrooms.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma turma cadastrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Escola</TableHead>
                  <TableHead>Ano/Série</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Turno</TableHead>
                  {isAdmin && <TableHead className="w-24">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {classrooms.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{(c as any).schools?.name ?? '—'}</TableCell>
                    <TableCell className="font-medium">{c.year_grade}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.label}</Badge>
                    </TableCell>
                    <TableCell>{c.shift}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Turma' : 'Nova Turma'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Escola</Label>
              <Select value={form.school_id} onValueChange={(v) => setForm({ ...form, school_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a escola" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ano/Série</Label>
                <Input
                  value={form.year_grade}
                  onChange={(e) => setForm({ ...form, year_grade: e.target.value })}
                  placeholder="6º Ano"
                />
              </div>
              <div className="space-y-2">
                <Label>Turma</Label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="A"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Turno</Label>
              <Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manhã">Manhã</SelectItem>
                  <SelectItem value="Tarde">Tarde</SelectItem>
                  <SelectItem value="Integral">Integral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>{editing ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
