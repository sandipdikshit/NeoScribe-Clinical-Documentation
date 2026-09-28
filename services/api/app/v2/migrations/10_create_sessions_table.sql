-- create sessions table
CREATE TABLE IF NOT EXISTS ${schema_name_name}.sessions (
    iSessionId UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iUserId INTEGER REFERENCES ${schema_name_name}.users("iUserId") ON DELETE CASCADE NOT NULL,
    txTokenHash text,
    txUserAgent text,
    vIPAddress VARCHAR(50),
    txDeviceId text,
    isRevoked BOOLEAN default FALSE not null,
    tiStatus smallint not null default 1,
    iExpiresAt INTEGER not null,
    iCreatedAt INTEGER NOT NULL,
    iUpdatedAt INTEGER NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_session_provider ON ${schema_name}.sessions(iUserId);
CREATE INDEX IF NOT EXISTS idx_session_device ON ${schema_name}.sessions(txDeviceId, vIPAddress);
CREATE INDEX IF NOT EXISTS idx_session_revoked_status ON ${schema_name}.sessions(isRevoked, tiStatus);
CREATE INDEX IF NOT EXISTS idx_session_created ON ${schema_name}.sessions(iCreatedAt);

-- Add comments
COMMENT ON TABLE ${schema_name}.sessions IS 'Stores user sessions for authentication and authorization';
COMMENT ON COLUMN ${schema_name}.sessions."iSessionId" IS 'Primary key for the session';
COMMENT ON COLUMN ${schema_name}.sessions."iUserId" IS 'Foreign key to the user who owns the session';
COMMENT ON COLUMN ${schema_name}.sessions."txTokenHash" IS 'Hash of the session token for security';
COMMENT ON COLUMN ${schema_name}.sessions."txUserAgent" IS 'User agent string of the session';
COMMENT ON COLUMN ${schema_name}.sessions."vIPAddress" IS 'IP address associated with the session';
COMMENT ON COLUMN ${schema_name}.sessions."txDeviceId" IS 'Device identifier for the session';
COMMENT ON COLUMN ${schema_name}.sessions."isRevoked" IS 'Indicates if the session has been revoked';
COMMENT ON COLUMN ${schema_name}.sessions."tiStatus" IS 'Status of the session (e.g, active, expired)';
COMMENT ON COLUMN ${schema_name}.sessions."iExpiresAt" IS 'Timestamp when the session expires';
COMMENT ON COLUMN ${schema_name}.sessions."iCreatedAt" IS 'Timestamp when the session was created';
COMMENT ON COLUMN ${schema_name}.sessions."iUpdatedAt" IS 'Timestamp when the session was last updated';
