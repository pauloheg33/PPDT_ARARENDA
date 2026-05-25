'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  School,
  Users,
  BookOpen,
  CheckCircle,
  Camera,
  FileText,
  MapPin,
  ArrowRight,
  Library,
} from 'lucide-react';
import Link from 'next/link';
import { DtTurmaSelector } from '@/components/dt-turma-selector';
import { ROLE_LABELS, type Role } from '@/lib/roles';

interface Stats {
  totalSchools: number;
  totalClassrooms: number;
  totalStudents: number;
  bioCompleted: number;
  bioPending: number;
  photosUploaded: number;
  photosMissing: number;
}

interface DtBioStudent {
  id: string;
  name: string;
  enrollment_code: string | null;
  bioCompleted: boolean;
}

export default function DashboardPage() {
  const { profile, user, signOut } = useAuth();
  const router = useRouter();

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
  const [dtBioStudents, setDtBioStudents] = useState<DtBioStudent[]>([]);
  const [dtPendingPhotos, setDtPendingPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const role = profile?.role;
        const schoolId = profile?.school_id;
        const classroomId = profile?.classroom_id;

        let schoolsQuery = supabase.from('schools').select('id', { count: 'exact', head: true });
        let classroomsQuery = supabase.from('classrooms').select('id', { count: 'exact', head: true });
        let studentsQuery = supabase.from('students').select('id', { count: 'exact', head: true });
        let statsQuery = supabase.from('v_classroom_stats').select('*');

        if ((role === 'GESTOR_ESCOLA' || role === 'COORD_PPDT') && schoolId) {
          schoolsQuery = schoolsQuery.eq('id', schoolId);
          classroomsQuery = classroomsQuery.eq('school_id', schoolId);
          studentsQuery = studentsQuery.eq('school_id', schoolId);
          statsQuery = statsQuery.eq('school_id', schoolId);
        } else if (role === 'DT' && classroomId) {
          classroomsQuery = classroomsQuery.eq('id', classroomId);
          studentsQuery = studentsQuery.eq('classroom_id', classroomId).eq('status', 'Ativo');
          statsQuery = statsQuery.eq('classroom_id', classroomId);
        }

        const [schoolsRes, classroomsRes, studentsRes, statsRes] = await Promise.all([
          schoolsQuery,
          classroomsQuery,
          studentsQuery,
          statsQuery,
        ]);

        const csData = (statsRes.data ?? []).sort((a: any, b: any) => {
          const schoolCmp = (a.school_name ?? '').localeCompare(b.school_name ?? '', 'pt-BR');
          if (schoolCmp !== 0) return schoolCmp;
          const yearA = parseInt(a.year_grade) || 0;
          const yearB = parseInt(b.year_grade) || 0;
          if (yearA !== yearB) return yearA - yearB;
          return (a.label ?? '').localeCompare(b.label ?? '', 'pt-BR');
        });
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

        if (role === 'DT' && classroomId) {
          // 1. Buscar alunos da turma com status das fichas
          const studentsListRes = await supabase
            .from('students')
            .select('id, name, enrollment_code, bio_forms(completed)')
            .eq('classroom_id', classroomId)
            .eq('status', 'Ativo')
            .order('name');

          const allStudents = studentsListRes.data ?? [];
          const studentIds = allStudents.map((s: any) => s.id);

          // 2. Buscar fotos pelos IDs dos alunos (student_photos não tem classroom_id)
          let withPhoto = new Set<string>();
          if (studentIds.length > 0) {
            const photosRes = await supabase
              .from('student_photos')
              .select('student_id')
              .in('student_id', studentIds);
            withPhoto = new Set((photosRes.data ?? []).map((p: any) => p.student_id));
          }

          setDtBioStudents(
            allStudents.map((s: any) => ({
              id: s.id,
              name: s.name,
              enrollment_code: s.enrollment_code ?? null,
              bioCompleted: Boolean(s.bio_forms?.[0]?.completed),
            }))
          );
          setDtPendingPhotos(allStudents.filter((s: any) => !withPhoto.has(s.id)));
        }
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    if (profile) {
      fetchStats();
    } else if (profile === null) {
      setLoading(false);
    }
  }, [profile]);

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Carregando dashboard...</div>;
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-destructive">Perfil não encontrado</h1>
        <p className="text-muted-foreground">
          Seu usuário não possui um registro na tabela <code>profiles</code>.<br />
          Peça ao administrador para criar seu perfil ou execute no SQL Editor do Supabase:
        </p>
        <pre className="rounded bg-muted p-4 text-sm overflow-auto">
{`INSERT INTO public.profiles (user_id, role, full_name)
VALUES ('${user?.id ?? 'SEU_USER_ID'}', 'ADMIN_SME', 'Seu Nome');`}
        </pre>
        <Button
          variant="outline"
          onClick={async () => {
            await signOut();
            router.replace('/login');
          }}
        >
          Voltar ao Login
        </Button>
      </div>
    );
  }

  const role = profile.role as Role;

  if (role === 'DT' && !profile.classroom_id) {
    return <DtTurmaSelector />;
  }

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = profile.full_name;

  const bioPct = stats.totalStudents > 0
    ? Math.round((stats.bioCompleted / stats.totalStudents) * 100)
    : 0;
  const photoPct = stats.totalStudents > 0
    ? Math.round((stats.photosUploaded / stats.totalStudents) * 100)
    : 0;

  const dtClassroom = classroomStats[0];
  const dtSubtitle = role === 'DT' && dtClassroom
    ? `${dtClassroom.year_grade} ${dtClassroom.label} · ${dtClassroom.school_name}`
    : null;

  const escolaScopedName = (role === 'GESTOR_ESCOLA' || role === 'COORD_PPDT') && classroomStats[0]?.school_name
    ? classroomStats[0].school_name
    : null;

  return (
    <div className="space-y-6">

      {/* Saudação */}
      <div>
        <h1 className="text-3xl font-bold">{saudacao}, {primeiroNome}!</h1>
        <p className="text-muted-foreground">
          {role === 'DT' && dtSubtitle
            ? `Professor Diretor de Turma — ${dtSubtitle}`
            : role === 'GESTOR_ESCOLA' && escolaScopedName
            ? `Gestor Escolar — ${escolaScopedName}`
            : role === 'COORD_PPDT' && escolaScopedName
            ? `Coordenação Escolar — ${escolaScopedName}`
            : ROLE_LABELS[role]}
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        {role === 'ADMIN_SME' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Escolas</CardTitle>
              <School className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSchools}</div>
              <p className="text-xs text-muted-foreground">na rede municipal</p>
            </CardContent>
          </Card>
        )}

        {role !== 'DT' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Turmas</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClassrooms}</div>
              <p className="text-xs text-muted-foreground">
                {role === 'GESTOR_ESCOLA' || role === 'COORD_PPDT' ? 'na escola' : 'na rede'}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alunos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
            <p className="text-xs text-muted-foreground">
              {role === 'DT' ? 'na turma' : role === 'GESTOR_ESCOLA' || role === 'COORD_PPDT' ? 'na escola' : 'matriculados'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fichas Biográficas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.bioCompleted}
              <span className="text-base font-normal text-muted-foreground">/{stats.totalStudents}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {bioPct}% concluídas · {stats.bioPending} pendente(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fotos Cadastradas</CardTitle>
            <Camera className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.photosUploaded}
              <span className="text-base font-normal text-muted-foreground">/{stats.totalStudents}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {photoPct}% com foto · {stats.photosMissing} sem foto
            </p>
          </CardContent>
        </Card>

      </div>

      {/* DT: Acesso rápido (sem liberação) */}
      {role === 'DT' && profile.classroom_id && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <Link href="/dt/instrumentais">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Library className="h-4 w-4" />
                  Instrumentais
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DT: Pendências por aluno */}
      {role === 'DT' && (
        <div className="grid gap-4 md:grid-cols-2">

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle className="h-4 w-4 text-yellow-500" />
                Ficha Biográfica
                <Badge
                  variant="outline"
                  className="ml-auto"
                >
                  {dtBioStudents.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dtBioStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum aluno ativo encontrado na turma.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aluno</TableHead>
                        <TableHead>Status da ficha</TableHead>
                        <TableHead>Matrícula</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dtBioStudents.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm font-medium">{s.name}</TableCell>
                          <TableCell>
                            <Badge variant={s.bioCompleted ? 'success' : 'warning'}>
                              {s.bioCompleted ? 'Completa' : 'Pendente'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {s.enrollment_code ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/dt/ficha-biografica?turmaId=${profile.classroom_id}&alunoId=${s.id}`}
                            >
                              <ArrowRight className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="h-4 w-4 text-blue-500" />
                Fotos Pendentes
                <Badge
                  variant={dtPendingPhotos.length === 0 ? 'success' : 'warning'}
                  className="ml-auto"
                >
                  {dtPendingPhotos.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dtPendingPhotos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todos os alunos têm foto cadastrada!</p>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aluno</TableHead>
                        <TableHead>Matrícula</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dtPendingPhotos.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm font-medium">{s.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {s.enrollment_code ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/dt/registro-fotografico?turmaId=${profile.classroom_id}`}
                            >
                              <ArrowRight className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      )}

      {/* Tabela por turma */}
      {classroomStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {role === 'DT' ? 'Resumo da Turma' : 'Acompanhamento por Turma'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    {role === 'ADMIN_SME' && (
                      <th className="p-2 font-medium">Escola</th>
                    )}
                    <th className="p-2 font-medium">Turma</th>
                    <th className="p-2 font-medium">Turno</th>
                    <th className="p-2 font-medium text-center">Alunos</th>
                    <th className="p-2 font-medium text-center">Fichas OK</th>
                    <th className="p-2 font-medium text-center">Pendentes</th>
                    <th className="p-2 font-medium text-center">Fotos</th>
                    <th className="p-2 font-medium text-center">Progresso</th>
                  </tr>
                </thead>
                <tbody>
                  {classroomStats.map((cs: any) => {
                    const rowBioPct = cs.total_students > 0
                      ? Math.round((cs.bio_completed / cs.total_students) * 100)
                      : 0;
                    const rowPhotoPct = cs.total_students > 0
                      ? Math.round((cs.photos_uploaded / cs.total_students) * 100)
                      : 0;
                    return (
                      <tr key={cs.classroom_id} className="border-b hover:bg-muted/50">
                        {role === 'ADMIN_SME' && (
                          <td className="p-2 text-muted-foreground">{cs.school_name ?? '—'}</td>
                        )}
                        <td className="p-2 font-medium">{cs.year_grade} {cs.label}</td>
                        <td className="p-2 text-muted-foreground">{cs.shift}</td>
                        <td className="p-2 text-center">{cs.total_students}</td>
                        <td className="p-2 text-center">
                          <Badge variant="success">{cs.bio_completed}</Badge>
                        </td>
                        <td className="p-2 text-center">
                          {cs.bio_pending > 0
                            ? <Badge variant="warning">{cs.bio_pending}</Badge>
                            : <Badge variant="success">0</Badge>
                          }
                        </td>
                        <td className="p-2 text-center">
                          <span className={rowPhotoPct === 100 ? 'text-green-600 font-medium' : ''}>
                            {cs.photos_uploaded}/{cs.total_students}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({rowPhotoPct}%)
                          </span>
                        </td>
                        <td className="p-2 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${rowBioPct}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 text-right">
                              {rowBioPct}%
                            </span>
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
