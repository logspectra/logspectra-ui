'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useProject } from '@/lib/project-context';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { LiveStreamProvider } from '@/lib/live-stream-context';

function LayoutContentInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, selectedProject, isLoading } = useProject();
  const [isMounted, setIsMounted] = useState(false);

  // Check if current route is a public route
  const isPublicRoute = pathname === '/login';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isLoading || !isMounted) return;

    // If not logged in and not on public route, redirect to login
    if (!user && !isPublicRoute) {
      router.push('/login');
      return;
    }

    // If logged in but no project selected and not on projects or public route, redirect to projects
    if (user && !selectedProject && !isPublicRoute && pathname !== '/projects') {
      router.push('/projects');
      return;
    }
  }, [user, selectedProject, isLoading, isPublicRoute, pathname, router, isMounted]);

  // While loading or not mounted, show children only
  if (!isMounted || isLoading) {
    return <>{children}</>;
  }

  // Show login page or other public routes without sidebar/header
  if (isPublicRoute || !user || !selectedProject) {
    return <>{children}</>;
  }

  return (
    <LiveStreamProvider>
      <Sidebar />
      <Header />
      <main className="ml-60 mt-[4.25rem] p-6">
        {children}
      </main>
    </LiveStreamProvider>
  );
}

export function LayoutContent({ children }: { children: React.ReactNode }) {
  return <LayoutContentInner>{children}</LayoutContentInner>;
}
