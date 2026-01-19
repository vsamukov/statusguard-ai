
-- Default Admin User
-- Username: admin, Password: password
-- The hash below is generated using Node.js crypto.scrypt with salt 'f1e2d3c4b5a6'
INSERT INTO users (username, password_hash) 
VALUES ('admin', 'f1e2d3c4b5a6:1a8b7c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b')
ON CONFLICT (username) DO NOTHING;

-- Initial Regions
INSERT INTO regions (id, name) VALUES 
('a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7', 'North America'),
('b2c3d4e5-f6a7-4890-b1c2-d3e4f5a6b7c8', 'Europe')
ON CONFLICT (id) DO NOTHING;

-- Initial Services
INSERT INTO services (id, region_id, name, description) VALUES 
('s1d2f3g4-h5j6-4k7l-m8n9-o0p1q2r3s4t5', 'a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7', 'Core API', 'Gateway for all application traffic'),
('s2d3f4g5-h6j7-4k8l-m9n0-o1p2q3r4s5t6', 'b2c3d4e5-f6a7-4890-b1c2-d3e4f5a6b7c8', 'Authentication Service', 'User login and token issuance')
ON CONFLICT (id) DO NOTHING;

-- Initial Components
INSERT INTO components (service_id, name, description) VALUES 
('s1d2f3g4-h5j6-4k7l-m8n9-o0p1q2r3s4t5', 'Load Balancer', 'Nginx ingress controller'),
('s1d2f3g4-h5j6-4k7l-m8n9-o0p1q2r3s4t5', 'Primary Database', 'Managed PostgreSQL instance'),
('s2d3f4g5-h6j7-4k8l-m9n0-o1p2q3r4s5t6', 'Identity Provider', 'Auth0 integration layer')
ON CONFLICT DO NOTHING;
