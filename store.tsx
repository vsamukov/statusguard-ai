
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AppState, Severity, NotificationSettings, RemoteDashboardConfig } from './types.ts';
import { portalApi, createRemoteApi, nodeApi } from './services/api.ts';

interface AppContextType {
  state: AppState;
  isLoading: boolean;
  switchDashboard: (id: string) => void;
  // Admin Data Management
  fetchAdminData: () => Promise<void>;
  getSubscribers: (page?: number, limit?: number, search?: string) => Promise<any>;
  // All actions below proxy to the ACTIVE remote dashboard
  addRegion: (name: string) => Promise<void>;
  removeRegion: (id: string) => Promise<void>;
  addComponent: (regionId: string, name: string, description: string) => Promise<void>;
  removeComponent: (id: string) => Promise<void>;
  addTemplate: (template: any) => Promise<void>;
  updateTemplate: (id: string, template: any) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
  reportIncident: (incident: any) => Promise<void>;
  updateIncident: (id: string, incident: any) => Promise<void>;
  resolveIncident: (incidentId: string) => Promise<void>;
  addSubscriber: (email: string) => Promise<void>;
  updateSubscriber: (id: string, email: string) => Promise<void>;
  removeSubscriber: (id: string) => Promise<void>;
  saveNotificationSettings: (settings: NotificationSettings) => Promise<void>;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
  calculateSLA: (componentId: string, days?: number) => number;
  setTimezoneOffset: (offset: number) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const TOKEN_KEY = 'voximplant_portal_token';
const USER_KEY = 'voximplant_portal_user';

const IS_HUB_MODE = (process.env as any).IS_HUB === true;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    dashboards: [],
    activeDashboardId: null,
    regions: [],
    components: [],
    templates: [],
    incidents: [],
    subscriptions: [],
    notificationSettings: { incidentNewTemplate: '', incidentResolvedTemplate: '' },
    users: [],
    auditLogs: [],
    isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
    currentUser: localStorage.getItem(USER_KEY) || undefined,
    timezoneOffset: (new Date().getTimezoneOffset() * -1),
  });
  const [isLoading, setIsLoading] = useState(true);

  const activeDashboard = useMemo(() => 
    state.dashboards.find(d => d.id === state.activeDashboardId), 
    [state.dashboards, state.activeDashboardId]
  );

  const remoteApi = useMemo(() => {
    if (IS_HUB_MODE) {
      return activeDashboard ? createRemoteApi(activeDashboard) : null;
    }
    return nodeApi;
  }, [activeDashboard]);

  const fetchData = useCallback(async () => {
    try {
      if (IS_HUB_MODE) {
        if (!remoteApi || !activeDashboard) return;
        
        setState(prev => ({
          ...prev,
          regions: [],
          components: [],
          templates: [],
          incidents: [],
          auditLogs: [],
          subscriptions: []
        }));

        const [status, admin] = await Promise.all([
          (remoteApi as any).getStatus().catch((e: any) => { console.error("Status fetch failed", e); return {}; }),
          (remoteApi as any).getAdminData().catch((e: any) => { console.error("Admin data fetch failed", e); return {}; })
        ]);

        setState(prev => ({ ...prev, ...status, ...admin }));
      } else {
        const status = await nodeApi.getStatus();
        setState(prev => ({ ...prev, ...status }));
      }
    } catch (err) {
      console.error("Critical error in fetchData", err);
    }
  }, [remoteApi, activeDashboard]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      if (IS_HUB_MODE) {
        if (state.isAuthenticated) {
          try {
            const configs = await portalApi.getDashboardConfigs();
            setState(prev => {
              const activeId = prev.activeDashboardId || (configs.length > 0 ? configs[0].id : null);
              return { ...prev, dashboards: configs, activeDashboardId: activeId };
            });
          } catch (err) {
            console.error("Auth initialization failed", err);
            logout();
          } finally {
            setIsLoading(false);
          }
        } else {
          setIsLoading(false);
        }
      } else {
        await fetchData();
        setIsLoading(false);
      }
    };
    init();
  }, [state.isAuthenticated]);

  useEffect(() => {
    if (IS_HUB_MODE && state.activeDashboardId) {
      fetchData();
    }
  }, [state.activeDashboardId, fetchData]);

  const wrapAction = async (action: () => Promise<any>) => {
    try {
      await action();
      await fetchData();
    } catch (err) {
      console.error("Action Execution Failed:", err);
      throw err;
    }
  };

  const switchDashboard = (id: string) => setState(prev => ({ ...prev, activeDashboardId: id }));

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState(prev => ({ ...prev, isAuthenticated: false, currentUser: undefined }));
  };

  const login = async (cred: any) => {
    const { token, username } = await portalApi.login(cred);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, username);
    setState(prev => ({ ...prev, isAuthenticated: true, currentUser: username }));
  };

  const setTimezoneOffset = (offset: number) => setState(prev => ({ ...prev, timezoneOffset: offset }));

  const calculateSLA = useCallback((componentId: string, days = 90) => {
    const now = Date.now();
    const periodStart = now - (days * 24 * 60 * 60 * 1000);
    const totalMinutes = days * 24 * 60;
    const componentIncidents = state.incidents.filter(i => i.componentId === componentId);
    let totalDowntimeMinutes = 0;
    componentIncidents.forEach(inc => {
      const start = new Date(inc.startTime).getTime();
      const end = inc.endTime ? new Date(inc.endTime).getTime() : now;
      const incStart = Math.max(start, periodStart);
      const incEnd = Math.min(end, now);
      if (incEnd > incStart) {
        const impactFactor = inc.severity === Severity.OUTAGE ? 1 : 0.5;
        totalDowntimeMinutes += ((incEnd - incStart) / 60000) * impactFactor;
      }
    });
    return Math.max(0, Math.min(100, parseFloat(((totalMinutes - totalDowntimeMinutes) / totalMinutes * 100).toFixed(3))));
  }, [state.incidents]);

  return (
    <AppContext.Provider value={{
      state, isLoading, switchDashboard,
      fetchAdminData: fetchData,
      getSubscribers: (p, l, s) => (remoteApi as any).getSubscribers(p, l, s),
      addRegion: (n) => wrapAction(() => (remoteApi as any).createRegion(n)),
      removeRegion: (id) => wrapAction(() => (remoteApi as any).deleteRegion(id)),
      addComponent: (rid, n, d) => wrapAction(() => (remoteApi as any).createComponent(rid, n, d)),
      removeComponent: (id) => wrapAction(() => (remoteApi as any).deleteComponent(id)),
      addTemplate: (t) => wrapAction(() => (remoteApi as any).createTemplate(t)),
      updateTemplate: (id, t) => wrapAction(() => (remoteApi as any).updateTemplate(id, t)),
      removeTemplate: (id) => wrapAction(() => (remoteApi as any).deleteTemplate(id)),
      reportIncident: (inc) => wrapAction(() => (remoteApi as any).createIncident(inc)),
      updateIncident: (id, inc) => wrapAction(() => (remoteApi as any).updateIncident(id, inc)),
      resolveIncident: (id) => wrapAction(() => (remoteApi as any).resolveIncident(id)),
      addSubscriber: (e) => wrapAction(() => remoteApi!.createSubscriber(e)),
      updateSubscriber: (id, e) => wrapAction(() => (remoteApi as any).createSubscriber(e)),
      removeSubscriber: (idOrEmail) => wrapAction(() => remoteApi!.deleteSubscriber(idOrEmail)),
      saveNotificationSettings: (s) => wrapAction(() => (remoteApi as any).updateNotificationSettings(s)),
      login, logout, setTimezoneOffset, calculateSLA
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
