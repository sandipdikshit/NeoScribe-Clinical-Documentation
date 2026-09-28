-- Add role_id field to users table
ALTER TABLE ${schema_name}.users 
ADD COLUMN role_id UUID REFERENCES ${schema_name}.roles(role_id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_role_id ON ${schema_name}.users(role_id);

-- Add comment
COMMENT ON COLUMN ${schema_name}.users.role_id IS 'Foreign key to the role assigned to the user';

-- Update existing users to have a default role (optional - you may want to handle this differently)
-- This assumes you have a default role created in the roles table
-- UPDATE ${schema_name}.users SET role_id = (SELECT role_id FROM ${schema_name}.roles WHERE role_name = 'DEFAULT_ROLE' LIMIT 1) WHERE role_id IS NULL; 