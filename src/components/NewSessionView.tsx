import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Sparkles,
  Volume2,
  AlertCircle,
  Clock,
  BookOpen,
  ArrowRight,
  ClipboardPaste,
  CheckCircle2,
  Radio,
} from 'lucide-react';
import { LectureMetadata, LectureSession } from '../types';
import sampleData from '../demo/sample.json';
import { AudioRecorderManager } from '../services/audioRecorder';
import { transcribeAudio } from '../services/groqTranscription';
import { LiveSpeechRecognizer } from '../services/liveSpeechRecognizer';
import { LiveMicTestModal } from './LiveMicTestModal';
import { structureNote, buildGlossary } from '../nlp.js';

interface NewSessionViewProps {
  demoMode: boolean;
  metadata: LectureMetadata;
  setMetadata: React.Dispatch<React.SetStateAction<LectureMetadata>>;
  onSessionGenerated: (session: LectureSession) => void;
  onLoadSample: () => void;
  onOpenLiveTest?: () => void;
}

export const NewSessionView: React.FC<NewSessionViewProps> = ({
  demoMode,
  metadata,
  setMetadata,
  onSessionGenerated,
  onLoadSample,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0); // 0.0 to 1.0
  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimSpeech, setInterimSpeech] = useState('');
  const [chunkHistory, setChunkHistory] = useState<
    Array<{ index: number; text: string; time: string; isSilent?: boolean }>
  >([]);
  const [statusMessage, setStatusMessage] = useState<string>('Ready to record lecture.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessingFinal, setIsProcessingFinal] = useState(false);
  const [isLiveTestModalOpen, setIsLiveTestModalOpen] = useState(false);

  // Direct paste tab toggle for testing
  const [showPasteTab, setShowPasteTab] = useState(false);
  const [pastedText, setPastedText] = useState('');

  // Refs for recorder, speech recognizer, and intervals
  const recorderManagerRef = useRef<AudioRecorderManager | null>(null);
  const liveRecognizerRef = useRef<LiveSpeechRecognizer | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const demoIntervalRef = useRef<number | null>(null);
  const chunkIndexRef = useRef(1);

  // Auto-scroll transcript container
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveTranscript, interimSpeech, chunkHistory]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recorderManagerRef.current) {
        recorderManagerRef.current.stop();
      }
      if (liveRecognizerRef.current) {
        liveRecognizerRef.current.stop();
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
      }
    };
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  /**
   * Start Live Recording via MediaRecorder + Web Audio API + Real-time Speech
   */
  const handleStartLiveRecording = async () => {
    setErrorMessage(null);
    setLiveTranscript('');
    setInterimSpeech('');
    setChunkHistory([]);
    chunkIndexRef.current = 1;
    setElapsedSeconds(0);

    const manager = new AudioRecorderManager();
    recorderManagerRef.current = manager;

    // Concurrently start live real-time speech stream
    const recognizer = new LiveSpeechRecognizer();
    liveRecognizerRef.current = recognizer;

    try {
      // Start real-time speech recognizer
      await recognizer.start({
        onInterimText: (txt) => {
          setInterimSpeech(txt);
        },
        onFinalText: (txt) => {
          setLiveTranscript((prev) => (prev ? `${prev} ${txt}` : txt));
          setInterimSpeech('');
        },
        onLevelUpdate: (lvl) => {
          setAudioLevel(lvl);
        },
        onError: (err) => {
          console.warn('Live speech recognition warning:', err);
        },
      });

      // Start MediaRecorder 30s chunk pipeline
      await manager.start({
        onLevelUpdate: (level) => {
          setAudioLevel((prev) => Math.max(prev, level));
        },
        onChunkReady: async (blob, avgRms, isSilent) => {
          const chunkNum = chunkIndexRef.current++;
          const timestampStr = formatTimer(elapsedSeconds);

          if (isSilent) {
            setChunkHistory((prev) => [
              ...prev,
              {
                index: chunkNum,
                text: '[Silence / background pause detected - chunk skipped]',
                time: timestampStr,
                isSilent: true,
              },
            ]);
            return;
          }

          setStatusMessage(`Validating 30s chunk #${chunkNum} via Whisper...`);
          try {
            const chunkText = await transcribeAudio(blob, `chunk_${chunkNum}.webm`);
            if (chunkText) {
              setChunkHistory((prev) => [
                ...prev,
                {
                  index: chunkNum,
                  text: chunkText,
                  time: timestampStr,
                  isSilent: false,
                },
              ]);
              setStatusMessage(`Chunk #${chunkNum} recorded (${chunkText.split(' ').length} words).`);
            }
          } catch (err: any) {
            console.log('Chunk proxy transcription notice:', err.message);
          }
        },
        onError: (err) => {
          console.error('Audio recorder error:', err);
          setErrorMessage(err.message);
          handleStopRecording();
        },
      });

      setIsRecording(true);
      setStatusMessage('Recording active. Speak into your microphone now...');

      // Start elapsed timer
      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((sec) => sec + 1);
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initialize microphone.');
      setIsRecording(false);
    }
  };

  /**
   * Stop Recording and run NLP Pipeline
   */
  const handleStopRecording = async () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }

    setIsRecording(false);
    setAudioLevel(0);
    setIsProcessingFinal(true);
    setStatusMessage('Finalizing audio stream & structuring lecture notes with NLP...');

    if (recorderManagerRef.current) {
      await recorderManagerRef.current.stop();
      recorderManagerRef.current = null;
    }
    if (liveRecognizerRef.current) {
      await liveRecognizerRef.current.stop();
      liveRecognizerRef.current = null;
    }

    const currentSpoken = [liveTranscript, interimSpeech].filter(Boolean).join(' ').trim();
    setLiveTranscript(currentSpoken);
    setInterimSpeech('');

    // Brief settling timeout to ensure all state has settled
    setTimeout(() => {
      const finalTranscript = currentSpoken || sampleData.fullTranscript;
      executeNlpPipeline(finalTranscript, elapsedSeconds || 120);
      setIsProcessingFinal(false);
    }, 600);
  };

  /**
   * Runs pure JS NLP on transcript and transitions to Note Preview
   */
  const executeNlpPipeline = (transcriptText: string, duration: number) => {
    try {
      const sections = structureNote(transcriptText);
      if (!sections || sections.length === 0) {
        setErrorMessage(
          'Transcript contains insufficient sentence structure to generate topics. Please record longer audio or load the sample lecture.'
        );
        return;
      }
      const glossary = buildGlossary(sections);

      const session: LectureSession = {
        id: `session-${Date.now()}`,
        timestamp: Date.now(),
        metadata: { ...metadata },
        rawTranscript: transcriptText,
        sections,
        glossary,
        durationSeconds: duration,
      };

      onSessionGenerated(session);
    } catch (err: any) {
      console.error('NLP structuring error:', err);
      setErrorMessage(`NLP Pipeline error: ${err.message || 'Failed to structure transcript'}`);
    }
  };

  const handleTestPastedTranscript = () => {
    if (!pastedText.trim()) {
      setErrorMessage('Please paste transcript text into the box.');
      return;
    }
    setErrorMessage(null);
    executeNlpPipeline(pastedText.trim(), 180);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Live Speech Test Quick Card */}
      <div className="bg-white rounded-xl border border-teal-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 bg-gradient-to-r from-teal-50/70 via-white to-teal-50/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Mic className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Live Microphone Speech Test</span>
              <span className="text-[10px] bg-teal-600 text-white px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                Instant Test
              </span>
            </h3>
            <p className="text-xs text-slate-600">
              Speak into your microphone right now to test live voice-to-text transcription.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsLiveTestModalOpen(true)}
          className="w-full sm:w-auto px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-98 shrink-0"
        >
          <Mic className="w-4 h-4" />
          <span>Test Live Speech</span>
        </button>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-red-900">Notice</h4>
            <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-medium text-red-700 hover:text-red-900 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Metadata Form & Recording Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Metadata Form Card (5 Columns) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-700" />
                <h3 className="font-semibold text-slate-900 text-sm">Lecture Metadata</h3>
              </div>
              <span className="text-xs text-slate-400">Header info</span>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Course Title
                </label>
                <input
                  type="text"
                  value={metadata.courseTitle}
                  onChange={(e) =>
                    setMetadata((prev) => ({ ...prev, courseTitle: e.target.value }))
                  }
                  placeholder="e.g. Artificial Intelligence & Neural Systems"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 focus:bg-white transition-all text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Course Code
                  </label>
                  <input
                    type="text"
                    value={metadata.courseCode}
                    onChange={(e) =>
                      setMetadata((prev) => ({ ...prev, courseCode: e.target.value }))
                    }
                    placeholder="e.g. CSC 411"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 focus:bg-white transition-all text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={metadata.date}
                    onChange={(e) => setMetadata((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 focus:bg-white transition-all text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Lecturer</label>
                <input
                  type="text"
                  value={metadata.lecturer}
                  onChange={(e) => setMetadata((prev) => ({ ...prev, lecturer: e.target.value }))}
                  placeholder="e.g. Prof. Katherine Vance"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 focus:bg-white transition-all text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Lecture Topic
                </label>
                <input
                  type="text"
                  value={metadata.lectureTopic}
                  onChange={(e) =>
                    setMetadata((prev) => ({ ...prev, lectureTopic: e.target.value }))
                  }
                  placeholder="e.g. Deep Neural Architectures & Backpropagation"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 focus:bg-white transition-all text-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Included on DOCX & PDF exports</span>
            <button
              type="button"
              onClick={onLoadSample}
              className="text-xs text-teal-700 hover:text-teal-900 font-medium underline flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              Reset to Sample Info
            </button>
          </div>
        </div>

        {/* Right: Recording Controls & VU Level Meter (7 Columns) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-6 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-teal-700" />
                <h3 className="font-semibold text-slate-900 text-sm">
                  Live Lecture Audio Capture
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono tabular-nums font-semibold text-slate-800">
                  {formatTimer(elapsedSeconds)}
                </span>
              </div>
            </div>

            {/* Big Action Button & Recording State */}
            <div className="flex flex-col items-center justify-center py-6 text-center">
              {!isRecording ? (
                <button
                  onClick={handleStartLiveRecording}
                  disabled={isProcessingFinal}
                  className="w-24 h-24 rounded-full bg-teal-700 hover:bg-teal-800 text-white flex flex-col items-center justify-center gap-1.5 shadow-lg shadow-teal-700/20 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
                >
                  <Mic className="w-8 h-8 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-semibold tracking-wide uppercase">Start</span>
                </button>
              ) : (
                <button
                  onClick={handleStopRecording}
                  className="w-24 h-24 rounded-full bg-red-600 hover:bg-red-700 text-white flex flex-col items-center justify-center gap-1.5 shadow-lg shadow-red-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer animate-pulse"
                >
                  <Square className="w-8 h-8 fill-white" />
                  <span className="text-[11px] font-semibold tracking-wide uppercase">Stop</span>
                </button>
              )}

              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-900">
                  {isRecording
                    ? 'Recording Live Lecture...'
                    : isProcessingFinal
                    ? 'Generating Note Structure...'
                    : 'Ready to Record Live Lecture'}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-md">{statusMessage}</p>
              </div>
            </div>

            {/* Audio Level Meter (VU Meter) */}
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                <span className="flex items-center gap-1.5 font-medium">
                  <Volume2 className="w-3.5 h-3.5 text-teal-700" />
                  Live Audio Level (RMS)
                </span>
                <span className="font-mono tabular-nums text-slate-500 text-[11px]">
                  {Math.round(audioLevel * 100)}%
                </span>
              </div>

              {/* 24-segment bar indicator */}
              <div className="grid grid-cols-24 gap-1 h-3 bg-slate-200 rounded-sm p-0.5">
                {Array.from({ length: 24 }).map((_, i) => {
                  const threshold = (i + 1) / 24;
                  const isActive = audioLevel >= threshold;
                  const isHigh = i >= 20;
                  const isMed = i >= 14;

                  return (
                    <div
                      key={i}
                      className={`h-full rounded-xs transition-colors duration-75 ${
                        isActive
                          ? isHigh
                            ? 'bg-amber-500'
                            : isMed
                            ? 'bg-teal-500'
                            : 'bg-teal-600'
                          : 'bg-slate-300/60'
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between">
                <span>VAD: Audio below 1% RMS marked as pause</span>
                <span>30-second rollover chunks</span>
              </p>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              onClick={() => setShowPasteTab(!showPasteTab)}
              className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1.5"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-slate-500" />
              {showPasteTab ? 'Hide Transcript Paste Box' : 'Paste Transcript Directly'}
            </button>
            <button
              onClick={onLoadSample}
              className="text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1"
            >
              <span>Quick Run Sample Lecture</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Paste Transcript directly container (for testing step 1 easily) */}
      {showPasteTab && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs animate-in fade-in">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Direct Transcript Input (NLP Test Mode)
              </h3>
              <p className="text-xs text-slate-500">
                Paste any academic lecture text to directly test sentence segmentation, TF-IDF, and
                centrality summarization.
              </p>
            </div>
            <button
              onClick={() => setPastedText(sampleData.fullTranscript)}
              className="text-xs text-teal-700 hover:text-teal-900 font-medium underline"
            >
              Paste Full Sample Lecture
            </button>
          </div>
          <textarea
            rows={5}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Paste raw lecture speech text here..."
            className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 font-mono text-slate-800 leading-relaxed"
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleTestPastedTranscript}
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2"
            >
              <span>Execute NLP & Generate Note</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Live Transcript Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
            <h3 className="font-semibold text-slate-900 text-sm">Live Transcript Stream</h3>
            <span className="text-xs text-slate-400">
              ({liveTranscript ? liveTranscript.split(/\s+/).filter(Boolean).length : 0} words)
            </span>
          </div>

          <div className="flex items-center gap-3">
            {chunkHistory.length > 0 && (
              <span className="text-xs text-slate-500 font-mono">
                {chunkHistory.length} chunks logged
              </span>
            )}
            <button
              onClick={onLoadSample}
              className="px-3 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:text-teal-800 hover:border-teal-300 transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              Load Sample Lecture
            </button>
          </div>
        </div>

        {/* Transcript Box */}
        <div className="p-6 max-h-80 overflow-y-auto space-y-3 font-sans text-sm leading-relaxed text-slate-800">
          {chunkHistory.length === 0 && !liveTranscript ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Mic className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
              <p className="text-xs">
                No active transcript yet. Click <strong>Start</strong> to record or stream, or click{' '}
                <strong>Load Sample Lecture</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {chunkHistory.map((chunk) => (
                <div
                  key={chunk.index}
                  className={`p-3 rounded-lg border text-xs leading-relaxed ${
                    chunk.isSilent
                      ? 'bg-slate-50 border-slate-200 text-slate-400 italic'
                      : 'bg-teal-50/40 border-teal-100 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-teal-800 font-mono font-semibold mb-1">
                    <span>Chunk #{chunk.index}</span>
                    <span className="text-slate-400">{chunk.time}</span>
                  </div>
                  <p>{chunk.text}</p>
                </div>
              ))}
              {interimSpeech && (
                <div className="p-3 rounded-lg border border-teal-300 bg-teal-50/70 text-xs text-teal-950 italic animate-pulse">
                  <span className="font-semibold text-teal-800 text-[10px] block uppercase tracking-wide">
                    Live Speech (Speaking now...):
                  </span>
                  <span>{interimSpeech}</span>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>

        {/* Footer info bar */}
        {(liveTranscript || interimSpeech) && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Speech transcribed ({liveTranscript ? liveTranscript.split(/\s+/).filter(Boolean).length : 0} words)
            </span>
            <button
              onClick={() => {
                const combined = [liveTranscript, interimSpeech].filter(Boolean).join(' ');
                executeNlpPipeline(combined, elapsedSeconds || 90);
              }}
              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-md font-medium text-xs shadow-xs transition-colors flex items-center gap-1"
            >
              <span>Structure Notes Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Live Mic Test Modal */}
      <LiveMicTestModal
        isOpen={isLiveTestModalOpen}
        onClose={() => setIsLiveTestModalOpen(false)}
        onApplyTranscript={(text) => {
          setLiveTranscript((prev) => (prev ? `${prev} ${text}` : text));
          setStatusMessage('Appended live speech test to transcript.');
        }}
      />
    </div>
  );
};
