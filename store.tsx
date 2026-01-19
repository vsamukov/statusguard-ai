
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState, Region, Service, Component, Incident, Severity } from './types';
import { api } from './services/api';

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
  login: (credentials: any) => Promise<void>;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    regions: [],
    services: [],
    components: [],
    incidents: [],
    isAuthenticated: !!localStorage.getItem('statusguard_token'),
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addRegion = async (name: string) => {
    const region = await api.createRegion(name);
    setState(prev => ({ ...prev, regions: [...prev.regions, region] }));
  };

  const updateRegion = async (id: string, name: string) => {
    const region = await api.updateRegion(id, name);
    setState(prev => ({ ...prev, regions: prev.regions.map(r => r.id === id ? region : r) }));
  };

  const removeRegion = async (id: string) => {
    await api.deleteRegion(id);
    fetchData();
  };

  const addService = async (regionId: string, name: string, description: string) => {
    const service = await api.createService(regionId, name, description);
    setState(prev => ({ ...prev, services: [...prev.services, service] }));
  };

  const updateService = async (id: string, name: string, description: string) => {
    const service = await api.updateService(id, name, description);
    setState(prev => ({ ...prev, services: prev.services.map(s => s.id === id ? service : s) }));
  };

  const removeService = async (id: string) => {
    await api.deleteService(id);
    fetchData();
  };

  const addComponent = async (serviceId: string, name: string, description: string) => {
    const component = await api.createComponent(serviceId, name, description);
    setState(prev => ({ ...prev, components: [...prev.components, component] }));
  };

  const updateComponent = async (id: string, name: string, description: string) => {
    const component = await api.updateComponent(id, name, description);
    setState(prev => ({ ...prev, components: prev.components.map(c => c.id === id ? component : c) }));
  };

  const removeComponent = async (id: string) => {
    await api.deleteComponent(id);
    fetchData();
  };

  const reportIncident = async (incident: any) => {
    const created = await api.createIncident(incident);
    setState(prev => ({ ...prev, incidents: [...prev.incidents, created] }));
  };

  const resolveIncident = async (id: string) => {
    const updated = await api.resolveIncident(id);
    setState(prev => ({
      ...prev,
      incidents: prev.incidents.map(i => i.id === id ? updated : i)
    }));
  };

  const login = async (credentials: any) => {
    const { token } = await api.login(credentials);
    localStorage.setItem('statusguard_token', token);
    setState(prev => ({ ...prev, isAuthenticated: true }));
    fetchData();
  };

  const logout = () => {
    localStorage.removeItem('statusguard_token');
    setState(prev => ({ ...prev, isAuthenticated: false }));
  };

  return (
    <AppContext.Provider value={{
      state, isLoading, addRegion, updateRegion, removeRegion, addService, 
      updateService, removeService, addComponent, updateComponent, removeComponent,
      reportIncident, resolveIncident, login, logout
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
