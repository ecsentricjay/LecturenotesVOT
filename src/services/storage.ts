import { LectureSession } from '../types';
import sampleData from '../demo/sample.json';
import { structureNote, buildGlossary } from '../nlp.js';

const STORAGE_KEY = 'lecturenote_saved_sessions_v1';

/**
 * Retrieves all saved lecture sessions from localStorage, sorted newest first.
 */
export function getSavedSessions(): LectureSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Seed with initial sample session for instant defense demonstration
      const initialSession = createDefaultSampleSession();
      localStorage.setItem(STORAGE_KEY, JSON.stringify([initialSession]));
      return [initialSession];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.sort((a, b) => b.timestamp - a.timestamp);
    }
    const initialSession = createDefaultSampleSession();
    localStorage.setItem(STORAGE_KEY, JSON.stringify([initialSession]));
    return [initialSession];
  } catch (err) {
    console.error('Failed to load sessions from localStorage:', err);
    return [createDefaultSampleSession()];
  }
}

/**
 * Saves a new or updated session to localStorage.
 */
export function saveSession(session: LectureSession): void {
  try {
    const sessions = getSavedSessions();
    const existingIndex = sessions.findIndex((s) => s.id === session.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.unshift(session);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.error('Failed to save session to localStorage:', err);
  }
}

/**
 * Deletes a session by id.
 */
export function deleteSession(id: string): LectureSession[] {
  try {
    const sessions = getSavedSessions().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return sessions;
  } catch (err) {
    console.error('Failed to delete session:', err);
    return [];
  }
}

/**
 * Clears all sessions and re-seeds with the default sample.
 */
export function clearAllSessions(): LectureSession[] {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return getSavedSessions();
  } catch (err) {
    console.error('Failed to clear sessions:', err);
    return [];
  }
}

/**
 * Creates a pre-structured session from the bundled sample lecture.
 */
export function createDefaultSampleSession(): LectureSession {
  const sections = structureNote(sampleData.fullTranscript);
  const glossary = buildGlossary(sections);

  return {
    id: 'sample-session-csc411',
    timestamp: Date.now() - 3600000 * 2, // 2 hours ago
    metadata: {
      courseTitle: sampleData.metadata.courseTitle,
      courseCode: sampleData.metadata.courseCode,
      lecturer: sampleData.metadata.lecturer,
      date: sampleData.metadata.date,
      lectureTopic: sampleData.metadata.lectureTopic,
    },
    rawTranscript: sampleData.fullTranscript,
    sections,
    glossary,
    durationSeconds: 120, // 2 minutes
  };
}
