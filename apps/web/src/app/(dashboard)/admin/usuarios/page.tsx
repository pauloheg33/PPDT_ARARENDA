'use client';

import React, { useEffect, useState } from 'react';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { logAudit } from '@/lib/audit';
import { ROLES, ROLE_LABELS, type Role } from '@/lib/roles';
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

interface Profile {
  user_id: string;
  full_name: string;
  role: string;
  school_id: string | null;
  classroom_id: string | null;
}

export default function UsuariosPage() {
  const { profile: myProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'DT' as Role,
    school_id: '',
    classroom_id: '',
  });

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [pRes, sRes, cRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('schools').select('id, name').order('name'),
      supabase.from('classrooms').select('id, school_id, year_grade, label').order('year_grade'),
    ]);
    setProfiles(pRes.data ?? []);
    setSchools(sRes.data ?? []);
    setClassrooms(cRes.data ?? []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.email || !form.password || !form.full_name) return;

    // Criar usuário usando cliente separado (não afeta sessão do admin)
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.full_name },
      },
    });

    if (authError || !authData.user) {
      alert(`Erro ao criar usuário: ${authError?.message}`);
      return;
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      user_id: authData.user.id,
      role: form.role,
      full_name: form.full_name,
      school_id: form.school_id || null,
      classroom_id: form.classroom_id || null,
    });

    if (profileError) {
      alert(`Erro ao criar perfil: ${profileError.message}`);
      return;
    }

    // Se DT, atribuir turma
    if (form.role === 'DT' && form.classroom_id) {
      await supabase
        .from('classrooms')
        .update({ dt_user_id: authData.user.id })
        .eq('id', form.classroom_id);
    }

    await logAudit('CREATE', 'profiles', authData.user.id, {
      role: form.role,
      full_name: form.full_name,
    });

    setDialogOpen(false);
    fetchAll();
  }

  async function handleDelete(p: Profile) {
    if (!confirm(`Excluir o perfil de "${p.full_name}"?`)) return;
    await supabase.from('profiles').delete().eq('user_id', p.user_id);
    await logAudit('DELETE', 'profiles', p.user_id, { full_name: p.full_name });
    fetchAll();
  }

  const filteredClassrooms = form.school_id
    ? classrooms.filter((c: any) => c.school_id === form.school_id)
    : classrooms;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">Gestão de acessos e papéis</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Escola</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.user_id}>
                    <TableCell className="font-medium">{p.full_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ROLE_LABELS[p.role as Role] ?? p.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.school_id
                        ? schools.find((s: any) => s.id === p.school_id)?.name ?? '—'
                        : 'Rede'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(p)}
                        disabled={p.user_id === myProfile?.user_id}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
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
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as Role })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {['GESTOR_ESCOLA', 'DT', 'ALUNO'].includes(form.role) && (
              <div className="space-y-2">
                <Label>Escola</Label>
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
            )}
            {['DT', 'ALUNO'].includes(form.role) && (
              <div className="space-y-2">
                <Label>Turma</Label>
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
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Criar Usuário</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
