
import 'dotenv/config';

export const MODE = process.env.MODE || 'NODE';
export const IS_HUB = MODE.toUpperCase() === 'HUB' || process.env.IS_HUB === 'true';
export const JWT_SECRET = process.env.JWT_SECRET || 'voximplant-enterprise-default-secret';
export const PORT = parseInt(process.env.PORT || '3000');

export const ADMIN_USER = process.env.ADMIN_USER || 'admin';
export const ADMIN_PASS = process.env.ADMIN_PASS || 'password';
export const ADMIN_SECRET = process.env.ADMIN_SECRET || 'secret-node-1';

// Parse HUB Users
let hubUsers: Record<string, string> = { [ADMIN_USER]: ADMIN_PASS };
try {
  const raw = (process.env.HUB_USERS || '{}').trim();
  const parsed = JSON.parse(raw);
  hubUsers = { ...hubUsers, ...parsed };
} catch (e) {
  console.error('[CONFIG] Failed to parse HUB_USERS:', e);
}
export const HUB_USERS = hubUsers;

// Parse Dashboards
let dashboards: any[] = [];
try {
  let raw = (process.env.DASHBOARDS || '[]').trim();
  if (raw.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1);
  if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
  dashboards = JSON.parse(raw);
} catch (e) {
  console.error('[CONFIG] Failed to parse DASHBOARDS:', e);
}

export const DASHBOARD_CONFIGS = dashboards;
