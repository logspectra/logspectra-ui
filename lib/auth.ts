import { Project, User } from './types';
import { api, tokenStore } from './api';

export const authUtils = {
  authenticate: async (username: string, password: string): Promise<User | null> => {
    try {
      const response = await api.login(username, password);
      tokenStore.set(response.token);
      return response.user;
    } catch {
      return null;
    }
  },

  getCurrentUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    const userJson = localStorage.getItem('currentUser');
    return userJson ? (JSON.parse(userJson) as User) : null;
  },

  setCurrentUser: (user: User | null) => {
    if (typeof window === 'undefined') return;
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
  },

  isAuthenticated: (): boolean => {
    if (typeof window === 'undefined') return false;
    return !!tokenStore.get();
  },

  logout: () => {
    if (typeof window === 'undefined') return;
    tokenStore.clear();
    localStorage.removeItem('currentUser');
    localStorage.removeItem('selectedProjectId');
  },

  getUserProjects: async (_userId: string): Promise<Project[]> => {
    return api.getProjects();
  },

  getProject: async (projectId: string): Promise<Project | null> => {
    const projects = await api.getProjects();
    return projects.find((p) => p.id === projectId) || null;
  },

  createProject: async (_userId: string, name: string, description?: string): Promise<Project> => {
    return api.createProject(name, description);
  },

  getSelectedProjectId: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('selectedProjectId');
  },

  setSelectedProjectId: (projectId: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('selectedProjectId', projectId);
  },
};
