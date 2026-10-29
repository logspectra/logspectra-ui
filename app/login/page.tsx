'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProject } from '@/lib/project-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">LogSpectra</h1>
          <p className="text-muted-foreground mb-8">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-foreground mb-2">
                Username
              </label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full"
                required
              />
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-3 text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-8 pt-8 border-t border-border">
            <p className="text-xs text-muted-foreground mb-4">Demo credentials:</p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <strong>Admin:</strong> admin / admin
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
