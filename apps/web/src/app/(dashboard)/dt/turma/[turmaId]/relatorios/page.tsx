'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, BarChart3, PieChart, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CharacterizationRow {
  student_id: string;
  student_name: string;
  birthdate: string | null;
  responsible_name: string | null;
  status: string;
  sections_json: any;
  bio_completed: boolean;
}

interface StatsData {
  label: string;
  value: number;
  percentage: number;
}

export default function RelatoriosPage() {
  const params = useParams();
  const turmaId = params.turmaId as string;

  const [classroom, setClassroom] = useState<any>(null);
  const [characterization, setCharacterization] = useState<CharacterizationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [classRes, charRes] = await Promise.all([
        supabase.from('classrooms').select('*, schools(name)').eq('id', turmaId).single(),
        supabase.from('v_classroom_characterization').select('*').eq('classroom_id', turmaId),
      ]);

      setClassroom(classRes.data);
      setCharacterization((charRes.data as CharacterizationRow[]) ?? []);
      setLoading(false);
    }
    load();
  }, [turmaId]);

  function getFieldStats(sectionId: string, fieldId: string): StatsData[] {
    const counts: Record<string, number> = {};
    let total = 0;

    characterization.forEach((row) => {
      const sections = row.sections_json ?? {};
      const value = sections[sectionId]?.[fieldId] ?? '';
      if (value) {
        const normalized = value.toString().trim();
        if (normalized) {
          counts[normalized] = (counts[normalized] || 0) + 1;
          total++;
        }
      }
    });

    return Object.entries(counts)
      .map(([label, value]) => ({
        label,
        value,
        percentage: total > 0 ? Math.round((value / total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }

  function getDisciplineStats(field: string): StatsData[] {
    return getFieldStats('vida_escolar', field);
  }

  function getGeneralStats(): { bio_completed: number; bio_pending: number; total: number } {
    const total = characterization.length;
    const bio_completed = characterization.filter((r) => r.bio_completed).length;
    return { total, bio_completed, bio_pending: total - bio_completed };
  }

  function exportCharacterizationPDF() {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text('Ficha de Caracterização da Turma', 14, 15);
    doc.setFontSize(9);
    doc.text(
      `${classroom?.schools?.name} — ${classroom?.year_grade} ${classroom?.label} (${classroom?.shift})`,
      14,
      21
    );

    const headers = ['Nome', 'Nascimento', 'Responsável', 'Moradia', 'Disc. Preferida', 'Disc. Dificuldade', 'Ficha'];
    const body = characterization.map((r) => {
      const s = r.sections_json ?? {};
      return [
        r.student_name,
        r.birthdate ? new Date(r.birthdate).toLocaleDateString('pt-BR') : '—',
        r.responsible_name ?? '—',
        s.familia?.tipo_moradia ?? '—',
        s.vida_escolar?.disciplina_preferida ?? '—',
        s.vida_escolar?.disciplina_dificuldade ?? '—',
        r.bio_completed ? 'Completa' : 'Pendente',
      ];
    });

    autoTable(doc, {
      head: [headers],
      body,
      startY: 25,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [34, 139, 34] },
    });

    doc.save(`caracterizacao_${classroom?.year_grade}_${classroom?.label}.pdf`);
  }

  function exportStatsPDF() {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text('Dados Estatísticos da Turma', 14, 15);
    doc.setFontSize(9);
    doc.text(
      `${classroom?.schools?.name} — ${classroom?.year_grade} ${classroom?.label}`,
      14,
      21
    );

    let y = 30;
    const stats = getGeneralStats();

    doc.setFontSize(11);
    doc.text('Resumo Geral', 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.text(`Total de alunos: ${stats.total}`, 14, y);
    y += 5;
    doc.text(`Fichas completas: ${stats.bio_completed} (${Math.round((stats.bio_completed / Math.max(stats.total, 1)) * 100)}%)`, 14, y);
    y += 5;
    doc.text(`Fichas pendentes: ${stats.bio_pending}`, 14, y);
    y += 10;

    const sections = [
      { title: 'Disciplinas Preferidas', data: getDisciplineStats('disciplina_preferida') },
      { title: 'Disciplinas com Dificuldade', data: getDisciplineStats('disciplina_dificuldade') },
      { title: 'Tipo de Moradia', data: getFieldStats('familia', 'tipo_moradia') },
      { title: 'Deslocamento', data: getFieldStats('vida_escolar', 'deslocamento') },
    ];

    for (const section of sections) {
      if (y > 260) {
        doc.addPage();
        y = 15;
      }

      doc.setFontSize(11);
      doc.text(section.title, 14, y);
      y += 4;

      if (section.data.length > 0) {
        autoTable(doc, {
          head: [['Resposta', 'Qtd', '%']],
          body: section.data.map((d) => [d.label, d.value.toString(), `${d.percentage}%`]),
          startY: y,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [34, 139, 34] },
          margin: { left: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      } else {
        doc.setFontSize(8);
        doc.text('Sem dados', 14, y + 4);
        y += 10;
      }
    }

    doc.save(`estatisticas_${classroom?.year_grade}_${classroom?.label}.pdf`);
  }

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Carregando relatórios...</div>;
  }

  const generalStats = getGeneralStats();
  const discPreferidas = getDisciplineStats('disciplina_preferida');
  const discDificuldade = getDisciplineStats('disciplina_dificuldade');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios da Turma</h1>
          <p className="text-muted-foreground">
            {classroom?.schools?.name} — {classroom?.year_grade} {classroom?.label}
          </p>
        </div>
      </div>

      <Tabs defaultValue="caracterizacao">
        <TabsList>
          <TabsTrigger value="caracterizacao">
            <FileText className="mr-2 h-4 w-4" />
            Caracterização
          </TabsTrigger>
          <TabsTrigger value="estatisticas">
            <BarChart3 className="mr-2 h-4 w-4" />
            Dados Estatísticos
          </TabsTrigger>
          <TabsTrigger value="disciplinas">
            <PieChart className="mr-2 h-4 w-4" />
            Por Disciplina
          </TabsTrigger>
        </TabsList>

        {/* Caracterização da Turma */}
        <TabsContent value="caracterizacao">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Ficha de Caracterização da Turma</CardTitle>
              <Button variant="outline" size="sm" onClick={exportCharacterizationPDF}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Nascimento</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Moradia</TableHead>
                      <TableHead>Disc. Preferida</TableHead>
                      <TableHead>Disc. Dificuldade</TableHead>
                      <TableHead>Ficha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {characterization.map((r) => {
                      const s = r.sections_json ?? {};
                      return (
                        <TableRow key={r.student_id}>
                          <TableCell className="font-medium">{r.student_name}</TableCell>
                          <TableCell>
                            {r.birthdate
                              ? new Date(r.birthdate).toLocaleDateString('pt-BR')
                              : '—'}
                          </TableCell>
                          <TableCell>{r.responsible_name ?? '—'}</TableCell>
                          <TableCell>{s.familia?.tipo_moradia ?? '—'}</TableCell>
                          <TableCell>{s.vida_escolar?.disciplina_preferida ?? '—'}</TableCell>
                          <TableCell>{s.vida_escolar?.disciplina_dificuldade ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant={r.bio_completed ? 'success' : 'warning'}>
                              {r.bio_completed ? 'OK' : 'Pend.'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dados Estatísticos */}
        <TabsContent value="estatisticas">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={exportStatsPDF}>
                <Download className="mr-2 h-4 w-4" />
                PDF Completo
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold">{generalStats.total}</div>
                  <p className="text-sm text-muted-foreground">Total de Alunos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {generalStats.bio_completed}
                  </div>
                  <p className="text-sm text-muted-foreground">Fichas Completas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-yellow-600">
                    {generalStats.bio_pending}
                  </div>
                  <p className="text-sm text-muted-foreground">Fichas Pendentes</p>
                </CardContent>
              </Card>
            </div>

            {/* Bar charts simples via CSS */}
            {[
              { title: 'Tipo de Moradia', data: getFieldStats('familia', 'tipo_moradia') },
              { title: 'Deslocamento para Escola', data: getFieldStats('vida_escolar', 'deslocamento') },
              { title: 'Renda Familiar', data: getFieldStats('familia', 'renda_familiar') },
            ].map((chart) => (
              <Card key={chart.title}>
                <CardHeader>
                  <CardTitle className="text-base">{chart.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {chart.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados preenchidos.</p>
                  ) : (
                    <div className="space-y-3">
                      {chart.data.map((item) => (
                        <div key={item.label}>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{item.label}</span>
                            <span className="text-muted-foreground">
                              {item.value} ({item.percentage}%)
                            </span>
                          </div>
                          <div className="h-4 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Relatório por Disciplina */}
        <TabsContent value="disciplinas">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-green-600">★</span> Disciplinas Preferidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {discPreferidas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados.</p>
                ) : (
                  <div className="space-y-3">
                    {discPreferidas.map((item, idx) => (
                      <div key={item.label} className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-6">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{item.label}</span>
                            <span>{item.value} ({item.percentage}%)</span>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-red-500">!</span> Disciplinas com Dificuldade
                </CardTitle>
              </CardHeader>
              <CardContent>
                {discDificuldade.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados.</p>
                ) : (
                  <div className="space-y-3">
                    {discDificuldade.map((item, idx) => (
                      <div key={item.label} className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-6">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{item.label}</span>
                            <span>{item.value} ({item.percentage}%)</span>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-500 rounded-full"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
