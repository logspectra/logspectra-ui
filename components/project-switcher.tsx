'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/lib/project-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ChevronDown, Plus, Folder } from 'lucide-react';

export function ProjectSwitcher() {
  const router = useRouter();
  const { selectedProject, projects, selectProject, createProject } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  const handleSelectProject = async (projectId: string) => {
    await selectProject(projectId);
    setIsOpen(false);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      await createProject(newProjectName, newProjectDesc);
      setNewProjectName('');
      setNewProjectDesc('');
      setShowCreateForm(false);
    }
  };

  const handleGoToProjects = () => {
    router.push('/projects');
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Folder className="w-4 h-4 flex-shrink-0" />
          <span className="truncate text-sm font-medium">{selectedProject?.name || 'Select Project'}</span>
        </div>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 w-full">
          <div className="p-2">
            {/* Project List */}
            <div className="max-h-48 overflow-y-auto mb-2">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => void handleSelectProject(project.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedProject?.id === project.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-secondary text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{project.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{project.serviceCount ?? 0} services</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Divider */}
            {projects.length > 0 && <div className="border-t border-border my-2" />}

            {/* Create/Manage Actions */}
            {!showCreateForm ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateForm(true)}
                  className="w-full justify-start text-xs"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGoToProjects}
                  className="w-full justify-start text-xs"
                >
                  Manage All Projects
                </Button>
              </>
            ) : (
              <form onSubmit={(e) => void handleCreateProject(e)} className="p-2 border-t border-border">
                <div className="space-y-2">
                  <Input
                    placeholder="Project name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="text-xs"
                    autoFocus
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    className="text-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      className="flex-1 text-xs"
                      disabled={!newProjectName.trim()}
                    >
                      Create
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewProjectName('');
                        setNewProjectDesc('');
                      }}
                      className="flex-1 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
