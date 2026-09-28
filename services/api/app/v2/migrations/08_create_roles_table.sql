-- Create roles table
CREATE TABLE IF NOT EXISTS {schema}.roles (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(50) NOT NULL UNIQUE,
    permissions JSONB,
    role_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_role_status ON {schema}.roles(role_status);
CREATE INDEX IF NOT EXISTS idx_role_name ON {schema}.roles(role_name);

-- Add comments
COMMENT ON TABLE {schema}.roles IS 'Stores roles and permissions for users';
COMMENT ON COLUMN {schema}.roles.role_id IS 'Primary key for the role';
COMMENT ON COLUMN {schema}.roles.role_name IS 'Name of the role, must be unique';
COMMENT ON COLUMN {schema}.roles.permissions IS 'JSON object containing permissions associated with the role';
COMMENT ON COLUMN {schema}.roles.role_status IS 'Status of the role (e.g., ACTIVE, INACTIVE)';
COMMENT ON COLUMN {schema}.roles.created_at IS 'Timestamp when the role was created';
COMMENT ON COLUMN {schema}.roles.updated_at IS 'Timestamp when the role was last updated';