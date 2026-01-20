
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState, Severity, AdminUser, AuditLog } from './types.ts';
import { api } from './services/api.ts';

interface AppContextType {
  state: AppState;
  isLoading: boolean;
  addRegion: (name: string) => Promise<void>;
  updateRegion: (id: string, name: string) => Promise<void>;
  removeRegion: (id: string) => Promise<void>;
  addService: (regionId: string, name: string, description: string) => Promise<void>;
  updateService: (id: string, name: string, description: string) => Promise<void>;
  removeService: (id: string) => Promise<void>;
  addComponent: (serviceId: string, name: string, description: string) => Promise<void>;
  updateComponent: (id: string, name: string, description: string) => Promise<void>;
  removeComponent: (id: string) => Promise<void>;
  reportIncident: (incident: { componentId: string, title: string, internalDesc: string, severity: Severity }) => Promise<void>;
  resolveIncident: (incidentId: string) => Promise<void>;
  createAdmin: (user: any) => Promise<void>;
  deleteAdmin: (id: string) => Promise<void>;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
  fetchAdminData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const TOKEN_KEY = 'voximplant_status_token';
const USER_KEY = 'voximplant_status_user';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    regions: [],
    services: [],
    components: [],
    incidents: [],
    users: [],
    auditLogs: [],
    isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
    currentUser: localStorage.getItem(USER_KEY) || undefined,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getStatus();
      setState(prev => ({ ...prev, ...data }));
    } catch (err) {
      console.error("Failed to fetch status map", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAdminData = useCallback(async () => {
    if (!state.isAuthenticated) return;
    try {
      const data = await api.getAdminData();
      setState(prev => ({ ...prev, ...data }));
    } catch (err) {
      console.error("Failed to fetch admin info", err);
    }
  }, [state.isAuthenticated]);

  useEffect(() => {
    fetchData();
    if (state.isAuthenticated) fetchAdminData();
  }, [fetchData, fetchAdminData, state.isAuthenticated]);

  const addRegion = async (name: string) => {
    await api.createRegion(name);
    fetchData();
    fetchAdminData();
  };

  const updateRegion = async (id: string, name: string) => {
    await api.updateRegion(id, name);
    fetchData();
    fetchAdminData();
  };

  const removeRegion = async (id: string) => {
    await api.deleteRegion(id);
    fetchData();
    fetchAdminData();
  };

  const addService = async (regionId: string, name: string, description: string) => {
    await api.createService(regionId, name, description);
    fetchData();
    fetchAdminData();
  };

  const updateService = async (id: string, name: string, description: string) => {
    await api.updateService(id, name, description);
    fetchData();
    fetchAdminData();
  };

  const removeService = async (id: string) => {
    await api.deleteService(id);
    fetchData();
    fetchAdminData();
  };

  const addComponent = async (serviceId: string, name: string, description: string) => {
    await api.createComponent(serviceId, name, description);
    fetchData();
    fetchAdminData();
  };

  const updateComponent = async (id: string, name: string, description: string) => {
    await api.updateComponent(id, name, description);
    fetchData();
    fetchAdminData();
  };

  const removeComponent = async (id: string) => {
    await api.deleteComponent(id);
    fetchData();
    fetchAdminData();
  };

  const reportIncident = async (incident: any) => {
    await api.createIncident(incident);
    fetchData();
    fetchAdminData();
  };

  const resolveIncident = async (id: string) => {
    await api.resolveIncident(id);
    fetchData();
    fetchAdminData();
  };

  const createAdmin = async (user: any) => {
    await api.createUser(user);
    fetchAdminData();
  };

  const deleteAdmin = async (id: string) => {
    await api.deleteUser(id);
    fetchAdminData();
  };

  const login = async (credentials: any) => {
    const { token, username } = await api.login(credentials);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, username);
    setState(prev => ({ ...prev, isAuthenticated: true, currentUser: username }));
    fetchData();
    fetchAdminData();
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState(prev => ({ ...prev, isAuthenticated: false, currentUser: undefined }));
  };

  return (
    <AppContext.Provider value={{
      state, isLoading, addRegion, updateRegion, removeRegion, addService, 
      updateService, removeService, addComponent, updateComponent, removeComponent,
      reportIncident, resolveIncident, createAdmin, deleteAdmin, login, logout, fetchAdminData
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
