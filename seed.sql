
-- Clear existing data for fresh seed (optional but good for testing)
TRUNCATE TABLE incidents, components, services, regions CASCADE;

-- Initial Regions (Established 120 days ago)
INSERT INTO regions (id, name, created_at) VALUES 
('a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7', 'North America', NOW() - INTERVAL '120 days'),
('b2c3d4e5-f6a7-4890-b1c2-d3e4f5a6b7c8', 'Europe', NOW() - INTERVAL '120 days')
ON CONFLICT (id) DO NOTHING;

-- Initial Services (Established 110 days ago)
INSERT INTO services (id, region_id, name, description, created_at) VALUES 
('c3d4e5f6-a1b2-4c8d-9e0f-1a2b3c4d5e6f', 'a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7', 'Core API', 'Gateway for all application traffic', NOW() - INTERVAL '110 days'),
('d4e5f6a1-b2c3-4d9e-0f1a-2b3c4d5e6f1a', 'b2c3d4e5-f6a7-4890-b1c2-d3e4f5a6b7c8', 'Authentication Service', 'User login and token issuance', NOW() - INTERVAL '110 days')
ON CONFLICT (id) DO NOTHING;

-- Initial Components (Established 100 days ago)
INSERT INTO components (id, service_id, name, description, created_at) VALUES 
('f1e2d3c4-b5a6-4789-a0b1-c2d3e4f5a6b7', 'c3d4e5f6-a1b2-4c8d-9e0f-1a2b3c4d5e6f', 'Load Balancer', 'Nginx ingress controller', NOW() - INTERVAL '100 days'),
('e2d3c4b5-a6f7-4890-b1c2-d3e4f5a6b7c8', 'c3d4e5f6-a1b2-4c8d-9e0f-1a2b3c4d5e6f', 'Primary Database', 'Managed PostgreSQL instance', NOW() - INTERVAL '100 days'),
('d3c4b5a6-f7e8-4901-c2d3-e4f5a6b7c8d9', 'd4e5f6a1-b2c3-4d9e-0f1a-2b3c4d5e6f1a', 'Identity Provider', 'Auth0 integration layer', NOW() - INTERVAL '100 days')
ON CONFLICT (id) DO NOTHING;

-- Sample Incidents

-- 1. Historical Major Outage for Primary Database (10 days ago)
INSERT INTO incidents (id, component_id, title, description, severity, start_time, end_time) VALUES
(gen_random_uuid(), 'e2d3c4b5-a6f7-4890-b1c2-d3e4f5a6b7c8', 
 'Database Connectivity Issue', 
 'We experienced a major outage due to a failed failover event. Replication was restored and services are back to normal.', 
 'OUTAGE', 
 NOW() - INTERVAL '10 days 4 hours', 
 NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

-- 2. Recent Performance Degradation for Load Balancer (2 days ago)
INSERT INTO incidents (id, component_id, title, description, severity, start_time, end_time) VALUES
(gen_random_uuid(), 'f1e2d3c4-b5a6-4789-a0b1-c2d3e4f5a6b7', 
 'Increased Latency in North America', 
 'Some users may have experienced slower response times due to a regional networking issue. Traffic was rerouted and latency has stabilized.', 
 'DEGRADED', 
 NOW() - INTERVAL '2 days 1 hour', 
 NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

-- 3. Older Resolved Incident for Identity Provider (45 days ago)
INSERT INTO incidents (id, component_id, title, description, severity, start_time, end_time) VALUES
(gen_random_uuid(), 'd3c4b5a6-f7e8-4901-c2d3-e4f5a6b7c8d9', 
 'Scheduled Maintenance: IDP Upgrade', 
 'The Identity Provider underwent scheduled maintenance to improve security protocols. All systems are fully operational.', 
 'DEGRADED', 
 NOW() - INTERVAL '45 days 2 hours', 
 NOW() - INTERVAL '45 days')
ON CONFLICT (id) DO NOTHING;

-- 4. ACTIVE Major Outage for Identity Provider (Started 30 minutes ago)
INSERT INTO incidents (id, component_id, title, description, severity, start_time, end_time) VALUES
(gen_random_uuid(), 'd3c4b5a6-f7e8-4901-c2d3-e4f5a6b7c8d9', 
 'Identity Provider Service Disruption', 
 'We are currently investigating reports of authentication failures. Our team is working with the upstream provider to resolve the issue as quickly as possible.', 
 'OUTAGE', 
 NOW() - INTERVAL '30 minutes', 
 NULL)
ON CONFLICT (id) DO NOTHING;
