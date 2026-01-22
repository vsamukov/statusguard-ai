
export enum Severity {
  OPERATIONAL = 'OPERATIONAL',
  DEGRADED = 'DEGRADED',
  OUTAGE = 'OUTAGE'
}

export interface Region {
  id: string;
  name: string;
}

export interface Service {
  id: string;
  regionId: string;
  name: string;
  description: string;
}

export interface Component {
  id: string;
  serviceId: string;
  name: string;
  description: string;
  sla90?: number; // 90-day availability percentage
  createdAt?: string;
}

export interface Template {
  id: string;
  componentId: string;
  name: string;
  title: string;
  description: string;
}

export interface Incident {
  id: string;
  componentId: string;
  title: string;
  description: string;
  severity: Severity;
  startTime: string;
  endTime: string | null;
}

export interface AdminUser {
  id: string;
  username: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  username: string;
  actionType: string;
  targetType: string;
  targetName: string;
  details: any;
  createdAt: string;
}

export interface AppState {
  regions: Region[];
  services: Service[];
  components: Component[];
  templates: Template[];
  incidents: Incident[];
  users: AdminUser[];
  auditLogs: AuditLog[];
  isAuthenticated: boolean;
  currentUser?: string;
  timezoneOffset: number; // Offset in minutes from UTC
}
