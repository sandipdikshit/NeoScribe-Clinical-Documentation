-- Create users table (providers)
CREATE TABLE IF NOT EXISTS {schema}.users (
    iUserId INTEGER PRIMARY KEY,
    vName VARCHAR(100) NOT NULL,
    vEmail VARCHAR(250) NOT NULL UNIQUE,
    txPassword TEXT NOT NULL,
    iOTP INTEGER,
    vSpeciality VARCHAR(100) NOT NULL,
    isVerified BOOLEAN,
    tiStatus INTEGER NOT NULL DEFAULT 1,
    iCreatedAt INTEGER NOT NULL,
    iUpdatedAt INTEGER NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON {schema}.users(vEmail);
CREATE INDEX IF NOT EXISTS idx_users_speciality ON {schema}.users(vSpeciality);

-- Add comments
COMMENT ON TABLE {schema}.users IS 'Stores provider/user information';
COMMENT ON COLUMN {schema}.users.iUserId IS 'Primary key for the user';
COMMENT ON COLUMN {schema}.users.vName IS 'Name of the provider';
COMMENT ON COLUMN {schema}.users.vEmail IS 'Email address of the provider';
COMMENT ON COLUMN {schema}.users.txPassword IS 'Hashed password';
COMMENT ON COLUMN {schema}.users.iOTP IS 'One-time password for verification';
COMMENT ON COLUMN {schema}.users.vSpeciality IS 'Medical specialty of the provider';
COMMENT ON COLUMN {schema}.users.isVerified IS 'Whether the provider is verified';
COMMENT ON COLUMN {schema}.users.tiStatus IS 'Status of the provider account';
COMMENT ON COLUMN {schema}.users.iCreatedAt IS 'Timestamp when the account was created';
COMMENT ON COLUMN {schema}.users.iUpdatedAt IS 'Timestamp when the account was last updated'; 