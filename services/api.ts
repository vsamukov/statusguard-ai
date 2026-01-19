
const API_BASE = '/api';

const getHeaders = () => {
  const token = localStorage.getItem('statusguard_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

export const api = {
  async getStatus() {
    const res = await fetch(`${API_BASE}/status`);
    return res.json();
  },

  async login(credentials: any) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(credentials),
    });
    if (!res.ok) throw new Error('Auth failed');
    return res.json();
  },

  async createRegion(name: string) {
    const res = await fetch(`${API_BASE}/admin/regions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    return res.json();
  },

  async updateRegion(id: string, name: string) {
    const res = await fetch(`${API_BASE}/admin/regions/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    return res.json();
  },

  async deleteRegion(id: string) {
    await fetch(`${API_BASE}/admin/regions/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  },

  async createService(regionId: string, name: string, description: string) {
    const res = await fetch(`${API_BASE}/admin/services`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ regionId, name, description }),
    });
    return res.json();
  },

  async updateService(id: string, name: string, description: string) {
    const res = await fetch(`${API_BASE}/admin/services/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name, description }),
    });
    return res.json();
  },

  async deleteService(id: string) {
    await fetch(`${API_BASE}/admin/services/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  },

  async createComponent(serviceId: string, name: string, description: string) {
    const res = await fetch(`${API_BASE}/admin/components`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ serviceId, name, description }),
    });
    return res.json();
  },

  async updateComponent(id: string, name: string, description: string) {
    const res = await fetch(`${API_BASE}/admin/components/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name, description }),
    });
    return res.json();
  },

  async deleteComponent(id: string) {
    await fetch(`${API_BASE}/admin/components/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  },

  async createIncident(incident: { componentId: string, title: string, internalDesc: string, severity: string }) {
    const res = await fetch(`${API_BASE}/admin/incidents`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(incident),
    });
    return res.json();
  },

  async resolveIncident(id: string) {
    const res = await fetch(`${API_BASE}/admin/incidents/${id}/resolve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  }
};
