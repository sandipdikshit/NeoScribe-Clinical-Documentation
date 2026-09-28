-- Create audit_logs table
CREATE TABLE IF NOT EXISTS {schema}.audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id INTEGER REFERENCES {schema}.users(iUserId) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_provider ON {schema}.audit_logs(provider_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON {schema}.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON {schema}.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON {schema}.audit_logs(created_at);

-- Add comments
COMMENT ON TABLE {schema}.audit_logs IS 'Stores audit logs for all system activities';
COMMENT ON COLUMN {schema}.audit_logs.log_id IS 'Primary key for the audit log';
COMMENT ON COLUMN {schema}.audit_logs.provider_id IS 'Foreign key to the provider who performed the action';
COMMENT ON COLUMN {schema}.audit_logs.action IS 'Action performed (e.g., CREATE, UPDATE, DELETE)';
COMMENT ON COLUMN {schema}.audit_logs.resource_type IS 'Type of resource being acted upon';
COMMENT ON COLUMN {schema}.audit_logs.resource_id IS 'ID of the resource being acted upon';
COMMENT ON COLUMN {schema}.audit_logs.details IS 'Additional details about the action in JSON format';
COMMENT ON COLUMN {schema}.audit_logs.ip_address IS 'IP address of the request';
COMMENT ON COLUMN {schema}.audit_logs.user_agent IS 'User agent of the request';
COMMENT ON COLUMN {schema}.audit_logs.created_at IS 'Timestamp when the log was created'; 