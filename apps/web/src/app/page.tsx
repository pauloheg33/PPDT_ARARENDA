'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

export default function HomePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace(profile?.role === 'ALUNO' ? '/aluno' : '/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, profile, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse text-lg text-muted-foreground">Carregando...</div>
    </div>
  );
}
