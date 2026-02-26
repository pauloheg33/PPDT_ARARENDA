'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface ParsedRow {
  nome: string;
  matricula?: string;
  nascimento?: string;
  responsavel?: string;
  telefone?: string;
}

interface ImportResult {
  inserted: number;
  updated: number;
  errors: string[];
}

export default function ImportarPage() {
  const [schools, setSchools] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    async function load() {
      const [s, c] = await Promise.all([
        supabase.from('schools').select('id, name').order('name'),
        supabase.from('classrooms').select('id, school_id, year_grade, label').order('year_grade'),
      ]);
      setSchools(s.data ?? []);
      setClassrooms(c.data ?? []);
    }
    load();
  }, []);

  const filteredClassrooms = selectedSchool
    ? classrooms.filter((c: any) => c.school_id === selectedSchool)
    : classrooms;

  function normalizeHeaders(headers: string[]): Record<string, string> {
    const map: Record<string, string> = {};
    const mappings: Record<string, string[]> = {
      nome: ['nome', 'name', 'aluno', 'nome_aluno', 'nome do aluno', 'student_name'],
      matricula: ['matricula', 'enrollment', 'código', 'codigo', 'enrollment_code', 'matrícula'],
      nascimento: ['nascimento', 'birthdate', 'data_nascimento', 'data nascimento', 'dt_nasc', 'birth_date'],
      responsavel: ['responsavel', 'responsável', 'responsible', 'pai_mae', 'nome_responsavel'],
      telefone: ['telefone', 'phone', 'fone', 'cel', 'celular', 'contato'],
    };

    for (const h of headers) {
      const lower = h.toLowerCase().trim().replace(/[_\s]+/g, '_');
      for (const [field, aliases] of Object.entries(mappings)) {
        if (aliases.some((a) => lower.includes(a.replace(/\s/g, '_')))) {
          map[h] = field;
          break;
        }
      }
    }
    return map;
  }

  function parseFile(file: File) {
    setFileName(file.name);
    setResult(null);

    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields ?? [];
          const headerMap = normalizeHeaders(headers);
          const rows: ParsedRow[] = results.data.map((row: any) => {
            const mapped: any = {};
            for (const [orig, field] of Object.entries(headerMap)) {
              mapped[field] = row[orig]?.toString().trim() ?? '';
            }
            return mapped as ParsedRow;
          });
          setParsedData(rows.filter((r) => r.nome));
        },
      });
    } else {
      // XLSX
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
        if (jsonData.length > 0) {
          const headers = Object.keys(jsonData[0]);
          const headerMap = normalizeHeaders(headers);
          const rows: ParsedRow[] = jsonData.map((row) => {
            const mapped: any = {};
            for (const [orig, field] of Object.entries(headerMap)) {
              mapped[field] = row[orig]?.toString().trim() ?? '';
            }
            return mapped as ParsedRow;
          });
          setParsedData(rows.filter((r) => r.nome));
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) parseFile(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: false,
  });

  async function handleImport() {
    if (!selectedSchool || !selectedClassroom || parsedData.length === 0) return;
    setImporting(true);
    const res: ImportResult = { inserted: 0, updated: 0, errors: [] };

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];
      if (!row.nome) {
        res.errors.push(`Linha ${i + 2}: Nome vazio`);
        continue;
      }

      let birthdate: string | null = null;
      if (row.nascimento) {
        // Tentar formatos comuns
        const parts = row.nascimento.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (parts) {
          birthdate = `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        } else if (/\d{4}-\d{2}-\d{2}/.test(row.nascimento)) {
          birthdate = row.nascimento;
        }
      }

      // Verificar duplicidade
      if (row.matricula && birthdate) {
        const { data: existing } = await supabase
          .from('students')
          .select('id')
          .eq('enrollment_code', row.matricula)
          .eq('birthdate', birthdate)
          .maybeSingle();

        if (existing) {
          // Atualizar
          const { error } = await supabase
            .from('students')
            .update({
              name: row.nome,
              school_id: selectedSchool,
              classroom_id: selectedClassroom,
              responsible_name: row.responsavel || null,
              responsible_phone: row.telefone || null,
            })
            .eq('id', existing.id);

          if (error) {
            res.errors.push(`Linha ${i + 2}: Erro ao atualizar ${row.nome}: ${error.message}`);
          } else {
            res.updated++;
          }
          continue;
        }
      }

      // Inserir novo
      const { data: newStudent, error } = await supabase
        .from('students')
        .insert({
          name: row.nome,
          enrollment_code: row.matricula || null,
          birthdate,
          responsible_name: row.responsavel || null,
          responsible_phone: row.telefone || null,
          school_id: selectedSchool,
          classroom_id: selectedClassroom,
        })
        .select()
        .single();

      if (error) {
        res.errors.push(`Linha ${i + 2}: Erro ao inserir ${row.nome}: ${error.message}`);
      } else {
        res.inserted++;
        // Criar bio_form vazio
        if (newStudent) {
          await supabase.from('bio_forms').insert({ student_id: newStudent.id, sections_json: {} });
        }
      }
    }

    await logAudit('IMPORT', 'students', selectedClassroom, {
      file: fileName,
      inserted: res.inserted,
      updated: res.updated,
      errors: res.errors.length,
    });

    setResult(res);
    setImporting(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Importar Alunos</h1>
        <p className="text-muted-foreground">
          Importe alunos via arquivo CSV ou XLSX (Excel)
        </p>
      </div>

      {/* Seleção de Escola e Turma */}
      <Card>
        <CardHeader>
          <CardTitle>1. Selecione a Turma de Destino</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Escola</Label>
              <Select
                value={selectedSchool}
                onValueChange={(v) => {
                  setSelectedSchool(v);
                  setSelectedClassroom('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a escola" />
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
              <Label>Turma</Label>
              <Select value={selectedClassroom} onValueChange={setSelectedClassroom}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a turma" />
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
          </div>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle>2. Envie o Arquivo</CardTitle>
          <CardDescription>
            O arquivo deve conter colunas: Nome (obrigatório), Matrícula, Nascimento, Responsável,
            Telefone. Formato: CSV ou XLSX.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            {fileName ? (
              <div className="flex items-center justify-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-500" />
                <span className="font-medium">{fileName}</span>
                <Badge variant="success">{parsedData.length} linhas</Badge>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Arraste um arquivo CSV/XLSX aqui ou clique para selecionar
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Prévia dos Dados ({parsedData.length} registros)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Nascimento</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Telefone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{row.nome}</TableCell>
                      <TableCell>{row.matricula || '—'}</TableCell>
                      <TableCell>{row.nascimento || '—'}</TableCell>
                      <TableCell>{row.responsavel || '—'}</TableCell>
                      <TableCell>{row.telefone || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsedData.length > 50 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Exibindo 50 de {parsedData.length} registros
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Importar */}
      {parsedData.length > 0 && selectedSchool && selectedClassroom && (
        <div className="flex justify-end">
          <Button onClick={handleImport} disabled={importing} size="lg">
            {importing ? 'Importando...' : `Importar ${parsedData.length} Alunos`}
          </Button>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado da Importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-medium">{result.inserted} inseridos</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-500" />
                <span className="font-medium">{result.updated} atualizados</span>
              </div>
              {result.errors.length > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="font-medium">{result.errors.length} erros</span>
                </div>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="bg-destructive/10 rounded-lg p-3">
                <p className="font-medium text-destructive mb-1">Erros:</p>
                <ul className="text-sm text-destructive space-y-1">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modelo CSV */}
      <Card>
        <CardHeader>
          <CardTitle>Modelo de Arquivo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            Baixe o modelo CSV para referência:
          </p>
          <Button
            variant="outline"
            onClick={() => {
              const csv =
                'Nome,Matrícula,Nascimento,Responsável,Telefone\nJoão Silva,MAT001,15/03/2014,Maria Silva,(88) 99999-0001\nAna Souza,MAT002,22/07/2014,José Souza,(88) 99999-0002';
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'modelo_importacao_alunos.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Baixar Modelo CSV
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
