export interface Template {
  template_id: string;
  name: string;
  description: string;
  structure: string;
  sections: string[];
  system_prompt: string;
  specific_instructions: string;
  is_active: boolean;
  provider_id: number;
  created_at: string;
  updated_at: string;
}

export interface DraggableSection {
  id: string;
  name: string;
}
