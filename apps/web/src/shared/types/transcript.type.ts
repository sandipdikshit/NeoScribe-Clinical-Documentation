export interface TranscriptionResult {
  metadata: TranscriptionMetadata;
  transcription: string | TranscriptSegment[];
  transcription_data: TranscriptSegment[];
}

export interface TranscriptionMetadata {
  filename: string;
  language: string;
  word_count: number;
  duration_seconds: number;
  transcription_time: number;
}

export interface TranscriptSegment {
  timestamp: string;
  start: number;
  end: number;
  text: string;
  speaker: number;
}
