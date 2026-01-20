
const API_BASE = '/api';

const getHeaders = (skipAuth = false) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (!skipAuth) {
    const token = localStorage.getItem('statusguard_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
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
    // We explicitly don't send existing tokens during the login request itself
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    
    if (!res.ok) {
      if (res.status === 401) throw new Error('Invalid username or password');
      throw new Error('Authentication service unavailable');
    }
    
    return res.json();
  },

  async createRegion(name: string) {
    const res = await fetch(`${API_BASE}/admin/regions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Permission denied');
    return res.json();
  },

  // Fix: Added updateRegion method to resolve store.tsx error on line 58
  async updateRegion(id: string, name: string) {
    const res = await fetch(`${API_BASE}/admin/regions/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Permission denied');
    return res.json();
  },

  // Fix: Added deleteRegion method to resolve store.tsx error on line 63
  async deleteRegion(id: string) {
    const res = await fetch(`${API_BASE}/admin/regions/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Permission denied');
    return res.json();
  },

  // Fix: Added createService method to resolve store.tsx error on line 68
  async createService(regionId: string, name: string, description: string) {
    const res = await fetch(`${API_BASE}/admin/services`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ regionId, name, description }),
    });
    if (!res.ok) throw new Error('Failed to create service');
    return res.json();
  },

  // Fix: Added updateService method to resolve store.tsx error on line 73
  async updateService(id: string, name: string, description: string) {
    const res = await fetch(`${API_BASE}/admin/services/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) throw new Error('Failed to update service');
    return res.json();
  },

  // Fix: Added deleteService method to resolve store.tsx error on line 78
  async deleteService(id: string) {
    const res = await fetch(`${API_BASE}/admin/services/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete service');
    return res.json();
  },

  // Fix: Added createComponent method to resolve store.tsx error on line 83
  async createComponent(serviceId: string, name: string, description: string) {
    const res = await fetch(`${API_BASE}/admin/components`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ serviceId, name, description }),
    });
    if (!res.ok) throw new Error('Failed to create component');
    return res.json();
  },

  // Fix: Added updateComponent method to resolve store.tsx error on line 88
  async updateComponent(id: string, name: string, description: string) {
    const res = await fetch(`${API_BASE}/admin/components/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) throw new Error('Failed to update component');
    return res.json();
  },

  // Fix: Added deleteComponent method to resolve store.tsx error on line 93
  async deleteComponent(id: string) {
    const res = await fetch(`${API_BASE}/admin/components/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete component');
    return res.json();
  },

  async createIncident(incident: { componentId: string, title: string, internalDesc: string, severity: string }) {
    const res = await fetch(`${API_BASE}/admin/incidents`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(incident),
    });
    if (!res.ok) throw new Error('Permission denied');
    return res.json();
  },

  async resolveIncident(id: string) {
    const res = await fetch(`${API_BASE}/admin/incidents/${id}/resolve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Permission denied');
    return res.json();
  }
};
