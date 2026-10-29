/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ActiveView, LectureMetadata, LectureSession } from './types';
import sampleData from './demo/sample.json';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { NewSessionView } from './components/NewSessionView';
import { UploadView } from './components/UploadView';
import { NotePreviewView } from './components/NotePreviewView';
import { HistoryView } from './components/HistoryView';
import { DefenseGuideModal } from './components/DefenseGuideModal';
import { LiveMicTestModal } from './components/LiveMicTestModal';
import {
  getSavedSessions,
  saveSession,
  deleteSession,
  clearAllSessions,
  createDefaultSampleSession,
} from './services/storage';

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('new-session');
  // Default to Demo mode as confirmed for presentation reliability
  const [demoMode, setDemoMode] = useState<boolean>(() => {
    return import.meta.env.VITE_DEMO_MODE !== 'false';
  });

  const [metadata, setMetadata] = useState<LectureMetadata>({
    courseTitle: sampleData.metadata.courseTitle,
    courseCode: sampleData.metadata.courseCode,
    lecturer: sampleData.metadata.lecturer,
    date: new Date().toISOString().split('T')[0],
    lectureTopic: sampleData.metadata.lectureTopic,
  });

  const [savedSessions, setSavedSessions] = useState<LectureSession[]>([]);
  const [currentSession, setCurrentSession] = useState<LectureSession | null>(null);
  const [isDefenseGuideOpen, setIsDefenseGuideOpen] = useState(false);
  const [isLiveTestOpen, setIsLiveTestOpen] = useState(false);

  // Load saved sessions on mount
  useEffect(() => {
    const list = getSavedSessions();
    setSavedSessions(list);
    if (list.length > 0 && !currentSession) {
      setCurrentSession(list[0]);
    }
  }, []);

  const handleSessionGenerated = (session: LectureSession) => {
    saveSession(session);
    setSavedSessions(getSavedSessions());
    setCurrentSession(session);
    setActiveView('preview');
  };

  const handleLoadSample = () => {
    const sampleSession = createDefaultSampleSession();
    setMetadata({ ...sampleSession.metadata });
    setCurrentSession(sampleSession);
    saveSession(sampleSession);
    setSavedSessions(getSavedSessions());
    setActiveView('preview');
  };

  const handleSelectSession = (session: LectureSession) => {
    setCurrentSession(session);
    setMetadata({ ...session.metadata });
    setActiveView('preview');
  };

  const handleDeleteSession = (id: string) => {
    const updated = deleteSession(id);
    setSavedSessions(updated);
    if (currentSession?.id === id) {
      setCurrentSession(updated.length > 0 ? updated[0] : null);
    }
  };

  const handleClearAll = () => {
    const reseeded = clearAllSessions();
    setSavedSessions(reseeded);
    setCurrentSession(reseeded.length > 0 ? reseeded[0] : null);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F1F5F7] font-sans text-slate-900 antialiased">
      {/* Dark Teal Sidebar (#113C3C) */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        hasActiveNote={!!currentSession}
        historyCount={savedSessions.length}
        demoMode={demoMode}
        setDemoMode={setDemoMode}
        onLoadSample={handleLoadSample}
        onOpenDefenseGuide={() => setIsDefenseGuideOpen(true)}
        onOpenLiveTest={() => setIsLiveTestOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Bar */}
        <TopBar
          activeView={activeView}
          demoMode={demoMode}
          isRecording={false}
          onLoadSample={handleLoadSample}
          onOpenLiveTest={() => setIsLiveTestOpen(true)}
        />

        {/* Dynamic Viewport Canvas */}
        <main className="flex-1 overflow-y-auto bg-[#F1F5F7]">
          {activeView === 'new-session' && (
            <NewSessionView
              demoMode={demoMode}
              metadata={metadata}
              setMetadata={setMetadata}
              onSessionGenerated={handleSessionGenerated}
              onLoadSample={handleLoadSample}
              onOpenLiveTest={() => setIsLiveTestOpen(true)}
            />
          )}

          {activeView === 'upload' && (
            <UploadView
              demoMode={demoMode}
              metadata={metadata}
              setMetadata={setMetadata}
              onSessionGenerated={handleSessionGenerated}
              onLoadSample={handleLoadSample}
            />
          )}

          {activeView === 'preview' && (
            <NotePreviewView
              session={currentSession}
              onNewSession={() => setActiveView('new-session')}
              onLoadSample={handleLoadSample}
            />
          )}

          {activeView === 'history' && (
            <HistoryView
              sessions={savedSessions}
              onSelectSession={handleSelectSession}
              onDeleteSession={handleDeleteSession}
              onClearAll={handleClearAll}
              onLoadSample={handleLoadSample}
            />
          )}
        </main>
      </div>

      {/* 5-Minute Defense Guide Modal */}
      <DefenseGuideModal
        isOpen={isDefenseGuideOpen}
        onClose={() => setIsDefenseGuideOpen(false)}
        onRunSample={handleLoadSample}
      />

      {/* Global Live Mic Speech Test Modal */}
      <LiveMicTestModal
        isOpen={isLiveTestOpen}
        onClose={() => setIsLiveTestOpen(false)}
        onApplyTranscript={() => {
          setActiveView('new-session');
        }}
      />
    </div>
  );
}
