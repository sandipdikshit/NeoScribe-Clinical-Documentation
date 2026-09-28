-- Create note_templates_v2 table
CREATE TABLE IF NOT EXISTS {schema}.note_templates_v2 (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id INTEGER REFERENCES {schema}.users(iUserId) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    structure VARCHAR(50) NOT NULL,
    sections JSONB NOT NULL,
    system_prompt TEXT,
    specific_instructions TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_templates_provider ON {schema}.note_templates_v2(provider_id);
CREATE INDEX IF NOT EXISTS idx_templates_structure ON {schema}.note_templates_v2(structure);
CREATE INDEX IF NOT EXISTS idx_templates_created ON {schema}.note_templates_v2(created_at);

-- Add comments
COMMENT ON TABLE {schema}.note_templates_v2 IS 'Stores custom note templates';
COMMENT ON COLUMN {schema}.note_templates_v2.template_id IS 'Primary key for the template';
COMMENT ON COLUMN {schema}.note_templates_v2.provider_id IS 'Foreign key to the provider who created the template';
COMMENT ON COLUMN {schema}.note_templates_v2.name IS 'Name of the template';
COMMENT ON COLUMN {schema}.note_templates_v2.description IS 'Description of the template';
COMMENT ON COLUMN {schema}.note_templates_v2.structure IS 'Structure type of the template (e.g., SOAP, PROGRESS)';
COMMENT ON COLUMN {schema}.note_templates_v2.sections IS 'JSON array of required sections';
COMMENT ON COLUMN {schema}.note_templates_v2.system_prompt IS 'Custom system prompt for the template';
COMMENT ON COLUMN {schema}.note_templates_v2.specific_instructions IS 'Specific instructions for the template';
COMMENT ON COLUMN {schema}.note_templates_v2.is_active IS 'Whether the template is active';
COMMENT ON COLUMN {schema}.note_templates_v2.created_at IS 'Timestamp when the template was created';
COMMENT ON COLUMN {schema}.note_templates_v2.updated_at IS 'Timestamp when the template was last updated'; 