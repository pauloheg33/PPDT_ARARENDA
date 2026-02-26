'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Lock, Unlock, AlertTriangle } from 'lucide-react';

export default function LiberacaoPage() {
  const params = useParams();
  const turmaId = params.turmaId as string;
  const { user } = useAuth();
  const [locked, setLocked] = useState(true);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [classroom, setClassroom] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const [lockRes, classRes] = await Promise.all([
        supabase.from('access_locks').select('*').eq('classroom_id', turmaId).single(),
        supabase.from('classrooms').select('*, schools(name)').eq('id', turmaId).single(),
      ]);

      setLocked(lockRes.data?.bio_form_locked ?? true);
      setClassroom(classRes.data);
      setLoading(false);
    }
    load();
  }, [turmaId]);

  async function toggleLock() {
    const newState = !locked;
    const { error } = await supabase
      .from('access_locks')
      .upsert({
        classroom_id: turmaId,
        bio_form_locked: newState,
        locked_at: new Date().toISOString(),
        locked_by: user?.id,
      });

    if (!error) {
      setLocked(newState);
      await logAudit(newState ? 'LOCK' : 'UNLOCK', 'access_locks', turmaId, {
        bio_form_locked: newState,
      });
    }
    setConfirmOpen(false);
  }

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Liberar/Bloquear Ficha Biográfica</h1>
        <p className="text-muted-foreground">
          {classroom?.schools?.name} — {classroom?.year_grade} {classroom?.label} ({classroom?.shift})
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {locked ? (
              <>
                <Lock className="h-6 w-6 text-red-500" />
                Acesso Bloqueado
              </>
            ) : (
              <>
                <Unlock className="h-6 w-6 text-green-500" />
                Acesso Liberado
              </>
            )}
          </CardTitle>
          <CardDescription>
            {locked
              ? 'Os alunos desta turma NÃO podem visualizar nem preencher a Ficha Biográfica.'
              : 'Os alunos desta turma PODEM visualizar e preencher a Ficha Biográfica.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge
              variant={locked ? 'destructive' : 'success'}
              className="text-base px-4 py-1"
            >
              {locked ? '🔒 Bloqueado' : '🔓 Liberado'}
            </Badge>
            <Button
              variant={locked ? 'default' : 'destructive'}
              onClick={() => setConfirmOpen(true)}
            >
              {locked ? (
                <>
                  <Unlock className="mr-2 h-4 w-4" />
                  Liberar Acesso
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Bloquear Acesso
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como funciona?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Bloqueado:</strong> Os alunos não conseguem acessar o formulário da Ficha
            Biográfica. Apenas o DT e administradores podem visualizar.
          </p>
          <p>
            <strong>Liberado:</strong> Os alunos podem acessar, preencher e visualizar a Ficha
            Biográfica.
          </p>
          <p>
            O DT pode alternar entre os estados a qualquer momento. Toda alteração é registrada na
            auditoria do sistema.
          </p>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirmar Ação
            </DialogTitle>
            <DialogDescription>
              {locked
                ? 'Você está prestes a LIBERAR o acesso da turma à Ficha Biográfica. Os alunos poderão preencher seus dados.'
                : 'Você está prestes a BLOQUEAR o acesso da turma à Ficha Biográfica. Os alunos não poderão mais editar.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant={locked ? 'default' : 'destructive'}
              onClick={toggleLock}
            >
              {locked ? 'Confirmar Liberação' : 'Confirmar Bloqueio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
