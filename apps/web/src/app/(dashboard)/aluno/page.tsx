'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Lock, Unlock } from 'lucide-react';
import Link from 'next/link';

export default function AlunoDashboardPage() {
  const { profile } = useAuth();
  const [student, setStudent] = useState<any>(null);
  const [bioForm, setBioForm] = useState<any>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.student_id) {
      setLoading(false);
      return;
    }

    async function load() {
      const [studentRes, bioRes] = await Promise.all([
        supabase.from('students').select('*, classrooms(year_grade, label, school_id), classrooms!inner(schools!inner(name))').eq('id', profile!.student_id).single(),
        supabase.from('bio_forms').select('completed, updated_at').eq('student_id', profile!.student_id).maybeSingle(),
      ]);

      setStudent(studentRes.data);
      setBioForm(bioRes.data);

      // Verificar se a ficha está liberada
      if (studentRes.data?.classroom_id) {
        const { data: lockData } = await supabase
          .from('access_locks')
          .select('bio_form_locked')
          .eq('classroom_id', studentRes.data.classroom_id)
          .maybeSingle();
        setIsUnlocked(lockData ? !lockData.bio_form_locked : false);
      }

      setLoading(false);
    }

    load();
  }, [profile]);

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Carregando...</div>;
  }

  if (!profile?.student_id) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-destructive">Vínculo não encontrado</h1>
        <p className="text-muted-foreground">
          Seu perfil de aluno ainda não está vinculado a um registro de estudante.
          Entre em contato com o Diretor de Turma ou Administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Minha Área</h1>
        <p className="text-muted-foreground">Bem-vindo(a), {student?.name ?? profile.full_name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Info do aluno */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Meus Dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>Nome:</strong> {student?.name}</p>
            <p><strong>Matrícula:</strong> {student?.enrollment_code ?? '—'}</p>
            <p>
              <strong>Status:</strong>{' '}
              <Badge variant={student?.status === 'Ativo' ? 'success' : 'secondary'}>
                {student?.status}
              </Badge>
            </p>
          </CardContent>
        </Card>

        {/* Ficha Biográfica */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ficha Biográfica</CardTitle>
            {isUnlocked ? (
              <Badge variant="success" className="gap-1">
                <Unlock className="h-3 w-3" /> Liberada
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" /> Bloqueada
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {bioForm?.completed
                ? 'Sua ficha biográfica foi preenchida.'
                : isUnlocked
                ? 'A ficha está liberada para preenchimento.'
                : 'Aguarde o Diretor de Turma liberar o preenchimento.'}
            </p>
            {isUnlocked && (
              <Link href={`/aluno/ficha-biografica`}>
                <Button size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  {bioForm?.completed ? 'Revisar Ficha' : 'Preencher Ficha'}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
