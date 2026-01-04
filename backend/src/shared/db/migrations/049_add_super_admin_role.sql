-- Add super_admin role for elevated access (Control Center, AI Workers management)
-- Super admins have access to sensitive system-wide data and controls

-- Drop existing constraint if it exists
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

-- Add constraint with super_admin role
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'user', 'super_admin'));

-- Promote jarod to super admin
UPDATE users SET role = 'super_admin' WHERE email = 'jarod.rosenthal@protonmail.com';
