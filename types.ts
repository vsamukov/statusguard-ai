
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

export interface AppState {
  regions: Region[];
  services: Service[];
  components: Component[];
  incidents: Incident[];
  isAuthenticated: boolean;
}
