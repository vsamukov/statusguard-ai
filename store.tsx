
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AppState, Severity, AdminUser, AuditLog, Incident } from './types.ts';
import { api } from './services/api.ts';

interface AppContextType {
  state: AppState;
  isLoading: boolean;
  addRegion: (name: string) => Promise<void>;
  removeRegion: (id: string) => Promise<void>;
  addService: (regionId: string, name: string, description: string) => Promise<void>;
  removeService: (id: string) => Promise<void>;
  addComponent: (serviceId: string, name: string, description: string) => Promise<void>;
  removeComponent: (id: string) => Promise<void>;
  reportIncident: (incident: any) => Promise<void>;
  updateIncident: (id: string, incident: any) => Promise<void>;
  resolveIncident: (incidentId: string) => Promise<void>;
  createAdmin: (user: any) => Promise<void>;
  deleteAdmin: (id: string) => Promise<void>;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
  fetchAdminData: () => Promise<void>;
  calculateSLA: (componentId: string, days?: number) => number;
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

  const wrapAction = async (action: () => Promise<any>) => {
    try {
      await action();
      await fetchData();
      if (state.isAuthenticated) await fetchAdminData();
    } catch (err) {
      console.error("Infrastructure Action Failed:", err);
      throw err;
    }
  };

  const addRegion = (name: string) => wrapAction(() => api.createRegion(name));
  const removeRegion = (id: string) => wrapAction(() => api.deleteRegion(id));
  const addService = (rid: string, n: string, d: string) => wrapAction(() => api.createService(rid, n, d));
  const removeService = (id: string) => wrapAction(() => api.deleteService(id));
  const addComponent = (sid: string, n: string, d: string) => wrapAction(() => api.createComponent(sid, n, d));
  const removeComponent = (id: string) => wrapAction(() => api.deleteComponent(id));
  
  const reportIncident = (inc: any) => wrapAction(() => api.createIncident(inc));
  const updateIncident = (id: string, inc: any) => wrapAction(() => api.updateIncident(id, inc));
  const resolveIncident = (id: string) => wrapAction(() => api.resolveIncident(id));

  const createAdmin = async (u: any) => {
    try {
      await api.createUser(u);
      await fetchAdminData();
    } catch (err) {
      console.error("Failed to create admin:", err);
      throw err;
    }
  };

  const deleteAdmin = async (id: string) => {
    try {
      await api.deleteUser(id);
      await fetchAdminData();
    } catch (err) {
      console.error("Failed to delete admin:", err);
      throw err;
    }
  };

  const login = async (cred: any) => {
    const { token, username } = await api.login(cred);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, username);
    setState(prev => ({ ...prev, isAuthenticated: true, currentUser: username }));
    await fetchData();
    await fetchAdminData();
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState(prev => ({ ...prev, isAuthenticated: false, currentUser: undefined }));
  };

  const calculateSLA = useCallback((componentId: string, days = 90) => {
    const now = Date.now();
    const periodStart = now - (days * 24 * 60 * 60 * 1000);
    const totalMinutes = days * 24 * 60;
    
    const componentIncidents = state.incidents.filter(i => i.componentId === componentId);
    let totalDowntimeMinutes = 0;

    componentIncidents.forEach(inc => {
      const incStart = Math.max(new Date(inc.startTime).getTime(), periodStart);
      const incEnd = inc.endTime ? new Date(inc.endTime).getTime() : now;

      if (incEnd > periodStart) {
        const durationMs = incEnd - incStart;
        if (durationMs > 0) {
          const durationMinutes = durationMs / (1000 * 60);
          const impactFactor = inc.severity === Severity.OUTAGE ? 1 : 0.5;
          totalDowntimeMinutes += durationMinutes * impactFactor;
        }
      }
    });

    const availability = ((totalMinutes - totalDowntimeMinutes) / totalMinutes) * 100;
    return Math.max(0, Math.min(100, parseFloat(availability.toFixed(3))));
  }, [state.incidents]);

  return (
    <AppContext.Provider value={{
      state, isLoading, addRegion, removeRegion, addService, 
      removeService, addComponent, removeComponent,
      reportIncident, updateIncident, resolveIncident, createAdmin, deleteAdmin, login, logout, fetchAdminData,
      calculateSLA
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
