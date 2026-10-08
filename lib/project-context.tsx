'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Project } from './types';
import { authUtils } from './auth';
import type { CustomDateRange } from './api';
import type { TimeRange } from './time-range';

export type { TimeRange } from './time-range';

interface ProjectContextType {
  user: User | null;
  projects: Project[];
  selectedProject: Project | null;
  timeRange: TimeRange;
  customDateRange: CustomDateRange;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  selectProject: (projectId: string) => Promise<boolean>;
  createProject: (name: string, description?: string) => Promise<void>;
  setTimeRange: (timeRange: TimeRange) => Promise<void>;
  setCustomDateRange: (dateRange: CustomDateRange) => Promise<void>;
  /** Sets global query window to an exact custom from/to (e.g. chart brush). */
  applyCustomWindow: (from: Date, to: Date) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [timeRange, setTimeRangeState] = useState<TimeRange>('24h');
  const [customDateRange, setCustomDateRangeState] = useState<CustomDateRange>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      const currentUser = authUtils.getCurrentUser();

      if (currentUser) {
        setUser(currentUser);
        const userProjects = await authUtils.getUserProjects(currentUser.id);
        setProjects(userProjects);

        const selectedProjectId = authUtils.getSelectedProjectId();
        const project = selectedProjectId
          ? userProjects.find((p) => p.id === selectedProjectId)
          : userProjects[0];

        if (project) {
          authUtils.setSelectedProjectId(project.id);
          setSelectedProject(project);
        }
      }
      setIsLoading(false);
    };

    void initialize();
  }, []);

  useEffect(() => {
    // Keep selected project object reactive for consumers that depend on range changes.
    setSelectedProject((prev) => (prev ? { ...prev } : prev));
  }, [
    timeRange,
    customDateRange.from?.getTime(),
    customDateRange.to?.getTime(),
    user?.id,
    selectedProject?.id,
  ]);

  const login = async (username: string, password: string): Promise<boolean> => {
    const authenticatedUser = await authUtils.authenticate(username, password);
    if (!authenticatedUser) return false;

    authUtils.setCurrentUser(authenticatedUser);
    setUser(authenticatedUser);

    const userProjects = await authUtils.getUserProjects(authenticatedUser.id);
    setProjects(userProjects);

    if (userProjects.length > 0) {
      authUtils.setSelectedProjectId(userProjects[0].id);
      setSelectedProject(userProjects[0]);
    }

    return true;
  };

  const logout = () => {
    authUtils.logout();
    setUser(null);
    setProjects([]);
    setSelectedProject(null);
  };

  const selectProject = async (projectId: string): Promise<boolean> => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return false;

    authUtils.setSelectedProjectId(projectId);
    setSelectedProject(project);
    return true;
  };

  const createProject = async (name: string, description?: string): Promise<void> => {
    if (!user) return;

    const newProject = await authUtils.createProject(user.id, name, description);
    setProjects([...projects, newProject]);
    authUtils.setSelectedProjectId(newProject.id);
    setSelectedProject(newProject);
  };

  const setTimeRange = async (nextTimeRange: TimeRange): Promise<void> => {
    if (nextTimeRange === timeRange) return;
    setTimeRangeState(nextTimeRange);
  };

  const setCustomDateRange = async (dateRange: CustomDateRange): Promise<void> => {
    setCustomDateRangeState(dateRange);
  };

  const applyCustomWindow = async (from: Date, to: Date): Promise<void> => {
    if (from.getTime() >= to.getTime()) return;
    setCustomDateRangeState({ from, to });
    setTimeRangeState("custom");
  };

  return (
    <ProjectContext.Provider
      value={{
        user,
        projects,
        selectedProject,
        timeRange,
        customDateRange,
        isLoading,
        login,
        logout,
        selectProject,
        createProject,
        setTimeRange,
        setCustomDateRange,
        applyCustomWindow,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
