import { TranscriptionResult } from '@/shared/types/transcript.type';

export interface Note {
  visit_date: string;
  note_type: string;
  note_title: string;
  chief_complaint: string;
  status:
    | 'DRAFT'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'SIGNED'
    | 'ERROR'
    | 'ANALYZING'
    | 'PENDING'
    | 'AMENDED'
    | 'FAILED';
  is_deleted: boolean;
  note_id: string;
  patient_id: string;
  provider_id: number;
  transcription_result: TranscriptionResult;
  blob_filename: string | null;
  blob_filepath: string;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Section {
  section_type: string;
  section_name: string;
  content: string;
  sequence_number: number;
  section_id: string;
  note_id: string;
  created_at: string;
  updated_at: string;
  is_like?: boolean;
  is_dislike?: boolean;
}

export interface NoteSections {
  sections: Section[];
}

export interface SoapData {
  sections: Section[];
}

export const specialties = [
  'Family Medicine',
  'Internal Medicine',
  'Pediatrics',
  'Cardiology',
  'Dermatology',
  'Neurology',
  'Psychiatry',
  'Orthopedics',
  'Radiology',
  'Oncology',
  'Anesthesiology',
  'Emergency Medicine',
  'Obstetrics & Gynecology',
  'Ophthalmology',
  'Pathology',
  'Surgery',
  'Urology',
];

// Types
export const noteTypes = {
  "Annual Wellness": "ANNUAL",
  "Progress": "PROGRESS",
  "Psychiatric": "PSYCHIATRIC",
  "SOAP": "SOAP",
  "Standard Therapy Note": "STANDARD_THERAPY",
  "Wound Assessment Note": "WOUND"
} as const;

// Dynamically derive the NoteType type from the noteTypes object
export type NoteType = typeof noteTypes[keyof typeof noteTypes];
