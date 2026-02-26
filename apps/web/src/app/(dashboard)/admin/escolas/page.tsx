'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface School {
  id: string;
  inep: string | null;
  name: string;
  created_at: string;
}

export default function EscolasPage() {
  const { profile } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [form, setForm] = useState({ name: '', inep: '' });

  const isAdmin = profile?.role === 'ADMIN_SME';

  useEffect(() => {
    fetchSchools();
  }, []);

  async function fetchSchools() {
    setLoading(true);
    const { data } = await supabase.from('schools').select('*').order('name');
    setSchools(data ?? []);
    setLoading(false);
  }

  function openCreate() {
    setEditingSchool(null);
    setForm({ name: '', inep: '' });
    setDialogOpen(true);
  }

  function openEdit(school: School) {
    setEditingSchool(school);
    setForm({ name: school.name, inep: school.inep ?? '' });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;

    if (editingSchool) {
      const { error } = await supabase
        .from('schools')
        .update({ name: form.name, inep: form.inep || null })
        .eq('id', editingSchool.id);
      if (!error) {
        await logAudit('UPDATE', 'schools', editingSchool.id, { name: form.name });
      }
    } else {
      const { data, error } = await supabase
        .from('schools')
        .insert({ name: form.name, inep: form.inep || null })
        .select()
        .single();
      if (!error && data) {
        await logAudit('CREATE', 'schools', data.id, { name: form.name });
      }
    }

    setDialogOpen(false);
    fetchSchools();
  }

  async function handleDelete(school: School) {
    if (!confirm(`Tem certeza que deseja excluir "${school.name}"? Esta ação removerá todas as turmas e alunos associados.`)) return;

    const { error } = await supabase.from('schools').delete().eq('id', school.id);
    if (!error) {
      await logAudit('DELETE', 'schools', school.id, { name: school.name });
      fetchSchools();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Escolas</h1>
          <p className="text-muted-foreground">Gerenciamento das escolas da rede municipal</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Escola
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : schools.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma escola cadastrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>INEP</TableHead>
                  {isAdmin && <TableHead className="w-24">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">{school.name}</TableCell>
                    <TableCell>{school.inep || '—'}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(school)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(school)}
                          >
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
            <DialogTitle>{editingSchool ? 'Editar Escola' : 'Nova Escola'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Escola</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome completo da escola"
              />
            </div>
            <div className="space-y-2">
              <Label>Código INEP (opcional)</Label>
              <Input
                value={form.inep}
                onChange={(e) => setForm({ ...form, inep: e.target.value })}
                placeholder="23XXXXXX"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>{editingSchool ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
