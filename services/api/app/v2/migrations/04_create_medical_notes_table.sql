-- Create medical_notes table
CREATE TABLE IF NOT EXISTS {schema}.medical_notes (
    note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES {schema}.patients(patient_id) ON DELETE CASCADE NOT NULL,
    provider_id INTEGER REFERENCES {schema}.users(iUserId) ON DELETE CASCADE NOT NULL,
    visit_date TIMESTAMP WITH TIME ZONE NOT NULL,
    note_title VARCHAR(255) NOT NULL,
    note_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    chief_complaint TEXT NOT NULL,
    transcription_result JSONB,
    analytics_result JSONB,
    blob_filepath VARCHAR(255),
    blob_filename VARCHAR(255),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    signed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notes_patient ON {schema}.medical_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_notes_provider ON {schema}.medical_notes(provider_id);
CREATE INDEX IF NOT EXISTS idx_notes_type ON {schema}.medical_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_notes_status ON {schema}.medical_notes(status);
CREATE INDEX IF NOT EXISTS idx_notes_visit_date ON {schema}.medical_notes(visit_date);

-- Add comments
COMMENT ON TABLE {schema}.medical_notes IS 'Stores medical notes';
COMMENT ON COLUMN {schema}.medical_notes.note_id IS 'Primary key for the medical note';
COMMENT ON COLUMN {schema}.medical_notes.patient_id IS 'Foreign key to the patient';
COMMENT ON COLUMN {schema}.medical_notes.provider_id IS 'Foreign key to the provider who created the note';
COMMENT ON COLUMN {schema}.medical_notes.visit_date IS 'Date and time of the patient visit';
COMMENT ON COLUMN {schema}.medical_notes.note_title IS 'Title of the medical note';
COMMENT ON COLUMN {schema}.medical_notes.note_type IS 'Type of the medical note (e.g., SOAP, PROGRESS)';
COMMENT ON COLUMN {schema}.medical_notes.status IS 'Status of the note (e.g., DRAFT, SIGNED)';
COMMENT ON COLUMN {schema}.medical_notes.chief_complaint IS 'Primary complaint of the patient';
COMMENT ON COLUMN {schema}.medical_notes.transcription_result IS 'JSON object containing transcription results';
COMMENT ON COLUMN {schema}.medical_notes.analytics_result IS 'JSON object containing analytics results';
COMMENT ON COLUMN {schema}.medical_notes.blob_filepath IS 'Path to the stored audio file';
COMMENT ON COLUMN {schema}.medical_notes.blob_filename IS 'Name of the stored audio file';
COMMENT ON COLUMN {schema}.medical_notes.is_deleted IS 'Whether the note is deleted';
COMMENT ON COLUMN {schema}.medical_notes.signed_at IS 'Timestamp when the note was signed';
COMMENT ON COLUMN {schema}.medical_notes.created_at IS 'Timestamp when the note was created';
COMMENT ON COLUMN {schema}.medical_notes.updated_at IS 'Timestamp when the note was last updated'; 