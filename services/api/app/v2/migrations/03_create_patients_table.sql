-- Create patients table
CREATE TABLE IF NOT EXISTS {schema}.patients (
    patient_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id INTEGER REFERENCES {schema}.users(iUserId) ON DELETE CASCADE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) NOT NULL,
    email VARCHAR(250),
    phone VARCHAR(20),
    address TEXT,
    medical_history JSONB,
    allergies JSONB,
    medications JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_patients_provider ON {schema}.patients(provider_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON {schema}.patients(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_patients_dob ON {schema}.patients(date_of_birth);

-- Add comments
COMMENT ON TABLE {schema}.patients IS 'Stores patient information';
COMMENT ON COLUMN {schema}.patients.patient_id IS 'Primary key for the patient';
COMMENT ON COLUMN {schema}.patients.provider_id IS 'Foreign key to the provider who manages this patient';
COMMENT ON COLUMN {schema}.patients.first_name IS 'First name of the patient';
COMMENT ON COLUMN {schema}.patients.last_name IS 'Last name of the patient';
COMMENT ON COLUMN {schema}.patients.date_of_birth IS 'Date of birth of the patient';
COMMENT ON COLUMN {schema}.patients.gender IS 'Gender of the patient';
COMMENT ON COLUMN {schema}.patients.email IS 'Email address of the patient';
COMMENT ON COLUMN {schema}.patients.phone IS 'Phone number of the patient';
COMMENT ON COLUMN {schema}.patients.address IS 'Address of the patient';
COMMENT ON COLUMN {schema}.patients.medical_history IS 'JSON object containing medical history';
COMMENT ON COLUMN {schema}.patients.allergies IS 'JSON array of allergies';
COMMENT ON COLUMN {schema}.patients.medications IS 'JSON array of current medications';
COMMENT ON COLUMN {schema}.patients.is_active IS 'Whether the patient record is active';
COMMENT ON COLUMN {schema}.patients.created_at IS 'Timestamp when the patient record was created';
COMMENT ON COLUMN {schema}.patients.updated_at IS 'Timestamp when the patient record was last updated';
COMMENT ON COLUMN {schema}.patients.deleted_at IS 'Timestamp when the patient record was soft deleted'; 