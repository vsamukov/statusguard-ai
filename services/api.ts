
import { RemoteDashboardConfig } from '../types.ts';

const TOKEN_KEY = 'voximplant_portal_token';

// Utility to handle API responses consistently
const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
  }
  return res.json();
};

// This API client is used by the Admin Portal to talk to the specific Dashboard Nodes
export const createRemoteApi = (config: RemoteDashboardConfig) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-ADMIN-SECRET': config.adminSecret, // The master key for the specific dashboard node
  };

  const base = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;

  return {
    async getStatus() {
      const res = await fetch(`${base}/api/status`, { headers });
      return handleResponse(res);
    },

    async getAdminData() {
      const res = await fetch(`${base}/api/admin/data`, { headers });
      return handleResponse(res);
    },

    async getSubscribers(page = 1, limit = 10, search = '') {
      const query = new URLSearchParams({ page: String(page), limit: String(limit), search }).toString();
      const res = await fetch(`${base}/api/admin/subscribers?${query}`, { headers });
      return handleResponse(res);
    },

    async createTemplate(template: any) {
      const res = await fetch(`${base}/api/admin/templates`, { method: 'POST', headers, body: JSON.stringify(template) });
      return handleResponse(res);
    },

    async updateTemplate(id: string, template: any) {
      const res = await fetch(`${base}/api/admin/templates/${id}`, { method: 'PUT', headers, body: JSON.stringify(template) });
      return handleResponse(res);
    },

    async deleteTemplate(id: string) {
      const res = await fetch(`${base}/api/admin/templates/${id}`, { method: 'DELETE', headers });
      return handleResponse(res);
    },

    async createSubscriber(email: string) {
      const res = await fetch(`${base}/api/admin/subscriptions`, { method: 'POST', headers, body: JSON.stringify({ email }) });
      return handleResponse(res);
    },

    async deleteSubscriber(id: string) {
      const res = await fetch(`${base}/api/admin/subscriptions/${id}`, { method: 'DELETE', headers });
      return handleResponse(res);
    },

    async updateNotificationSettings(settings: any) {
      const res = await fetch(`${base}/api/admin/notification-settings`, { method: 'POST', headers, body: JSON.stringify(settings) });
      return handleResponse(res);
    },

    async createRegion(name: string) {
      const res = await fetch(`${base}/api/admin/regions`, { method: 'POST', headers, body: JSON.stringify({ name }) });
      return handleResponse(res);
    },

    async deleteRegion(id: string) {
      const res = await fetch(`${base}/api/admin/regions/${id}`, { method: 'DELETE', headers });
      return handleResponse(res);
    },

    async createService(regionId: string, name: string, description: string) {
      const res = await fetch(`${base}/api/admin/services`, { method: 'POST', headers, body: JSON.stringify({ regionId, name, description }) });
      return handleResponse(res);
    },

    async deleteService(id: string) {
      const res = await fetch(`${base}/api/admin/services/${id}`, { method: 'DELETE', headers });
      return handleResponse(res);
    },

    async createComponent(serviceId: string, name: string, description: string) {
      const res = await fetch(`${base}/api/admin/components`, { method: 'POST', headers, body: JSON.stringify({ serviceId, name, description }) });
      return handleResponse(res);
    },

    async deleteComponent(id: string) {
      const res = await fetch(`${base}/api/admin/components/${id}`, { method: 'DELETE', headers });
      return handleResponse(res);
    },

    async createIncident(incident: any) {
      const res = await fetch(`${base}/api/admin/incidents`, { method: 'POST', headers, body: JSON.stringify(incident) });
      return handleResponse(res);
    },

    async updateIncident(id: string, incident: any) {
      const res = await fetch(`${base}/api/admin/incidents/${id}`, { method: 'PUT', headers, body: JSON.stringify(incident) });
      return handleResponse(res);
    },

    async resolveIncident(id: string) {
      const res = await fetch(`${base}/api/admin/incidents/${id}/resolve`, { method: 'POST', headers });
      return handleResponse(res);
    }
  };
};

// Internal API for the Admin Portal Hub itself
export const portalApi = {
  async login(credentials: any) {
    const res = await fetch(`/api/portal/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return handleResponse(res);
  },
  async getDashboardConfigs() {
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch(`/api/portal/configs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleResponse(res);
  }
};
