
import pool from './services/db.js';
import bcrypt from 'bcryptjs';

export const migrateDb = async (isHub: boolean) => {
  if (isHub) return; 
  let client;
  try {
    client = await pool.connect();
    console.log('[DB] Synchronizing schema...');
    
    // Ensure users table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed admin user if not exists
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'password';
    const userCheck = await client.query('SELECT id FROM users WHERE username = $1', [adminUser]);
    if (userCheck.rows.length === 0) {
      console.log(`[DB] Seeding default admin user: ${adminUser}`);
      const hash = await bcrypt.hash(adminPass, 10);
      await client.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [adminUser, hash, 'admin']);
    }

    // Ensure regions table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS regions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure components table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS components (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Add deleted_at column if missing
    const tablesToUpdate = ['regions', 'components', 'incidents'];
    for (const table of tablesToUpdate) {
      const colCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = 'deleted_at'
      `, [table]);
      
      if (colCheck.rows.length === 0) {
        console.log(`[DB] Migrating: Adding 'deleted_at' column to ${table}...`);
        await client.query(`ALTER TABLE ${table} ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE`);
      }
    }

    // Migration: Add last_noc_notified_at column to incidents if missing
    const nocColCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'incidents' 
      AND column_name = 'last_noc_notified_at'
    `);
    
    if (nocColCheck.rows.length === 0) {
      console.log(`[DB] Migrating: Adding 'last_noc_notified_at' column to incidents...`);
      await client.query(`ALTER TABLE incidents ADD COLUMN last_noc_notified_at TIMESTAMP WITH TIME ZONE`);
    }

    // Ensure incidents table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        component_id UUID REFERENCES components(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        severity TEXT NOT NULL CHECK (severity IN ('OPERATIONAL', 'DEGRADED', 'OUTAGE')),
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure incident_affected_components join table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS incident_affected_components (
        incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
        component_id UUID REFERENCES components(id) ON DELETE CASCADE,
        PRIMARY KEY (incident_id, component_id)
      )
    `);

    // Migration: Backfill join table from existing component_id if any
    const existingIncidents = await client.query('SELECT id, component_id FROM incidents WHERE component_id IS NOT NULL');
    for (const inc of existingIncidents.rows) {
      await client.query('INSERT INTO incident_affected_components (incident_id, component_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [inc.id, inc.component_id]);
    }

    // Ensure subscriptions table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure subscription_regions join table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_regions (
        subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
        region_id UUID REFERENCES regions(id) ON DELETE CASCADE,
        PRIMARY KEY (subscription_id, region_id)
      )
    `);

    // Ensure audit_logs table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL,
        action_type TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_name TEXT,
        details TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure templates table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        component_name TEXT NOT NULL,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure notification_settings table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Add Indexes for performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_incidents_component_id ON incidents(component_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_incidents_start_time ON incidents(start_time)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_components_region_id ON components(region_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(email)');

    // Migration: Add all regions to existing subscribers if they have none
    console.log('[DB] Migrating: Adding all regions to existing subscribers...');
    const subscribersWithoutRegions = await client.query(`
      SELECT s.id FROM subscriptions s
      LEFT JOIN subscription_regions sr ON s.id = sr.subscription_id
      WHERE sr.subscription_id IS NULL
    `);
    
    if (subscribersWithoutRegions.rows.length > 0) {
      const allRegions = await client.query('SELECT id FROM regions WHERE deleted_at IS NULL');
      if (allRegions.rows.length > 0) {
        for (const sub of subscribersWithoutRegions.rows) {
          for (const reg of allRegions.rows) {
            await client.query('INSERT INTO subscription_regions (subscription_id, region_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [sub.id, reg.id]);
          }
        }
      }
    }

    // Check if services table exists (old schema)
    const tableCheck = await client.query("SELECT to_regclass('public.services') as exists");
    const hasServicesTable = tableCheck.rows[0].exists !== null;

    // Check if region_id exists on components
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'components' 
      AND column_name = 'region_id'
    `);
    const hasRegionId = columnCheck.rows.length > 0;

    if (!hasRegionId) {
      console.log("[DB] Migrating: Adding 'region_id' column to components...");
      await client.query('ALTER TABLE components ADD COLUMN region_id UUID REFERENCES regions(id) ON DELETE CASCADE');
    }

    if (hasServicesTable) {
      console.log("[DB] Migrating: Re-mapping components directly to regions...");
      // Link components to the region their parent service belonged to
      await client.query(`
        UPDATE components c 
        SET region_id = s.region_id 
        FROM services s 
        WHERE c.service_id = s.id AND c.region_id IS NULL;
      `);
      
      console.log("[DB] Migrating: Dropping legacy services table...");
      await client.query(`
        ALTER TABLE components DROP COLUMN IF EXISTS service_id;
        DROP TABLE IF EXISTS services CASCADE;
      `);
    }

    console.log("[DB] Schema is up-to-date.");
  } catch (err: any) {
    console.error('[DB] Migration failed:', err.message);
  } finally {
    if (client) client.release();
  }
};
