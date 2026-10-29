export interface LectureMetadata {
  courseTitle: string;
  courseCode: string;
  lecturer: string;
  date: string;
  lectureTopic: string;
}

export interface TopicSection {
  id: string;
  heading: string;
  keywords: string[];
  bullets: string[];
  sentences: string[];
}

export interface GlossaryItem {
  term: string;
  count: number;
  example: string;
}

export interface LectureSession {
  id: string;
  timestamp: number;
  metadata: LectureMetadata;
  rawTranscript: string;
  sections: TopicSection[];
  glossary: GlossaryItem[];
  durationSeconds: number;
}

export type ActiveView = 'new-session' | 'upload' | 'preview' | 'history';
