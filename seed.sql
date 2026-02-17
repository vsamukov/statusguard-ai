
-- Clear existing data for fresh seed
TRUNCATE TABLE incidents, components, regions, audit_logs CASCADE;

-- Initial Regions (Established 120 days ago)
INSERT INTO regions (id, name, created_at) VALUES 
('a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7', 'North America', NOW() - INTERVAL '120 days'),
('b2c3d4e5-f6a7-4890-b1c2-d3e4f5a6b7c8', 'Europe', NOW() - INTERVAL '120 days')
ON CONFLICT (id) DO NOTHING;

-- Initial Components (Established 100 days ago) linked directly to Regions
INSERT INTO components (id, region_id, name, description, created_at) VALUES 
('f1e2d3c4-b5a6-4789-a0b1-c2d3e4f5a6b7', 'a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7', 'API Gateway', 'Core ingress points for NA', NOW() - INTERVAL '100 days'),
('e2d3c4b5-a6f7-4890-b1c2-d3e4f5a6b7c8', 'a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7', 'Customer DB', 'NA shard PostgreSQL', NOW() - INTERVAL '100 days'),
('d3c4b5a6-f7e8-4901-c2d3-e4f5a6b7c8d9', 'b2c3d4e5-f6a7-4890-b1c2-d3e4f5a6b7c8', 'Auth Cluster', 'Central authentication for EU', NOW() - INTERVAL '100 days')
ON CONFLICT (id) DO NOTHING;

-- Initial Audit Logs
INSERT INTO audit_logs (username, action_type, target_type, target_name, details, created_at) VALUES 
('system', 'INITIAL_SEED', 'DATABASE', 'Schema', '{"message": "Seed data loaded successfully"}', NOW() - INTERVAL '100 days'),
('admin', 'LOGIN', 'USER', 'admin', '{"ip": "127.0.0.1"}', NOW() - INTERVAL '1 day');

-- Sample Incidents
INSERT INTO incidents (id, component_id, title, description, severity, start_time, end_time) VALUES
(gen_random_uuid(), 'e2d3c4b5-a6f7-4890-b1c2-d3e4f5a6b7c8', 
 'NA Database Latency', 
 'Increased latency detected on the primary North American database shard. Automatic failover has completed.', 
 'DEGRADED', 
 NOW() - INTERVAL '10 days 4 hours', 
 NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO incidents (id, component_id, title, description, severity, start_time, end_time) VALUES
(gen_random_uuid(), 'd3c4b5a6-f7e8-4901-c2d3-e4f5a6b7c8d9', 
 'EU Auth Service Disruption', 
 'Major disruption in identity verification across European clusters.', 
 'OUTAGE', 
 NOW() - INTERVAL '45 minutes', 
 NULL)
ON CONFLICT (id) DO NOTHING;
