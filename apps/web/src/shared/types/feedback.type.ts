export enum FeedbackType {
  GENERAL = "general",
  BUG = "bug",
  FEATURE_REQUEST = "feature_request",
  IMPROVEMENT = "improvement",
  OTHER = "other"
}

export interface FeedbackData {
  subject: string;
  content: string;
  feedbackType: FeedbackType;
  rating: number | null;
  patientId?: string;
}