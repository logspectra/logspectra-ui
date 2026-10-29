'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProject } from '@/lib/project-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Zap } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user } = useProject();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password123');
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
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border/80 bg-card shadow-lg lg:grid-cols-2">
        <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary-foreground/15 p-2">
              <Zap className="h-6 w-6" />
            </div>
            <span className="text-xl font-semibold tracking-tight">LogSpectra</span>
          </div>
          <div>
            <p className="text-lg font-medium leading-snug">AI-powered log analysis for production teams.</p>
            <p className="mt-3 text-sm text-primary-foreground/80">
              Search logs, triage issues, and run analysis in one place.
            </p>
          </div>
          <p className="text-xs text-primary-foreground/60">Secure sign-in required</p>
        </div>

        <Card className="rounded-none border-0 py-8 shadow-none">
          <div className="px-8">
            <div className="mb-8 lg:hidden">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <Zap className="h-5 w-5" />
                <span className="font-semibold">LogSpectra</span>
              </div>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Use your LogSpectra account</p>

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
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-8 border-t border-border/60 pt-6">
              <p className="text-xs text-muted-foreground">Demo: admin / password123</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
