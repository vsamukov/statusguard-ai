
const API_BASE = '/api';

const TOKEN_KEY = 'voximplant_status_token';

const getHeaders = (skipAuth = false) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (!skipAuth) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  async getStatus() {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error('Failed to fetch status');
    return res.json();
  },

  async login(credentials: any) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    return res.json();
  },

  async getAdminData() {
    const res = await fetch(`${API_BASE}/admin/data`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch admin data');
    return res.json();
  },

  async createUser(user: any) {
    const res = await fetch(`${API_BASE}/admin/users`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(user) });
    return res.json();
  },

  async deleteUser(id: string) {
    const res = await fetch(`${API_BASE}/admin/users/${id}`, { method: 'DELETE', headers: getHeaders() });
    return res.json();
  },

  async createRegion(name: string) {
    const res = await fetch(`${API_BASE}/admin/regions`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ name }) });
    return res.json();
  },

  async deleteRegion(id: string) {
    const res = await fetch(`${API_BASE}/admin/regions/${id}`, { method: 'DELETE', headers: getHeaders() });
    return res.json();
  },

  async createService(regionId: string, name: string, description: string) {
    const res = await fetch(`${API_BASE}/admin/services`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ regionId, name, description }) });
    return res.json();
  },

  async deleteService(id: string) {
    const res = await fetch(`${API_BASE}/admin/services/${id}`, { method: 'DELETE', headers: getHeaders() });
    return res.json();
  },

  async createComponent(serviceId: string, name: string, description: string) {
    const res = await fetch(`${API_BASE}/admin/components`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ serviceId, name, description }) });
    return res.json();
  },

  async deleteComponent(id: string) {
    const res = await fetch(`${API_BASE}/admin/components/${id}`, { method: 'DELETE', headers: getHeaders() });
    return res.json();
  },

  async createIncident(incident: any) {
    const res = await fetch(`${API_BASE}/admin/incidents`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(incident) });
    return res.json();
  },

  async updateIncident(id: string, incident: any) {
    const res = await fetch(`${API_BASE}/admin/incidents/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(incident) });
    if (!res.ok) throw new Error('Failed to update incident');
    return res.json();
  },

  async resolveIncident(id: string) {
    const res = await fetch(`${API_BASE}/admin/incidents/${id}/resolve`, { method: 'POST', headers: getHeaders() });
    return res.json();
  }
};
