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
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import Link from 'next/link';

interface Student {
  id: string;
  name: string;
  enrollment_code: string | null;
  birthdate: string | null;
  status: string;
  responsible_name: string | null;
  classroom_id: string;
  school_id: string;
  classrooms?: { year_grade: string; label: string; schools?: { name: string } };
}

export default function AlunosPage() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [search, setSearch] = useState('');
  const [filterSchool, setFilterSchool] = useState('all');
  const [filterClassroom, setFilterClassroom] = useState('all');
  const [form, setForm] = useState({
    name: '',
    enrollment_code: '',
    birthdate: '',
    responsible_name: '',
    responsible_phone: '',
    school_id: '',
    classroom_id: '',
    status: 'Ativo',
  });

  const isAdmin = profile?.role === 'ADMIN_SME';
  const canEdit = profile?.role === 'ADMIN_SME' || profile?.role === 'DT';

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [studentsRes, schoolsRes, classroomsRes] = await Promise.all([
      supabase
        .from('students')
        .select('*, classrooms(year_grade, label, schools(name))')
        .order('name'),
      supabase.from('schools').select('id, name').order('name'),
      supabase.from('classrooms').select('id, school_id, year_grade, label').order('year_grade'),
    ]);
    setStudents((studentsRes.data as any[]) ?? []);
    setSchools(schoolsRes.data ?? []);
    setClassrooms(classroomsRes.data ?? []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm({
      name: '',
      enrollment_code: '',
      birthdate: '',
      responsible_name: '',
      responsible_phone: '',
      school_id: '',
      classroom_id: '',
      status: 'Ativo',
    });
    setDialogOpen(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    setForm({
      name: s.name,
      enrollment_code: s.enrollment_code ?? '',
      birthdate: s.birthdate ?? '',
      responsible_name: s.responsible_name ?? '',
      responsible_phone: '',
      school_id: s.school_id,
      classroom_id: s.classroom_id,
      status: s.status,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.school_id || !form.classroom_id) return;
    const payload = {
      name: form.name,
      enrollment_code: form.enrollment_code || null,
      birthdate: form.birthdate || null,
      responsible_name: form.responsible_name || null,
      responsible_phone: form.responsible_phone || null,
      school_id: form.school_id,
      classroom_id: form.classroom_id,
      status: form.status,
    };

    if (editing) {
      const { error } = await supabase.from('students').update(payload).eq('id', editing.id);
      if (!error) await logAudit('UPDATE', 'students', editing.id, { name: form.name });
    } else {
      const { data, error } = await supabase.from('students').insert(payload).select().single();
      if (!error && data) {
        await logAudit('CREATE', 'students', data.id, { name: form.name });
        // Criar bio_form vazio
        await supabase.from('bio_forms').insert({ student_id: data.id, sections_json: {} });
      }
    }

    setDialogOpen(false);
    fetchAll();
  }

  async function handleDelete(s: Student) {
    if (!confirm(`Excluir aluno "${s.name}"?`)) return;
    const { error } = await supabase.from('students').delete().eq('id', s.id);
    if (!error) {
      await logAudit('DELETE', 'students', s.id, { name: s.name });
      fetchAll();
    }
  }

  const filtered = students.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchSchool = filterSchool === 'all' || s.school_id === filterSchool;
    const matchClass = filterClassroom === 'all' || s.classroom_id === filterClassroom;
    return matchSearch && matchSchool && matchClass;
  });

  const filteredClassrooms =
    form.school_id
      ? classrooms.filter((c: any) => c.school_id === form.school_id)
      : classrooms;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Alunos</h1>
          <p className="text-muted-foreground">Cadastro e consulta de alunos</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Aluno
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={filterSchool} onValueChange={setFilterSchool}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Escola" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as escolas</SelectItem>
            {schools.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterClassroom} onValueChange={setFilterClassroom}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Turma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as turmas</SelectItem>
            {classrooms.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>
                {c.year_grade} {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground">Nenhum aluno encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Escola</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="w-24">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.enrollment_code || '—'}</TableCell>
                    <TableCell>
                      {(s as any).classrooms?.year_grade} {(s as any).classrooms?.label}
                    </TableCell>
                    <TableCell>{(s as any).classrooms?.schools?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === 'Ativo' ? 'success' : 'secondary'}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(s)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            {filtered.length} aluno(s) encontrado(s)
          </p>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Aluno' : 'Novo Aluno'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Matrícula</Label>
                <Input
                  value={form.enrollment_code}
                  onChange={(e) => setForm({ ...form, enrollment_code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Input
                  type="date"
                  value={form.birthdate}
                  onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Escola *</Label>
              <Select
                value={form.school_id}
                onValueChange={(v) => setForm({ ...form, school_id: v, classroom_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Turma *</Label>
              <Select value={form.classroom_id} onValueChange={(v) => setForm({ ...form, classroom_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {filteredClassrooms.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.year_grade} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input
                value={form.responsible_name}
                onChange={(e) => setForm({ ...form, responsible_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone do Responsável</Label>
              <Input
                value={form.responsible_phone}
                onChange={(e) => setForm({ ...form, responsible_phone: e.target.value })}
                placeholder="(88) 99999-0000"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Transferido">Transferido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>{editing ? 'Salvar' : 'Cadastrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
