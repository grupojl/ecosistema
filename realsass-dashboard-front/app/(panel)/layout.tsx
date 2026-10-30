'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@real/ui';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <Spinner />
    );
  }

  if (!isAuthenticated) {
    return (
      <Spinner />
    );
  }

  return (
    <DashboardShell>{children}</DashboardShell>
  );
}
