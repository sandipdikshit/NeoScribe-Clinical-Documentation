-- Create note_templates_v2 table
CREATE TABLE IF NOT EXISTS neodev.note_templates_v2 (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    structure VARCHAR(50) NOT NULL,
    sections JSONB NOT NULL,
    system_prompt TEXT,
    specific_instructions TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_provider
        FOREIGN KEY (provider_id)
        REFERENCES neodev.users(iUserId)
        ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_note_templates_provider_id 
ON neodev.note_templates_v2(provider_id);

CREATE INDEX IF NOT EXISTS idx_note_templates_name 
ON neodev.note_templates_v2(name);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION neodev.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_note_templates_updated_at
    BEFORE UPDATE ON neodev.note_templates_v2
    FOR EACH ROW
    EXECUTE FUNCTION neodev.update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE neodev.note_templates_v2 IS 'Stores custom note templates created by providers';

-- Add comments to columns
COMMENT ON COLUMN neodev.note_templates_v2.template_id IS 'Primary key for the template';
COMMENT ON COLUMN neodev.note_templates_v2.provider_id IS 'Foreign key to the provider who created the template';
COMMENT ON COLUMN neodev.note_templates_v2.name IS 'Name of the template';
COMMENT ON COLUMN neodev.note_templates_v2.description IS 'Description of the template';
COMMENT ON COLUMN neodev.note_templates_v2.structure IS 'Structure type of the template (e.g., SOAP, PROGRESS)';
COMMENT ON COLUMN neodev.note_templates_v2.sections IS 'JSON array of required sections';
COMMENT ON COLUMN neodev.note_templates_v2.system_prompt IS 'Custom system prompt for the template';
COMMENT ON COLUMN neodev.note_templates_v2.specific_instructions IS 'Specific instructions for the template';
COMMENT ON COLUMN neodev.note_templates_v2.is_active IS 'Whether the template is active';
COMMENT ON COLUMN neodev.note_templates_v2.created_at IS 'Timestamp when the template was created';
COMMENT ON COLUMN neodev.note_templates_v2.updated_at IS 'Timestamp when the template was last updated'; 