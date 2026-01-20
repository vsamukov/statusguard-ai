
-- Initial Regions
INSERT INTO regions (id, name) VALUES 
('a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7', 'North America'),
('b2c3d4e5-f6a7-4890-b1c2-d3e4f5a6b7c8', 'Europe')
ON CONFLICT (id) DO NOTHING;

-- Initial Services
INSERT INTO services (id, region_id, name, description) VALUES 
('c3d4e5f6-a1b2-4c8d-9e0f-1a2b3c4d5e6f', 'a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7', 'Core API', 'Gateway for all application traffic'),
('d4e5f6a1-b2c3-4d9e-0f1a-2b3c4d5e6f1a', 'b2c3d4e5-f6a7-4890-b1c2-d3e4f5a6b7c8', 'Authentication Service', 'User login and token issuance')
ON CONFLICT (id) DO NOTHING;

-- Initial Components
INSERT INTO components (service_id, name, description) VALUES 
('c3d4e5f6-a1b2-4c8d-9e0f-1a2b3c4d5e6f', 'Load Balancer', 'Nginx ingress controller'),
('c3d4e5f6-a1b2-4c8d-9e0f-1a2b3c4d5e6f', 'Primary Database', 'Managed PostgreSQL instance'),
('d4e5f6a1-b2c3-4d9e-0f1a-2b3c4d5e6f1a', 'Identity Provider', 'Auth0 integration layer')
ON CONFLICT DO NOTHING;
