'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

export default function CadastroPage() {
  const router = useRouter();

  const [schools, setSchools] = useState<School[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    school_id: '',
    classroom_id: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadSchoolsAndClassrooms() {
      const [sRes, cRes] = await Promise.all([
        supabase.from('schools').select('id, name').order('name'),
        supabase.from('classrooms').select('id, school_id, year_grade, label').order('year_grade'),
      ]);
      setSchools(sRes.data ?? []);
      setClassrooms(cRes.data ?? []);
    }
    loadSchoolsAndClassrooms();
  }, []);

  const filteredClassrooms = form.school_id
    ? classrooms.filter((c) => c.school_id === form.school_id)
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.full_name || !form.email || !form.password || !form.school_id || !form.classroom_id) {
      setError('Preencha todos os campos.');
      return;
    }

    if (form.password !== form.confirm_password) {
      setError('As senhas não conferem.');
      return;
    }

    if (form.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          school_id: form.school_id,
          classroom_id: form.classroom_id,
        },
      },
    });

    if (signUpError) {
      const msg = signUpError.message;
      if (msg.includes('already registered') || msg.includes('User already registered')) {
        setError('Este e-mail já está cadastrado.');
      } else {
        setError(msg || 'Erro ao realizar cadastro.');
      }
      setLoading(false);
      return;
    }

    router.replace('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-50 to-green-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-600 to-green-500 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/PPDT_ARARENDA/logo-blue.svg"
              alt="PPDT Ararendá"
              className="h-16 w-16"
            />
          </div>
          <CardTitle className="text-2xl">Criar Conta</CardTitle>
          <CardDescription>
            Professor Diretor de Turma — PPDT Ararendá
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome Completo</Label>
              <Input
                id="full_name"
                placeholder="Seu nome completo"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirmar Senha</Label>
              <Input
                id="confirm_password"
                type="password"
                placeholder="Repita a senha"
                value={form.confirm_password}
                onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Escola</Label>
              <Select
                value={form.school_id}
                onValueChange={(v) => setForm({ ...form, school_id: v, classroom_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione sua escola" />
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

            <div className="space-y-2">
              <Label>Turma</Label>
              <Select
                value={form.classroom_id}
                onValueChange={(v) => setForm({ ...form, classroom_id: v })}
                disabled={!form.school_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.school_id ? 'Selecione a turma' : 'Selecione a escola primeiro'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredClassrooms.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.year_grade} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar Conta'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Entrar
            </Link>
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Secretaria Municipal de Educação de Ararendá — CE
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
