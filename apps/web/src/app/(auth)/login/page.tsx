'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: err } = await signIn(email, password);
    if (err) {
      console.error('Login error:', err);
      const msg = (err as any)?.message || '';
      if (msg.includes('Email not confirmed')) {
        setError('E-mail não confirmado. Desative "Confirm email" nas configurações do Supabase Auth.');
      } else if (msg.includes('Invalid login credentials')) {
        setError('E-mail ou senha inválidos.');
      } else {
        setError(msg || 'Erro ao fazer login.');
      }
      setLoading(false);
    } else {
      router.replace('/dashboard');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-50 to-green-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-600 to-green-500 shadow-lg">
            <svg
              className="h-16 w-16"
              viewBox="0 0 200 200"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Outer circle */}
              <circle cx="100" cy="100" r="90" fill="white" />
              
              {/* Colored segments */}
              <path d="M 100 15 A 85 85 0 0 1 175 50" fill="none" stroke="#1F6AA2" strokeWidth="14" strokeLinecap="round" />
              <path d="M 175 50 A 85 85 0 0 1 175 150" fill="none" stroke="#41A857" strokeWidth="14" strokeLinecap="round" />
              <path d="M 175 150 A 85 85 0 0 1 100 185" fill="none" stroke="#F6C24B" strokeWidth="14" strokeLinecap="round" />
              <path d="M 100 185 A 85 85 0 0 1 25 100" fill="none" stroke="#E25242" strokeWidth="14" strokeLinecap="round" />
              <path d="M 25 100 A 85 85 0 0 1 100 15" fill="none" stroke="#1F6AA2" strokeWidth="14" strokeLinecap="round" />
              
              {/* Center book symbol */}
              <g transform="translate(100, 100)">
                <path d="M -12 -8 L -12 12 Q 0 14 0 12 L 0 -8 Z" fill="#1F6AA2" />
                <path d="M 12 -8 L 12 12 Q 0 14 0 12 L 0 -8 Z" fill="#41A857" />
                <circle cx="0" cy="-2" r="2.5" fill="#F39C22" />
              </g>
            </svg>
          </div>
          </div>
          <CardTitle className="text-2xl">PPDT Ararendá</CardTitle>
          <CardDescription>
            Sistema Municipal — Projeto Professor Diretor de Turma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Secretaria Municipal de Educação de Ararendá — CE
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
