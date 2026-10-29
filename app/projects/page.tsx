'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/lib/project-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Folder, LogOut } from 'lucide-react';
import { PageErrorBanner } from '@/components/page-error-banner';

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">LogSpectra</h1>
              <p className="text-sm text-muted-foreground mt-1">Welcome, {user.name}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageErrorBanner message={actionError} />
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-foreground">Your Projects</h2>
          <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>

        {/* Projects Grid */}
        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="p-6 hover:border-primary/50 transition-colors cursor-pointer group"
                onClick={() => void handleSelectProject(project.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Folder className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{project.name}</h3>
                      <p className="text-xs text-muted-foreground">Project ID: {project.id}</p>
                    </div>
                  </div>
                </div>

                {project.description && (
                  <p className="text-sm text-muted-foreground mb-4">{project.description}</p>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border">
                  <span>{project.serviceCount ?? 0} services</span>
                  <span>Updated today</span>
                </div>

                <Button variant="secondary" className="w-full mt-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Enter Project
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-6">No projects yet. Create one to get started.</p>
            <Button onClick={() => setShowCreateModal(true)}>Create Your First Project</Button>
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">Create New Project</h2>

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
                    Project Name
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
                  <label htmlFor="desc" className="block text-sm font-medium text-foreground mb-1">
                    Description (optional)
                  </label>
                  <Input
                    id="desc"
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    placeholder="e.g., Main production services"
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
                    Create Project
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
