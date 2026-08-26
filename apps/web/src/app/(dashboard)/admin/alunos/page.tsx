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
import { Plus, Pencil, Trash2, Search, Eye, FilePenLine } from 'lucide-react';
import Link from 'next/link';

interface Student {
  id: string;
  name: string;
  enrollment_code: string | null;
  birthdate: string | null;
  status: string;
  responsible_name: string | null;
  responsible_phone: string | null;
  classroom_id: string;
  school_id: string;
  classrooms?: { year_grade: string; label: string; schools?: { name: string } };
}

interface School {
  id: string;
  name: string;
}

interface Classroom {
  id: string;
  school_id: string;
  year_grade: string;
  label: string;
}

export default function AlunosPage() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
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
  const isCoord = profile?.role === 'COORD_PPDT';
  const isDt = profile?.role === 'DT';
  const isSchoolScoped = isCoord || profile?.role === 'GESTOR_ESCOLA';
  const canEdit = profile?.role === 'ADMIN_SME' || profile?.role === 'DT';

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (isSchoolScoped && profile?.school_id) {
      setFilterSchool(profile.school_id);
    }
  }, [isSchoolScoped, profile?.school_id]);

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
      school_id: isDt ? profile?.school_id ?? '' : '',
      classroom_id: isDt ? profile?.classroom_id ?? '' : '',
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
      responsible_phone: s.responsible_phone ?? '',
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
      if (!error) {
        await logAudit('UPDATE', 'students', editing.id, { name: form.name });
        const cls = classrooms.find((c) => c.id === form.classroom_id);
        const school = schools.find((s) => s.id === form.school_id);
        setStudents((prev) =>
          prev.map((s) =>
            s.id === editing.id
              ? {
                  ...s,
                  ...payload,
                  classrooms: cls
                    ? { year_grade: cls.year_grade, label: cls.label, schools: { name: school?.name ?? '' } }
                    : s.classrooms,
                }
              : s
          )
        );
      }
    } else {
      const { data, error } = await supabase.from('students').insert(payload).select().single();
      if (!error && data) {
        await logAudit('CREATE', 'students', data.id, { name: form.name });
        await supabase.from('bio_forms').insert({ student_id: data.id, sections_json: {} });
        const cls = classrooms.find((c) => c.id === form.classroom_id);
        const school = schools.find((s) => s.id === form.school_id);
        const newStudent: Student = {
          ...(data as any),
          classrooms: cls
            ? { year_grade: cls.year_grade, label: cls.label, schools: { name: school?.name ?? '' } }
            : undefined,
        };
        setStudents((prev) =>
          [...prev, newStudent].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        );
      }
    }

    setDialogOpen(false);
  }

  async function handleDelete(s: Student) {
    if (!confirm(`Excluir aluno "${s.name}"?`)) return;
    const { error } = await supabase.from('students').delete().eq('id', s.id);
    if (!error) {
      await logAudit('DELETE', 'students', s.id, { name: s.name });
      setStudents((prev) => prev.filter((st) => st.id !== s.id));
    }
  }

  const filtered = students.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const effectiveSchoolFilter = isSchoolScoped && profile?.school_id ? profile.school_id : filterSchool;
    const matchSchool = effectiveSchoolFilter === 'all' || s.school_id === effectiveSchoolFilter;
    const matchClass = filterClassroom === 'all' || s.classroom_id === filterClassroom;
    return matchSearch && matchSchool && matchClass;
  });

  const formClassrooms = isDt && profile?.classroom_id
    ? classrooms.filter((c) => c.id === profile.classroom_id)
    : form.school_id
      ? classrooms.filter((c) => c.school_id === form.school_id)
      : classrooms;

  const formSchools = isDt && profile?.school_id
    ? schools.filter((school) => school.id === profile.school_id)
    : schools;

  const filterClassrooms =
    (isSchoolScoped && profile?.school_id ? profile.school_id : filterSchool) !== 'all'
      ? classrooms.filter((c) => c.school_id === (isSchoolScoped && profile?.school_id ? profile.school_id : filterSchool))
      : classrooms;

  const fixedSchoolName = isSchoolScoped && profile?.school_id
    ? schools.find((school) => school.id === profile.school_id)?.name ?? 'Escola vinculada'
    : null;

  return (
      <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Alunos</h1>
          <p className="text-muted-foreground">Cadastro e consulta de alunos</p>
          {fixedSchoolName && (
            <Badge variant="outline" className="mt-2">
              Escola fixa: {fixedSchoolName}
            </Badge>
          )}
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Aluno
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
        <div className="min-w-0 flex-1">
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
        <Select
          value={isSchoolScoped && profile?.school_id ? profile.school_id : filterSchool}
          onValueChange={(value) => {
            setFilterSchool(value);
            setFilterClassroom('all');
          }}
          disabled={isSchoolScoped}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Escola" />
          </SelectTrigger>
          <SelectContent>
            {!isSchoolScoped && <SelectItem value="all">Todas as escolas</SelectItem>}
            {schools.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterClassroom} onValueChange={setFilterClassroom}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Turma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as turmas</SelectItem>
            {filterClassrooms.map((c) => (
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
            <>
            <div className="space-y-3 md:hidden">
              {filtered.map((s) => (
                <div key={s.id} className="rounded-lg border p-3">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Link
                        href={`/admin/alunos/ficha-biografica?alunoId=${s.id}`}
                        className="block text-sm font-medium hover:text-primary hover:underline underline-offset-4"
                      >
                        {s.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Matrícula: {s.enrollment_code || '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Turma: {(s as any).classrooms?.year_grade} {(s as any).classrooms?.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Escola: {(s as any).classrooms?.schools?.name ?? '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={s.status === 'Ativo' ? 'success' : 'secondary'}>
                        {s.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/admin/alunos/ficha-biografica?alunoId=${s.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="mr-2 h-4 w-4" />
                          Ver ficha
                        </Button>
                      </Link>
                      {isDt && (
                        <Link href={`/dt/ficha-biografica?turmaId=${s.classroom_id}&alunoId=${s.id}`}>
                          <Button variant="outline" size="sm">
                            <FilePenLine className="mr-2 h-4 w-4 text-primary" />
                            Editar ficha
                          </Button>
                        </Link>
                      )}
                      {canEdit && (
                        <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar aluno
                        </Button>
                      )}
                      {isAdmin && (
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(s)}>
                          <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                          Excluir
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Escola</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-48">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/alunos/ficha-biografica?alunoId=${s.id}`}
                        className="hover:text-primary hover:underline underline-offset-4"
                      >
                        {s.name}
                      </Link>
                    </TableCell>
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
                    <TableCell>
                      <div className="flex gap-1">
                        <Link href={`/admin/alunos/ficha-biografica?alunoId=${s.id}`}>
                          <Button variant="ghost" size="icon" title="Ver ficha">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {isDt && (
                          <Link href={`/dt/ficha-biografica?turmaId=${s.classroom_id}&alunoId=${s.id}`}>
                            <Button variant="ghost" size="icon" title="Editar ficha biográfica">
                              <FilePenLine className="h-4 w-4 text-primary" />
                            </Button>
                          </Link>
                        )}
                        {canEdit && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)} title="Editar aluno">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(s)} title="Excluir aluno">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
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
                disabled={isDt}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {formSchools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Turma *</Label>
              <Select value={form.classroom_id} onValueChange={(v) => setForm({ ...form, classroom_id: v })} disabled={isDt}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {formClassrooms.map((c) => (
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
