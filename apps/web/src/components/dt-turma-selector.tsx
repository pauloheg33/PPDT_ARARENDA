'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { logAudit } from '@/lib/audit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { School, BookOpen, CheckCircle, AlertTriangle } from 'lucide-react';

interface SchoolOption {
  id: string;
  name: string;
  inep: string | null;
}

interface ClassroomOption {
  id: string;
  school_id: string;
  year_grade: string;
  label: string;
  shift: string;
  dt_user_id: string | null;
}

export function DtTurmaSelector() {
  const { user, profile, refreshProfile } = useAuth();
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadSchools() {
      const { data } = await supabase
        .from('schools')
        .select('id, name, inep')
        .order('name');
      setSchools(data ?? []);
    }
    loadSchools();
  }, []);

  useEffect(() => {
    if (!selectedSchool) {
      setClassrooms([]);
      setSelectedClassroom('');
      return;
    }
    async function loadClassrooms() {
      const { data } = await supabase
        .from('classrooms')
        .select('id, school_id, year_grade, label, shift, dt_user_id')
        .eq('school_id', selectedSchool)
        .order('year_grade')
        .order('label');
      setClassrooms(data ?? []);
      setSelectedClassroom('');
    }
    loadClassrooms();
  }, [selectedSchool]);

  async function handleConfirm() {
    if (!selectedSchool || !selectedClassroom || !user) return;

    // Segurança: impedir re-atribuição se já tem turma
    if (profile?.classroom_id) {
      setError('Você já possui uma turma atribuída.');
      return;
    }

    const classroom = classrooms.find((c) => c.id === selectedClassroom);
    if (!classroom) return;

    if (classroom.dt_user_id && classroom.dt_user_id !== user.id) {
      setError('Esta turma já foi escolhida por outro professor.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // 1. Verificar novamente no banco se a turma ainda está livre (race condition)
      const { data: freshClassroom } = await supabase
        .from('classrooms')
        .select('dt_user_id')
        .eq('id', selectedClassroom)
        .single();

      if (freshClassroom?.dt_user_id && freshClassroom.dt_user_id !== user.id) {
        setError('Esta turma acabou de ser escolhida por outro professor. Selecione outra.');
        setSaving(false);
        return;
      }

      // 2. Atualizar o perfil do DT com school_id e classroom_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          school_id: selectedSchool,
          classroom_id: selectedClassroom,
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      // 3. Vincular o DT à turma
      const { error: classroomError } = await supabase
        .from('classrooms')
        .update({ dt_user_id: user.id })
        .eq('id', selectedClassroom);

      if (classroomError) throw classroomError;

      // 4. Registrar no audit log
      await logAudit('UPDATE', 'classrooms', selectedClassroom, {
        action: 'dt_self_assignment',
        school_id: selectedSchool,
        classroom_id: selectedClassroom,
      });

      // 5. Recarregar perfil
      await refreshProfile();
    } catch (err: any) {
      console.error('Erro ao vincular turma:', err);
      setError(err.message || 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  const selectedClassroomData = classrooms.find((c) => c.id === selectedClassroom);
  const isTaken =
    selectedClassroomData?.dt_user_id != null &&
    selectedClassroomData.dt_user_id !== user?.id;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <School className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Escolha sua Turma</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione a escola e a turma onde você atua como Diretor de Turma.
            <br />
            <span className="font-medium text-yellow-600">
              Atenção: esta escolha é definitiva.
            </span>
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Escola */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <School className="h-4 w-4" />
              Escola
            </Label>
            <Select value={selectedSchool} onValueChange={setSelectedSchool}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a escola..." />
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

          {/* Turma */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Turma
            </Label>
            <Select
              value={selectedClassroom}
              onValueChange={setSelectedClassroom}
              disabled={!selectedSchool}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    selectedSchool ? 'Selecione a turma...' : 'Selecione uma escola primeiro'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {classrooms.map((c) => {
                  const taken = c.dt_user_id != null && c.dt_user_id !== user?.id;
                  return (
                    <SelectItem key={c.id} value={c.id} disabled={taken}>
                      {c.year_grade} — Turma {c.label} ({c.shift})
                      {taken ? ' ⛔ Já atribuída' : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {selectedClassroomData && !isTaken && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="font-medium">
                  {schools.find((s) => s.id === selectedSchool)?.name}
                </span>
              </div>
              <p className="ml-6 text-sm text-muted-foreground">
                {selectedClassroomData.year_grade} — Turma {selectedClassroomData.label} (
                {selectedClassroomData.shift})
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Confirm */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleConfirm}
            disabled={!selectedSchool || !selectedClassroom || isTaken || saving}
          >
            {saving ? 'Salvando...' : 'Confirmar Minha Turma'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
