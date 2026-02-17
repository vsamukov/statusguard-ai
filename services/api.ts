
import { RemoteDashboardConfig } from '../types.ts';

const TOKEN_KEY = 'voximplant_portal_token';

const handleResponse = async (res: Response, url: string) => {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
  }
  return res.json();
};

export const nodeApi = {
  async getStatus() {
    const url = `/api/status`;
    const res = await fetch(url);
    return handleResponse(res, url);
  },
  async createSubscriber(email: string) {
    const url = `/api/admin/subscriptions`;
    const res = await fetch(url, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }) 
    });
    return handleResponse(res, url);
  },
  async deleteSubscriber(email: string) {
    const url = `/api/admin/subscriptions/by-email`;
    const res = await fetch(url, { 
      method: 'DELETE', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }) 
    });
    return handleResponse(res, url);
  }
};

export const createRemoteApi = (config: RemoteDashboardConfig) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-ADMIN-SECRET': config.adminSecret,
  };
  const base = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;

  return {
    async getStatus() {
      const url = `${base}/api/status`;
      const res = await fetch(url, { headers, mode: 'cors' });
      return handleResponse(res, url);
    },
    async getAdminData() {
      const url = `${base}/api/admin/data`;
      const res = await fetch(url, { headers, mode: 'cors' });
      return handleResponse(res, url);
    },
    async getSubscribers(page = 1, limit = 10, search = '') {
      const query = new URLSearchParams({ page: String(page), limit: String(limit), search }).toString();
      const url = `${base}/api/admin/subscribers?${query}`;
      const res = await fetch(url, { headers, mode: 'cors' });
      return handleResponse(res, url);
    },
    async createTemplate(template: any) {
      const url = `${base}/api/admin/templates`;
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(template) });
      return handleResponse(res, url);
    },
    async updateTemplate(id: string, template: any) {
      const url = `${base}/api/admin/templates/${id}`;
      const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(template) });
      return handleResponse(res, url);
    },
    async deleteTemplate(id: string) {
      const url = `${base}/api/admin/templates/${id}`;
      const res = await fetch(url, { method: 'DELETE', headers });
      return handleResponse(res, url);
    },
    async createSubscriber(email: string) {
      const url = `${base}/api/admin/subscriptions`;
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ email }) });
      return handleResponse(res, url);
    },
    async deleteSubscriber(id: string) {
      const url = `${base}/api/admin/subscriptions/${id}`;
      const res = await fetch(url, { method: 'DELETE', headers });
      return handleResponse(res, url);
    },
    async updateNotificationSettings(settings: any) {
      const url = `${base}/api/admin/notification-settings`;
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(settings) });
      return handleResponse(res, url);
    },
    async createRegion(name: string) {
      const url = `${base}/api/admin/regions`;
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ name }) });
      return handleResponse(res, url);
    },
    async deleteRegion(id: string) {
      const url = `${base}/api/admin/regions/${id}`;
      const res = await fetch(url, { method: 'DELETE', headers });
      return handleResponse(res, url);
    },
    async createComponent(regionId: string, name: string, description: string) {
      const url = `${base}/api/admin/components`;
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ regionId, name, description }) });
      return handleResponse(res, url);
    },
    async deleteComponent(id: string) {
      const url = `${base}/api/admin/components/${id}`;
      const res = await fetch(url, { method: 'DELETE', headers });
      return handleResponse(res, url);
    },
    async createIncident(incident: any) {
      const url = `${base}/api/admin/incidents`;
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(incident) });
      return handleResponse(res, url);
    },
    async updateIncident(id: string, incident: any) {
      const url = `${base}/api/admin/incidents/${id}`;
      const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(incident) });
      return handleResponse(res, url);
    },
    async resolveIncident(id: string) {
      const url = `${base}/api/admin/incidents/${id}/resolve`;
      const res = await fetch(url, { method: 'POST', headers });
      return handleResponse(res, url);
    }
  };
};

export const portalApi = {
  async login(credentials: any) {
    const url = `/api/portal/auth`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return handleResponse(res, url);
  },
  async getDashboardConfigs() {
    const url = `/api/portal/configs`;
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    return handleResponse(res, url);
  }
};
