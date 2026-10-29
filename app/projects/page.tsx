'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/lib/project-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Folder, LogOut, Zap } from 'lucide-react';
import { PageErrorBanner } from '@/components/page-error-banner';
import { EmptyState } from '@/components/empty-state';
import { PageHeader, PageShell } from '@/components/page-shell';

export default function ProjectsPage() {
  const router = useRouter();
  const { user, projects, selectProject, createProject, logout, isLoading } = useProject();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return null;
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    setActionError('');
    try {
      await createProject(projectName, projectDesc);
      setProjectName('');
      setProjectDesc('');
      setShowCreateModal(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to create project');
    }
  };

  const handleSelectProject = async (projectId: string) => {
    setActionError('');
    try {
      await selectProject(projectId);
      router.push('/dashboard');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to open project');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border/80 bg-card/95 backdrop-blur">
        <PageShell className="flex items-center justify-between py-5 pb-8">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary p-2 shadow-sm">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">LogSpectra</p>
              <p className="text-xs text-muted-foreground">Welcome, {user.name}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </PageShell>
      </header>

      <main className="py-10">
        <PageShell>
          <PageHeader
            title="Your projects"
            description="Select a project to open the dashboard, or create a new one."
            actions={
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New project
              </Button>
            }
          />
          <PageErrorBanner message={actionError} />

          {projects.length > 0 ? (
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer gap-0 border-border/80 py-0 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                  onClick={() => void handleSelectProject(project.id)}
                >
                  <div className="p-6">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Folder className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground">{project.name}</h3>
                        <p className="truncate text-xs text-muted-foreground">{project.id}</p>
                      </div>
                    </div>
                    {project.description ? (
                      <p className="mb-4 text-sm text-muted-foreground">{project.description}</p>
                    ) : null}
                    <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
                      <span>{project.serviceCount ?? 0} services</span>
                      <span>Open →</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Folder}
              title="No projects yet"
              description="Create a project to start ingesting logs and using the dashboard."
              action={
                <Button onClick={() => setShowCreateModal(true)}>Create your first project</Button>
              }
              className="mt-8"
            />
          )}
        </PageShell>
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md gap-0 py-0 shadow-lg">
            <div className="border-b border-border/60 bg-muted/30 px-6 py-4">
              <h2 className="text-lg font-semibold">Create project</h2>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-4 p-6">
              <div>
                <label htmlFor="name" className="mb-1 block text-sm font-medium">
                  Project name
                </label>
                <Input
                  id="name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., Production API"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="desc" className="mb-1 block text-sm font-medium">
                  Description (optional)
                </label>
                <Input
                  id="desc"
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder="Main production services"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowCreateModal(false);
                    setProjectName('');
                    setProjectDesc('');
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={!projectName.trim()}>
                  Create
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
