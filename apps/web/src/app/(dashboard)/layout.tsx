'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Sidebar } from '@/components/layout/sidebar';
import type { Role } from '@/lib/roles';

// Mapeia prefixos de rota aos roles que podem acessá-los
const ROUTE_ROLE_MAP: { prefix: string; roles: Role[] }[] = [
  { prefix: '/admin/usuarios', roles: ['ADMIN_SME'] },
  { prefix: '/admin/escolas', roles: ['ADMIN_SME', 'COORD_PPDT'] },
  { prefix: '/admin/turmas', roles: ['ADMIN_SME', 'COORD_PPDT', 'GESTOR_ESCOLA'] },
  { prefix: '/admin/importar', roles: ['ADMIN_SME', 'GESTOR_ESCOLA', 'DT'] },
  { prefix: '/admin/alunos', roles: ['ADMIN_SME', 'COORD_PPDT', 'GESTOR_ESCOLA', 'DT'] },
  { prefix: '/dt/', roles: ['ADMIN_SME', 'DT'] },
  { prefix: '/aluno/', roles: ['ALUNO'] },
  { prefix: '/dashboard', roles: ['ADMIN_SME', 'COORD_PPDT', 'GESTOR_ESCOLA', 'DT'] },
  { prefix: '/aluno', roles: ['ALUNO'] },
];

function isRouteAllowed(pathname: string, role: Role): boolean {
  const match = ROUTE_ROLE_MAP.find((r) => pathname.startsWith(r.prefix));
  if (!match) return true; // rotas sem restrição explícita são permitidas
  return match.roles.includes(role);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && profile && !isRouteAllowed(pathname, profile.role)) {
      router.replace(profile.role === 'ALUNO' ? '/aluno' : '/dashboard');
    }
  }, [loading, profile, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) return null;

  // Bloquear renderização enquanto verifica permissão de rota
  if (profile && !isRouteAllowed(pathname, profile.role)) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
    </div>
  );
}
