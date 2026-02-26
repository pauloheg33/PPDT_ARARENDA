'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { ROLE_LABELS, type Role } from '@/lib/roles';
import { cn } from '@/lib/utils';
import {
  School,
  Users,
  BookOpen,
  LayoutDashboard,
  Upload,
  Camera,
  Grid3X3,
  FileText,
  Lock,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: Role[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
    roles: ['ADMIN_SME', 'COORD_PPDT', 'GESTOR_ESCOLA', 'DT'],
  },
  {
    label: 'Escolas',
    href: '/admin/escolas',
    icon: <School className="h-4 w-4" />,
    roles: ['ADMIN_SME', 'COORD_PPDT'],
  },
  {
    label: 'Turmas',
    href: '/admin/turmas',
    icon: <BookOpen className="h-4 w-4" />,
    roles: ['ADMIN_SME', 'COORD_PPDT', 'GESTOR_ESCOLA'],
  },
  {
    label: 'Alunos',
    href: '/admin/alunos',
    icon: <Users className="h-4 w-4" />,
    roles: ['ADMIN_SME', 'COORD_PPDT', 'GESTOR_ESCOLA', 'DT'],
  },
  {
    label: 'Importar Dados',
    href: '/admin/importar',
    icon: <Upload className="h-4 w-4" />,
    roles: ['ADMIN_SME', 'GESTOR_ESCOLA', 'DT'],
  },
  {
    label: 'Usuários',
    href: '/admin/usuarios',
    icon: <Users className="h-4 w-4" />,
    roles: ['ADMIN_SME'],
  },
];

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  if (!profile) return null;

  const role = profile.role as Role;
  const filteredItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed left-4 top-4 z-50 md:hidden rounded-md bg-primary p-2 text-primary-foreground"
        onClick={() => setOpen(!open)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-card border-r transform transition-transform md:translate-x-0 md:static md:z-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b">
            <h1 className="text-lg font-bold text-primary">PPDT Ararendá</h1>
            <p className="text-xs text-muted-foreground">Sistema Municipal DT</p>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  pathname.startsWith(item.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}

            {/* DT turma links */}
            {role === 'DT' && profile.classroom_id && (
              <>
                <div className="pt-4 pb-2 px-3 text-xs font-semibold text-muted-foreground uppercase">
                  Minha Turma
                </div>
                <Link
                  href={`/dt/liberacao?turmaId=${profile.classroom_id}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    pathname.includes('/liberacao')
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  )}
                >
                  <Lock className="h-4 w-4" />
                  Liberar/Bloquear Ficha
                </Link>
                <Link
                  href={`/dt/registro-fotografico?turmaId=${profile.classroom_id}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    pathname.includes('/registro-fotografico')
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  )}
                >
                  <Camera className="h-4 w-4" />
                  Registro Fotográfico
                </Link>
                <Link
                  href={`/dt/mapeamento-sala?turmaId=${profile.classroom_id}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    pathname.includes('/mapeamento-sala')
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  )}
                >
                  <Grid3X3 className="h-4 w-4" />
                  Mapeamento de Sala
                </Link>
                <Link
                  href={`/dt/relatorios?turmaId=${profile.classroom_id}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    pathname.includes('/relatorios')
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  )}
                >
                  <FileText className="h-4 w-4" />
                  Relatórios
                </Link>
              </>
            )}
          </nav>

          {/* User info */}
          <div className="border-t p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
