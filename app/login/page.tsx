'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProject } from '@/lib/project-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/logo';
import { Brain, Radio, Search } from 'lucide-react';

const HIGHLIGHTS = [
  { icon: Search, text: 'Search every service from one Explorer' },
  { icon: Radio, text: 'Live stream with error alerts over SSE' },
  { icon: Brain, text: 'AI root cause and suggested fixes' },
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user } = useProject();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const next = searchParams.get('next');
      const target =
        next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
      router.replace(target);
    }
  }, [user, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const success = await login(username, password);

    if (success) {
      const next = searchParams.get('next');
      const target =
        next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
      router.push(target);
    } else {
      setError('Invalid username or password');
    }

    setIsLoading(false);
  };

  if (user) {
    return null;
  }

  return (
    <div className="app-backdrop flex min-h-screen items-center justify-center p-6">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5 lg:grid-cols-2">
        <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-[#080c10] p-10 text-slate-100 lg:flex">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at 30% 20%, rgba(59,130,246,0.25), transparent 55%), radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '100% 100%, 22px 22px',
            }}
            aria-hidden
          />
          <Logo className="relative" wordmarkClassName="text-slate-100" />
          <div className="relative">
            <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-300">
              Open source · Self-hosted
            </span>
            <p className="mt-5 text-2xl font-semibold leading-snug tracking-tight">
              <span className="text-primary">AI-powered</span> log analysis for microservices.
            </p>
            <ul className="mt-6 space-y-3">
              {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-blue-300">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative font-mono text-[11px] text-slate-500">Kafka · Elasticsearch · Spring Boot</p>
        </div>

        <div className="py-10">
          <div className="px-8 sm:px-10">
            <div className="mb-8 lg:hidden">
              <Logo />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to your LogSpectra workspace</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-medium">
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
              {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
              <Button type="submit" className="h-10 w-full shadow-sm shadow-primary/20" disabled={isLoading}>
                {isLoading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-8 border-t border-border pt-6">
              <p className="text-xs text-muted-foreground">
                First run? The backend seeds <code className="font-mono text-foreground/80">admin / admin</code> —
                change it after signing in.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
