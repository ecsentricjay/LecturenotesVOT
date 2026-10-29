import React from 'react';
import {
  Mic,
  Upload,
  FileText,
  History,
  Sparkles,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  GraduationCap,
} from 'lucide-react';
import { ActiveView } from '../types';

interface SidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  hasActiveNote: boolean;
  historyCount: number;
  demoMode: boolean;
  setDemoMode: (val: boolean) => void;
  onLoadSample: () => void;
  onOpenDefenseGuide: () => void;
  onOpenLiveTest: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  hasActiveNote,
  historyCount,
  demoMode,
  setDemoMode,
  onLoadSample,
  onOpenDefenseGuide,
  onOpenLiveTest,
}) => {
  const navItems = [
    {
      id: 'new-session' as ActiveView,
      label: 'New Session',
      icon: Mic,
      description: 'Record live lecture audio',
    },
    {
      id: 'upload' as ActiveView,
      label: 'Upload Audio',
      icon: Upload,
      description: 'WAV, MP3, M4A up to 25MB',
    },
    {
      id: 'preview' as ActiveView,
      label: 'Note Preview',
      icon: FileText,
      description: 'Structured topic note',
      badge: hasActiveNote ? 'Ready' : undefined,
    },
    {
      id: 'history' as ActiveView,
      label: 'Session History',
      icon: History,
      description: 'Saved local sessions',
      badge: historyCount > 0 ? `${historyCount}` : undefined,
    },
  ];

  return (
    <aside className="w-64 bg-[#113C3C] text-white flex flex-col shrink-0 h-screen select-none border-r border-[#0d2e2e]">
      {/* Brand Header */}
      <div className="p-5 border-b border-teal-900/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600/30 border border-teal-500/40 flex items-center justify-center text-teal-300">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-white leading-tight">
              LectureNote
            </h1>
            <p className="text-xs text-teal-300/80 font-medium">Final-Year Defense Demo</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <p className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-teal-400/80 uppercase">
          Workspace Views
        </p>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 ${
                isActive
                  ? 'bg-teal-700/80 text-white font-medium shadow-sm border border-teal-500/30'
                  : 'text-teal-100/80 hover:bg-teal-900/50 hover:text-white'
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 ${isActive ? 'text-teal-200' : 'text-teal-400/70'}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm truncate">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        isActive
                          ? 'bg-teal-500 text-white'
                          : 'bg-teal-900/80 text-teal-300 border border-teal-700/50'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {/* Defense Presentation Utilities */}
        <div className="pt-4 pb-1">
          <p className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-teal-400/80 uppercase">
            Defense Controls
          </p>

          <button
            onClick={onOpenLiveTest}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-teal-100 hover:bg-teal-900/60 hover:text-white transition-colors border border-emerald-500/40 bg-teal-950/60 mb-2 group"
          >
            <Mic className="w-4 h-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold block text-emerald-300">Live Speech Test</span>
              <span className="text-[10px] text-teal-300/70 block truncate">
                Say something to transcribe
              </span>
            </div>
          </button>

          <button
            onClick={onLoadSample}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-teal-200 hover:bg-teal-900/60 hover:text-white transition-colors border border-dashed border-teal-500/30 bg-teal-950/40 mb-2"
          >
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold block text-amber-200">Load Sample Lecture</span>
              <span className="text-[10px] text-teal-300/70 block truncate">
                CSC 411 Neural Networks
              </span>
            </div>
          </button>

          <button
            onClick={onOpenDefenseGuide}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-teal-100/90 hover:bg-teal-900/50 hover:text-white transition-colors text-xs"
          >
            <HelpCircle className="w-4 h-4 text-teal-300 shrink-0" />
            <span>5-Minute Defense Script</span>
          </button>
        </div>
      </nav>

      {/* Audio Engine Status Footer */}
      <div className="p-4 border-t border-teal-900/40 bg-[#0e3333]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-teal-200">Speech Engine</span>
          <span className="flex items-center text-emerald-400 font-semibold gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Live Mic Ready</span>
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-teal-300/70">
          Real-time microphone voice-to-text with in-browser NLP topic structuring & Whisper export.
        </p>
      </div>
    </aside>
  );
};
