import React, { useState, useEffect } from 'react';
import { Key, X, Check, ExternalLink, AlertCircle, ShieldCheck } from 'lucide-react';
import { getSavedGroqApiKey, setSavedGroqApiKey } from '../services/groqTranscription';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey(getSavedGroqApiKey());
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedGroqApiKey(apiKey);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleClear = () => {
    setApiKey('');
    setSavedGroqApiKey('');
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 bg-[#113C3C] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600/30 border border-teal-500/40 flex items-center justify-center text-teal-300">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Groq API Key Setup</h3>
              <p className="text-[11px] text-teal-300/80">Whisper transcription credentials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-teal-300 hover:text-white hover:bg-teal-900/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">
              Groq API Key <span className="text-slate-400 font-normal">(starts with gsk_)</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 focus:bg-white text-slate-900"
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              If deploying on Vercel without environment variables, paste your free Groq key here. It is saved in your browser's localStorage and never transmitted elsewhere.
            </p>
          </div>

          <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl space-y-1.5 text-xs text-teal-900">
            <div className="flex items-center gap-1.5 font-semibold text-teal-800">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Free & Instant Groq Key</span>
            </div>
            <p className="text-[11px] text-teal-800/80 leading-normal">
              Groq provides free Whisper-large-v3 transcription with ultra-fast inference speed.
            </p>
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-900 underline pt-1"
            >
              <span>Get a free key at console.groq.com</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {savedSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Key settings saved successfully!</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {apiKey ? (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-red-600 hover:text-red-800 underline font-medium cursor-pointer"
              >
                Clear Key
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Key</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
