-- Create note_sections table
CREATE TABLE IF NOT EXISTS {schema}.note_sections (
    section_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID REFERENCES {schema}.medical_notes(note_id) ON DELETE CASCADE NOT NULL,
    section_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    section_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sections_note ON {schema}.note_sections(note_id);
CREATE INDEX IF NOT EXISTS idx_sections_type ON {schema}.note_sections(section_type);
CREATE INDEX IF NOT EXISTS idx_sections_order ON {schema}.note_sections(section_order);

-- Add comments
COMMENT ON TABLE {schema}.note_sections IS 'Stores sections of medical notes';
COMMENT ON COLUMN {schema}.note_sections.section_id IS 'Primary key for the section';
COMMENT ON COLUMN {schema}.note_sections.note_id IS 'Foreign key to the medical note';
COMMENT ON COLUMN {schema}.note_sections.section_type IS 'Type of the section (e.g., SUBJECTIVE, OBJECTIVE, ASSESSMENT, PLAN)';
COMMENT ON COLUMN {schema}.note_sections.content IS 'Content of the section';
COMMENT ON COLUMN {schema}.note_sections.section_order IS 'Order of the section in the note';
COMMENT ON COLUMN {schema}.note_sections.created_at IS 'Timestamp when the section was created';
COMMENT ON COLUMN {schema}.note_sections.updated_at IS 'Timestamp when the section was last updated'; 