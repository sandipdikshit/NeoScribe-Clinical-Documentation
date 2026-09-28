-- Create feedback table
CREATE TABLE IF NOT EXISTS {schema}.feedback (
    feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id INTEGER REFERENCES {schema}.users(iUserId) ON DELETE CASCADE NOT NULL,
    note_id UUID REFERENCES {schema}.medical_notes(note_id) ON DELETE CASCADE NOT NULL,
    feedback_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_feedback_provider ON {schema}.feedback(provider_id);
CREATE INDEX IF NOT EXISTS idx_feedback_note ON {schema}.feedback(note_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON {schema}.feedback(feedback_type);

-- Add comments
COMMENT ON TABLE {schema}.feedback IS 'Stores feedback for medical notes';
COMMENT ON COLUMN {schema}.feedback.feedback_id IS 'Primary key for the feedback';
COMMENT ON COLUMN {schema}.feedback.provider_id IS 'Foreign key to the provider who gave the feedback';
COMMENT ON COLUMN {schema}.feedback.note_id IS 'Foreign key to the medical note';
COMMENT ON COLUMN {schema}.feedback.feedback_type IS 'Type of feedback (e.g., ACCURACY, COMPLETENESS, CLARITY)';
COMMENT ON COLUMN {schema}.feedback.content IS 'Content of the feedback';
COMMENT ON COLUMN {schema}.feedback.rating IS 'Rating from 1 to 5';
COMMENT ON COLUMN {schema}.feedback.created_at IS 'Timestamp when the feedback was created';
COMMENT ON COLUMN {schema}.feedback.updated_at IS 'Timestamp when the feedback was last updated'; 