
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

const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
  }
  return res.json();
};

export const api = {
  async getStatus() {
    const res = await fetch(`${API_BASE}/status`);
    return handleResponse(res);
  },

  async login(credentials: any) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return handleResponse(res);
  },

  async getAdminData() {
    const res = await fetch(`${API_BASE}/admin/data`, { headers: getHeaders() });
    return handleResponse(res);
  },

  // Templates
  async createTemplate(template: any) {
    const res = await fetch(`${API_BASE}/admin/templates`, { 
      method: 'POST', 
      headers: getHeaders(), 
      body: JSON.stringify(template) 
    });
    return handleResponse(res);
  },

  async updateTemplate(id: string, template: any) {
    const res = await fetch(`${API_BASE}/admin/templates/${id}`, { 
      method: 'PUT', 
      headers: getHeaders(), 
      body: JSON.stringify(template) 
    });
    return handleResponse(res);
  },

  async deleteTemplate(id: string) {
    const res = await fetch(`${API_BASE}/admin/templates/${id}`, { 
      method: 'DELETE', 
      headers: getHeaders() 
    });
    return handleResponse(res);
  },

  // Subscriptions (Public)
  async subscribe(email: string) {
    const res = await fetch(`${API_BASE}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return handleResponse(res);
  },

  async unsubscribe(email: string) {
    const res = await fetch(`${API_BASE}/subscriptions/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return handleResponse(res);
  },

  // Subscriptions (Admin)
  async createSubscriber(email: string) {
    const res = await fetch(`${API_BASE}/admin/subscriptions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email })
    });
    return handleResponse(res);
  },

  async updateSubscriber(id: string, email: string) {
    const res = await fetch(`${API_BASE}/admin/subscriptions/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ email })
    });
    return handleResponse(res);
  },

  async deleteSubscriber(id: string) {
    const res = await fetch(`${API_BASE}/admin/subscriptions/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async updateNotificationSettings(settings: any) {
    const res = await fetch(`${API_BASE}/admin/notification-settings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(settings)
    });
    return handleResponse(res);
  },

  // Infrastructure
  async createUser(user: any) {
    const res = await fetch(`${API_BASE}/admin/users`, { 
      method: 'POST', 
      headers: getHeaders(), 
      body: JSON.stringify(user) 
    });
    return handleResponse(res);
  },

  async deleteUser(id: string) {
    const res = await fetch(`${API_BASE}/admin/users/${id}`, { 
      method: 'DELETE', 
      headers: getHeaders() 
    });
    return handleResponse(res);
  },

  async createRegion(name: string) {
    const res = await fetch(`${API_BASE}/admin/regions`, { 
      method: 'POST', 
      headers: getHeaders(), 
      body: JSON.stringify({ name }) 
    });
    return handleResponse(res);
  },

  async deleteRegion(id: string) {
    const res = await fetch(`${API_BASE}/admin/regions/${id}`, { 
      method: 'DELETE', 
      headers: getHeaders() 
    });
    return handleResponse(res);
  },

  async createService(regionId: string, name: string, description: string) {
    const res = await fetch(`${API_BASE}/admin/services`, { 
      method: 'POST', 
      headers: getHeaders(), 
      body: JSON.stringify({ regionId, name, description }) 
    });
    return handleResponse(res);
  },

  async deleteService(id: string) {
    const res = await fetch(`${API_BASE}/admin/services/${id}`, { 
      method: 'DELETE', 
      headers: getHeaders() 
    });
    return handleResponse(res);
  },

  async createComponent(serviceId: string, name: string, description: string) {
    const res = await fetch(`${API_BASE}/admin/components`, { 
      method: 'POST', 
      headers: getHeaders(), 
      body: JSON.stringify({ serviceId, name, description }) 
    });
    return handleResponse(res);
  },

  async deleteComponent(id: string) {
    const res = await fetch(`${API_BASE}/admin/components/${id}`, { 
      method: 'DELETE', 
      headers: getHeaders() 
    });
    return handleResponse(res);
  },

  async createIncident(incident: any) {
    const res = await fetch(`${API_BASE}/admin/incidents`, { 
      method: 'POST', 
      headers: getHeaders(), 
      body: JSON.stringify(incident) 
    });
    return handleResponse(res);
  },

  async updateIncident(id: string, incident: any) {
    const res = await fetch(`${API_BASE}/admin/incidents/${id}`, { 
      method: 'PUT', 
      headers: getHeaders(), 
      body: JSON.stringify(incident) 
    });
    return handleResponse(res);
  },

  async resolveIncident(id: string) {
    const res = await fetch(`${API_BASE}/admin/incidents/${id}/resolve`, { 
      method: 'POST', 
      headers: getHeaders() 
    });
    return handleResponse(res);
  }
};
