import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  X,
  Volume2,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { LiveSpeechRecognizer } from '../services/liveSpeechRecognizer';
import { transcribeAudio } from '../services/groqTranscription';

interface LiveMicTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTranscript?: (text: string) => void;
}

export const LiveMicTestModal: React.FC<LiveMicTestModalProps> = ({
  isOpen,
  onClose,
  onApplyTranscript,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [spokenWords, setSpokenWords] = useState<string[]>([]);
  const [interimWord, setInterimWord] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Click "Start Test" and speak clearly into your mic.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [whisperResult, setWhisperResult] = useState<string | null>(null);
  const [isWhisperVerifying, setIsWhisperVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  const recognizerRef = useRef<LiveSpeechRecognizer | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const fullTranscribedText = (
    [...spokenWords, interimWord].filter(Boolean).join(' ') ||
    whisperResult ||
    ''
  ).trim();

  const handleStartTest = async () => {
    setErrorMessage(null);
    setSpokenWords([]);
    setInterimWord('');
    setWhisperResult(null);
    setElapsedSeconds(0);
    setStatusMessage('Listening... speak now!');

    const recognizer = new LiveSpeechRecognizer();
    recognizerRef.current = recognizer;

    try {
      await recognizer.start({
        onInterimText: (text) => {
          setInterimWord(text);
          setStatusMessage('Detecting speech...');
        },
        onFinalText: (text) => {
          setSpokenWords((prev) => [...prev, text]);
          setInterimWord('');
        },
        onLevelUpdate: (lvl) => {
          setAudioLevel(lvl);
        },
        onError: (err) => {
          setErrorMessage(err);
        },
      });

      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not start microphone.');
      setIsRecording(false);
    }
  };

  const handleStopTest = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
    setAudioLevel(0);
    setStatusMessage('Speech captured! Finalizing transcription...');

    if (recognizerRef.current) {
      const audioBlob = await recognizerRef.current.stop();
      recognizerRef.current = null;

      // Also attempt Groq Whisper verification if audio blob is present
      if (audioBlob && audioBlob.size > 2000) {
        setIsWhisperVerifying(true);
        setStatusMessage('Verifying via Groq Whisper API (whisper-large-v3)...');
        try {
          const whisperText = await transcribeAudio(audioBlob, 'test_sample.webm');
          if (whisperText) {
            setWhisperResult(whisperText);
            setStatusMessage('Transcription verified via Groq Whisper!');
          }
        } catch (err: any) {
          console.log('Groq proxy verification note:', err.message);
          // If Groq fails (e.g. no key or network), our client speech transcript is still preserved!
          setStatusMessage('Live speech transcription complete.');
        } finally {
          setIsWhisperVerifying(false);
        }
      } else {
        setStatusMessage('Live speech transcription complete.');
      }
    }
  };

  const handleCopy = () => {
    if (fullTranscribedText) {
      navigator.clipboard.writeText(fullTranscribedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApply = () => {
    if (onApplyTranscript && fullTranscribedText) {
      onApplyTranscript(fullTranscribedText);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 bg-[#113C3C] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-teal-300" />
            <div>
              <h3 className="font-bold text-base text-white">Live Microphone Speech Test</h3>
              <p className="text-xs text-teal-300/80">Speak a phrase to test live voice transcription</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isRecording) handleStopTest();
              onClose();
            }}
            className="p-1 rounded-lg text-teal-300 hover:text-white hover:bg-teal-900/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Test Controls */}
          <div className="flex flex-col items-center justify-center py-4 bg-slate-50 rounded-xl border border-slate-200">
            {!isRecording ? (
              <button
                onClick={handleStartTest}
                className="w-20 h-20 rounded-full bg-teal-700 hover:bg-teal-800 text-white flex flex-col items-center justify-center gap-1 shadow-lg shadow-teal-700/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Mic className="w-7 h-7" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Speak</span>
              </button>
            ) : (
              <button
                onClick={handleStopTest}
                className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 text-white flex flex-col items-center justify-center gap-1 shadow-lg shadow-red-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer animate-pulse"
              >
                <Square className="w-6 h-6 fill-white" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Done</span>
              </button>
            )}

            <div className="mt-3 text-center">
              <p className="text-xs font-semibold text-slate-800">
                {isRecording ? `Listening (${elapsedSeconds}s)` : 'Ready to Test'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">{statusMessage}</p>
            </div>

            {/* Audio Level VU Bar */}
            <div className="w-64 mt-3">
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                <span className="flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-teal-600" /> Mic Input Level
                </span>
                <span className="font-mono">{Math.round(audioLevel * 100)}%</span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-teal-600 rounded-full transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.max(5, audioLevel * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Real-time Transcribed Words Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Transcribed Speech</span>
              {isWhisperVerifying && (
                <span className="flex items-center gap-1 text-[11px] text-teal-700 font-mono">
                  <Loader2 className="w-3 h-3 animate-spin" /> Verifying with Whisper...
                </span>
              )}
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl min-h-24 max-h-48 overflow-y-auto font-sans text-sm text-slate-800 leading-relaxed shadow-2xs">
              {fullTranscribedText ? (
                <div>
                  <span className="font-medium text-slate-900">{spokenWords.join(' ')}</span>
                  {interimWord && (
                    <span className="text-teal-600 italic ml-1 underline decoration-teal-400">
                      {interimWord}...
                    </span>
                  )}
                  {whisperResult && (
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-teal-900 bg-teal-50/60 p-2 rounded">
                      <span className="font-semibold text-teal-800 block text-[10px] uppercase tracking-wider mb-0.5">
                        Groq Whisper Output:
                      </span>
                      {whisperResult}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-4 text-center text-slate-400 text-xs italic">
                  {isRecording
                    ? 'Start speaking into your microphone now...'
                    : 'Your transcribed words will appear here in real time.'}
                </div>
              )}
            </div>
          </div>

          {/* Prompt Suggestion */}
          <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-[11px] text-amber-900 flex items-center justify-between">
            <span>
              <strong>Sample prompt to say:</strong> "Artificial neural networks use gradient descent to optimize loss surfaces."
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {fullTranscribedText && (
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200/60 rounded-md border border-slate-200 flex items-center gap-1 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onApplyTranscript && fullTranscribedText && (
              <button
                onClick={handleApply}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>Use in Lecture Session</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => {
                if (isRecording) handleStopTest();
                onClose();
              }}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
