
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState, Severity } from './types.ts';
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
  setTimezoneOffset: (offset: number) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const TOKEN_KEY = 'voximplant_status_token';
const USER_KEY = 'voximplant_status_user';
const TZ_KEY = 'voximplant_status_tz';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to system timezone offset if not saved
  const savedTz = localStorage.getItem(TZ_KEY);
  const initialOffset = savedTz !== null ? parseInt(savedTz, 10) : (new Date().getTimezoneOffset() * -1);

  const [state, setState] = useState<AppState>({
    regions: [],
    services: [],
    components: [],
    incidents: [],
    users: [],
    auditLogs: [],
    isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
    currentUser: localStorage.getItem(USER_KEY) || undefined,
    timezoneOffset: initialOffset,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getStatus();
      setState(prev => ({ ...prev, ...data }));
    } catch (err) {
      console.error("Failed to fetch status map", err);
    }
  }, []);

  const fetchAdminData = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    try {
      const data = await api.getAdminData();
      setState(prev => ({ ...prev, ...data }));
    } catch (err) {
      console.error("Failed to fetch admin info", err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await fetchData();
      if (state.isAuthenticated) await fetchAdminData();
      setIsLoading(false);
    };
    init();
  }, [fetchData, fetchAdminData, state.isAuthenticated]);

  const wrapAction = async (action: () => Promise<any>) => {
    try {
      await action();
      await Promise.all([
        fetchData(),
        state.isAuthenticated ? fetchAdminData() : Promise.resolve()
      ]);
    } catch (err) {
      console.error("Action Execution Failed:", err);
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

  const createAdmin = (u: any) => wrapAction(() => api.createUser(u));
  const deleteAdmin = (id: string) => wrapAction(() => api.deleteUser(id));

  const login = async (cred: any) => {
    const { token, username } = await api.login(cred);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, username);
    setState(prev => ({ ...prev, isAuthenticated: true, currentUser: username }));
    await Promise.all([fetchData(), fetchAdminData()]);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState(prev => ({ ...prev, isAuthenticated: false, currentUser: undefined }));
  };

  const setTimezoneOffset = (offset: number) => {
    localStorage.setItem(TZ_KEY, offset.toString());
    setState(prev => ({ ...prev, timezoneOffset: offset }));
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
      calculateSLA, setTimezoneOffset
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
