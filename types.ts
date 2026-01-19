
export enum Severity {
  OPERATIONAL = 'OPERATIONAL',
  DEGRADED = 'DEGRADED', // degradation without loss of availability
  OUTAGE = 'OUTAGE'      // complete loss of availability
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
}

export interface Incident {
  id: string;
  componentId: string;
  title: string;
  description: string;
  severity: Severity;
  startTime: string; // ISO string
  endTime: string | null; // null if ongoing
}

export interface AppState {
  regions: Region[];
  services: Service[];
  components: Component[];
  incidents: Incident[];
  isAuthenticated: boolean;
}
