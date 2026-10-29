import React from 'react';
import { ActiveView } from '../types';
import { ShieldCheck, Radio, Sparkles, Mic } from 'lucide-react';

interface TopBarProps {
  activeView: ActiveView;
  demoMode: boolean;
  isRecording: boolean;
  onLoadSample: () => void;
  onOpenLiveTest: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  demoMode,
  isRecording,
  onLoadSample,
  onOpenLiveTest,
}) => {
  const getTitle = () => {
    switch (activeView) {
      case 'new-session':
        return 'New Lecture Session';
      case 'upload':
        return 'Upload Lecture Audio';
      case 'preview':
        return 'Structured Lecture Note';
      case 'history':
        return 'Session History';
      default:
        return 'LectureNote AI';
    }
  };

  const getSubtitle = () => {
    switch (activeView) {
      case 'new-session':
        return 'Record lecture audio via microphone with rolling 30-second chunk transcription.';
      case 'upload':
        return 'Transcribe an existing lecture audio recording (WAV, MP3, M4A up to 25 MB).';
      case 'preview':
        return 'Algorithmic topic segmentation, extracted keywords, and export to DOCX/PDF.';
      case 'history':
        return 'Locally archived lecture transcripts, summaries, and downloadable notes.';
      default:
        return '';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
      <div>
        <h2 className="text-base font-semibold text-slate-900 tracking-tight">{getTitle()}</h2>
        <p className="text-xs text-slate-500 hidden sm:block">{getSubtitle()}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Status indicator */}
        {isRecording ? (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium border border-red-200">
            <Radio className="w-3.5 h-3.5 animate-pulse text-red-600" />
            <span>Recording Active</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Mic Ready</span>
          </div>
        )}

        <button
          onClick={onOpenLiveTest}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md border border-teal-200 transition-colors cursor-pointer"
        >
          <Mic className="w-3.5 h-3.5 text-teal-700 animate-pulse" />
          <span>Live Speech Test</span>
        </button>

        <button
          onClick={onLoadSample}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-teal-800 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
          <span>Load Sample Lecture</span>
        </button>
      </div>
    </header>
  );
};
