'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  School,
  Users,
  BookOpen,
  CheckCircle,
  AlertCircle,
  Camera,
  FileText,
  MapPin,
  Unlock,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

interface Stats {
  totalSchools: number;
  totalClassrooms: number;
  totalStudents: number;
  bioCompleted: number;
  bioPending: number;
  photosUploaded: number;
  photosMissing: number;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalSchools: 0,
    totalClassrooms: 0,
    totalStudents: 0,
    bioCompleted: 0,
    bioPending: 0,
    photosUploaded: 0,
    photosMissing: 0,
  });
  const [classroomStats, setClassroomStats] = useState<any[]>([]);
  const [dtStudents, setDtStudents] = useState<any[]>([]);
  const [lockStatus, setLockStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const role = profile?.role;
        const schoolId = profile?.school_id;
        const classroomId = profile?.classroom_id;

        // Role-filtered queries — RLS also enforces, but we optimize here
        let schoolsQuery = supabase.from('schools').select('id', { count: 'exact', head: true });
        let classroomsQuery = supabase.from('classrooms').select('id', { count: 'exact', head: true });
        let studentsQuery = supabase.from('students').select('id', { count: 'exact', head: true });
        let statsQuery = supabase.from('v_classroom_stats').select('*');

        if (role === 'GESTOR_ESCOLA' && schoolId) {
          schoolsQuery = schoolsQuery.eq('id', schoolId);
          classroomsQuery = classroomsQuery.eq('school_id', schoolId);
          studentsQuery = studentsQuery.eq('school_id', schoolId);
          statsQuery = statsQuery.eq('school_id', schoolId);
        } else if (role === 'DT' && classroomId) {
          classroomsQuery = classroomsQuery.eq('id', classroomId);
          studentsQuery = studentsQuery.eq('classroom_id', classroomId);
          statsQuery = statsQuery.eq('classroom_id', classroomId);
        }

        const [schoolsRes, classroomsRes, studentsRes, statsRes] = await Promise.all([
          schoolsQuery,
          classroomsQuery,
          studentsQuery,
          statsQuery,
        ]);

        const csData = statsRes.data ?? [];
        setClassroomStats(csData);

        setStats({
          totalSchools: schoolsRes.count ?? 0,
          totalClassrooms: classroomsRes.count ?? 0,
          totalStudents: studentsRes.count ?? 0,
          bioCompleted: csData.reduce((s: number, r: any) => s + (r.bio_completed || 0), 0),
          bioPending: csData.reduce((s: number, r: any) => s + (r.bio_pending || 0), 0),
          photosUploaded: csData.reduce((s: number, r: any) => s + (r.photos_uploaded || 0), 0),
          photosMissing: csData.reduce((s: number, r: any) => s + (r.photos_missing || 0), 0),
        });

        // DT-specific: load students list and lock status for quick actions
        if (role === 'DT' && classroomId) {
          const [studentsListRes, lockRes] = await Promise.all([
            supabase
              .from('students')
              .select('id, name, enrollment_code')
              .eq('classroom_id', classroomId)
              .eq('status', 'ATIVO')
              .order('name'),
            supabase
              .from('access_locks')
              .select('*')
              .eq('classroom_id', classroomId)
              .single(),
          ]);
          setDtStudents(studentsListRes.data ?? []);
          setLockStatus(lockRes.data);
        }
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    if (profile) fetchStats();
  }, [profile]);

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Carregando dashboard...</div>;
  }

  const role = profile?.role;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          {role === 'ADMIN_SME' || role === 'COORD_PPDT'
            ? 'Visão geral da rede municipal'
            : role === 'GESTOR_ESCOLA'
            ? 'Visão geral da escola'
            : 'Visão da turma'}
        </p>
      </div>

      {/* Cards resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {(role === 'ADMIN_SME' || role === 'COORD_PPDT') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Escolas</CardTitle>
              <School className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSchools}</div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Turmas</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClassrooms}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alunos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fichas Completas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.bioCompleted}</div>
            <p className="text-xs text-muted-foreground">
              {stats.bioPending} pendente(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pendências */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Fichas Biográficas Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.bioPending === 0 ? (
              <p className="text-sm text-muted-foreground">Todas as fichas estão completas!</p>
            ) : (
              <p className="text-sm">
                <span className="font-bold text-yellow-600">{stats.bioPending}</span> aluno(s) sem
                ficha biográfica completa.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Camera className="h-5 w-5 text-blue-500" />
              Fotos Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.photosMissing === 0 ? (
              <p className="text-sm text-muted-foreground">Todos os alunos possuem foto!</p>
            ) : (
              <p className="text-sm">
                <span className="font-bold text-blue-600">{stats.photosMissing}</span> aluno(s) sem
                foto cadastrada.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DT Quick Actions */}
      {role === 'DT' && profile?.classroom_id && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Ações Rápidas — Minha Turma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Link href={`/dt/liberacao?turmaId=${profile.classroom_id}`}>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Unlock className="h-4 w-4" />
                  Liberação de Fichas
                  {lockStatus && (
                    <Badge variant={lockStatus.bio_form_locked ? 'destructive' : 'success'} className="ml-auto">
                      {lockStatus.bio_form_locked ? 'Bloq.' : 'Liber.'}
                    </Badge>
                  )}
                </Button>
              </Link>
              <Link href={`/dt/registro-fotografico?turmaId=${profile.classroom_id}`}>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Camera className="h-4 w-4" />
                  Registro Fotográfico
                </Button>
              </Link>
              <Link href={`/dt/mapeamento-sala?turmaId=${profile.classroom_id}`}>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <MapPin className="h-4 w-4" />
                  Mapeamento de Sala
                </Button>
              </Link>
              <Link href={`/dt/relatorios?turmaId=${profile.classroom_id}`}>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <FileText className="h-4 w-4" />
                  Relatórios
                </Button>
              </Link>
            </div>

            {/* DT pending students */}
            {dtStudents.length > 0 && stats.bioPending > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2">Alunos com ficha pendente:</h4>
                <div className="flex flex-wrap gap-2">
                  {dtStudents.slice(0, 10).map((s) => (
                    <Link
                      key={s.id}
                      href={`/dt/ficha-biografica?turmaId=${profile.classroom_id}&alunoId=${s.id}`}
                    >
                      <Badge variant="outline" className="cursor-pointer hover:bg-primary/10">
                        {s.name.split(' ')[0]}
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Badge>
                    </Link>
                  ))}
                  {dtStudents.length > 10 && (
                    <Badge variant="secondary">+{dtStudents.length - 10} mais</Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabela por turma */}
      {classroomStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Estatísticas por Turma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2">Turma</th>
                    <th className="p-2">Turno</th>
                    <th className="p-2 text-center">Alunos</th>
                    <th className="p-2 text-center">Fichas OK</th>
                    <th className="p-2 text-center">Fichas Pend.</th>
                    <th className="p-2 text-center">Fotos</th>
                    <th className="p-2 text-center">Progresso</th>
                  </tr>
                </thead>
                <tbody>
                  {classroomStats.map((cs: any) => {
                    const pct =
                      cs.total_students > 0
                        ? Math.round((cs.bio_completed / cs.total_students) * 100)
                        : 0;
                    return (
                      <tr key={cs.classroom_id} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">
                          {cs.year_grade} {cs.label}
                        </td>
                        <td className="p-2">{cs.shift}</td>
                        <td className="p-2 text-center">{cs.total_students}</td>
                        <td className="p-2 text-center">
                          <Badge variant="success">{cs.bio_completed}</Badge>
                        </td>
                        <td className="p-2 text-center">
                          {cs.bio_pending > 0 ? (
                            <Badge variant="warning">{cs.bio_pending}</Badge>
                          ) : (
                            <Badge variant="success">0</Badge>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {cs.photos_uploaded}/{cs.total_students}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
