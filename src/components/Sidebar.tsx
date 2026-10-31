import React from 'react';
import {
  Mic,
  Upload,
  FileText,
  History,
  Sparkles,
  HelpCircle,
  GraduationCap,
  Key,
  X,
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
  onOpenApiKeyModal: () => void;
  isMobileDrawerOpen: boolean;
  setIsMobileDrawerOpen: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  hasActiveNote,
  historyCount,
  onLoadSample,
  onOpenDefenseGuide,
  onOpenLiveTest,
  onOpenApiKeyModal,
  isMobileDrawerOpen,
  setIsMobileDrawerOpen,
}) => {
  const navItems = [
    {
      id: 'new-session' as ActiveView,
      label: 'New Session',
      shortLabel: 'Record',
      icon: Mic,
      description: 'Record live lecture audio',
    },
    {
      id: 'upload' as ActiveView,
      label: 'Upload Audio',
      shortLabel: 'Upload',
      icon: Upload,
      description: 'WAV, MP3, M4A up to 25MB',
    },
    {
      id: 'preview' as ActiveView,
      label: 'Note Preview',
      shortLabel: 'Note',
      icon: FileText,
      description: 'Structured topic note',
      badge: hasActiveNote ? 'Ready' : undefined,
    },
    {
      id: 'history' as ActiveView,
      label: 'Session History',
      shortLabel: 'History',
      icon: History,
      description: 'Saved local sessions',
      badge: historyCount > 0 ? `${historyCount}` : undefined,
    },
  ];

  return (
    <>
      {/* ================= DESKTOP SIDEBAR (>= md) ================= */}
      <aside className="hidden md:flex w-64 bg-[#113C3C] text-white flex-col shrink-0 h-screen select-none border-r border-[#0d2e2e]">
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 cursor-pointer ${
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
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-teal-100 hover:bg-teal-900/60 hover:text-white transition-colors border border-emerald-500/40 bg-teal-950/60 mb-2 group cursor-pointer"
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
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-teal-200 hover:bg-teal-900/60 hover:text-white transition-colors border border-dashed border-teal-500/30 bg-teal-950/40 mb-2 cursor-pointer"
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
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-teal-100/90 hover:bg-teal-900/50 hover:text-white transition-colors text-xs cursor-pointer mb-1"
            >
              <HelpCircle className="w-4 h-4 text-teal-300 shrink-0" />
              <span>5-Minute Defense Script</span>
            </button>

            <button
              onClick={onOpenApiKeyModal}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-teal-200/80 hover:bg-teal-900/50 hover:text-white transition-colors text-xs cursor-pointer"
            >
              <Key className="w-4 h-4 text-teal-400 shrink-0" />
              <span>Groq API Key Setup</span>
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
            Microphone voice-to-text with in-browser NLP topic structuring & Whisper export.
          </p>
        </div>
      </aside>

      {/* ================= MOBILE BOTTOM NAVIGATION (< md) ================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#113C3C] border-t border-teal-900/60 h-16 grid grid-cols-4 items-center px-1 shadow-2xl safe-area-inset-bottom">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-colors cursor-pointer relative ${
                isActive ? 'text-white' : 'text-teal-300/70 hover:text-teal-100'
              }`}
            >
              {isActive && (
                <div className="absolute top-0 w-8 h-1 bg-teal-400 rounded-b-full shadow-sm shadow-teal-400/50" />
              )}
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-teal-300 scale-110' : 'text-teal-400/80'} transition-transform`} />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-3 text-[9px] bg-teal-500 text-white font-mono px-1 rounded-full leading-tight">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium ${isActive ? 'font-bold text-white' : ''}`}>
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* ================= MOBILE SLIDE-OUT DRAWER (< md) ================= */}
      {isMobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] bg-[#113C3C] text-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="p-4 border-b border-teal-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-600/30 border border-teal-500/40 flex items-center justify-center text-teal-300">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">LectureNote</h2>
                  <p className="text-[10px] text-teal-300/80">Final-Year Defense Demo</p>
                </div>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1.5 rounded-lg text-teal-300 hover:text-white hover:bg-teal-900/60 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 p-3 space-y-3 overflow-y-auto">
              <p className="px-2 text-[10px] font-semibold tracking-wider text-teal-400/80 uppercase">
                Defense Utilities
              </p>

              <button
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  onOpenLiveTest();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-teal-950/70 border border-emerald-500/40 text-left text-white cursor-pointer active:scale-98 transition-transform"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Mic className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-emerald-300 block">Live Speech Test</span>
                  <span className="text-[10px] text-teal-300/70 block truncate">Speak to transcribe instantly</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  onLoadSample();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-teal-950/50 border border-dashed border-teal-500/30 text-left text-white cursor-pointer active:scale-98 transition-transform"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-amber-200 block">Load Sample Lecture</span>
                  <span className="text-[10px] text-teal-300/70 block truncate">CSC 411 Neural Networks</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  onOpenDefenseGuide();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-teal-100 hover:bg-teal-900/50 text-xs cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-teal-300 shrink-0" />
                <span>5-Minute Defense Script</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  onOpenApiKeyModal();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-teal-100 hover:bg-teal-900/50 text-xs cursor-pointer"
              >
                <Key className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Groq API Key Setup</span>
              </button>
            </div>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-teal-900/40 bg-[#0e3333]">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-teal-200 font-medium">Status</span>
                <span className="flex items-center text-emerald-400 gap-1.5 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Live Mic Ready</span>
                </span>
              </div>
              <p className="text-[10px] text-teal-300/60 leading-relaxed">
                Mobile-optimized lecture note capture & export.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
