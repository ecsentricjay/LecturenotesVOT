import React from 'react';
import { X, CheckCircle2, Mic, Clock, Sparkles, Layers, Download } from 'lucide-react';

interface DefenseGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunSample: () => void;
}

export const DefenseGuideModal: React.FC<DefenseGuideModalProps> = ({
  isOpen,
  onClose,
  onRunSample,
}) => {
  if (!isOpen) return null;

  const scriptSteps = [
    {
      minute: '0:00 - 1:00',
      title: 'Problem Definition & Core Value Proposition',
      keyPoints: [
        '“Good morning/afternoon, distinguished committee members. Traditional manual note-taking in high-density university lectures forces students into continuous cognitive division between listening and transcribing.”',
        '“LectureNote AI provides an automated, client-side academic voice-to-text system that captures live speech, extracts topic boundaries using mathematical similarity, and formats publication-ready academic documents.”',
      ],
      action: 'Show the initial New Session dashboard with metadata form and audio level meter.',
    },
    {
      minute: '1:00 - 2:00',
      title: 'Live Speech Capture & 30-Second Rolling Chunks',
      keyPoints: [
        '“Rather than sending a huge monolithic audio recording that risks network timeouts or browser memory overflows, our pipeline uses MediaRecorder with 30-second rolling segments.”',
        '“Each chunk is validated using a Web Audio API AnalyserNode with Root Mean Square (RMS) silence detection to skip dead pauses before forwarding through our secure dev proxy to Groq’s Whisper-large-v3 model.”',
      ],
      action: 'Click "Start Recording" or toggle Demo Mode to stream the CSC 411 lecture chunks live on screen.',
    },
    {
      minute: '2:00 - 3:30',
      title: 'Pure JavaScript NLP Engine Architecture',
      keyPoints: [
        '“A key technical achievement of this project is that topic segmentation and summarization are executed 100% inside the browser with zero cloud server dependencies or expensive LLM token costs.”',
        '“1. Regex tokenization preserves academic abbreviations (Prof., Dr., e.g., i.e.).”',
        '“2. We construct TF-IDF vectors per sentence and detect topic transitions by comparing sliding windows of 3 sentences with a calibrated cosine similarity threshold.”',
        '“3. Extractive summarization ranks sentences via graph centrality, retaining the top 3-5 statements in their chronological order.”',
      ],
      action: 'Point to the numbered topic cards (01, 02, 03, 04) and demonstrate interactive keyword chips.',
    },
    {
      minute: '3:30 - 4:15',
      title: 'Interactive Review & DOCX/PDF Export',
      keyPoints: [
        '“Students can inspect the raw transcript with full-text search, or click any topic keyword chip to highlight contextual occurrences across the lecture.”',
        '“Our client-side export engine generates standardized academic DOCX and PDF documents with Times New Roman 12pt double-spaced typography, formal header metadata, and an alphabetical glossary.”',
      ],
      action: 'Click "Download DOCX" and "Download PDF" to show instant browser downloads.',
    },
    {
      minute: '4:15 - 5:00',
      title: 'Persistence, Resilience & Conclusion',
      keyPoints: [
        '“All generated sessions are stored locally in the browser’s localStorage, enabling instant retrieval and offline review.”',
        '“Thank you for your time. I welcome any questions from the panel.”',
      ],
      action: 'Open Session History view to show archived lecture records.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 bg-[#113C3C] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-300" />
            <div>
              <h3 className="font-bold text-base text-white">5-Minute Defense Presentation Script</h3>
              <p className="text-xs text-teal-300/80">Step-by-step walkthrough for your panel evaluation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-teal-300 hover:text-white hover:bg-teal-900/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-xs">
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-teal-900">
            <strong>Pro-Tip for Defense:</strong> Keep <em>Demo Mode</em> enabled or test with the bundled CSC 411 lecture first. It guarantees 100% flawless execution on localhost with zero Wi-Fi or API dependencies!
          </div>

          <div className="space-y-4">
            {scriptSteps.map((step, idx) => (
              <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">{step.title}</span>
                  <span className="font-mono text-[11px] font-semibold text-teal-700 bg-teal-100/60 px-2 py-0.5 rounded">
                    {step.minute}
                  </span>
                </div>

                <div className="space-y-1.5 pl-2 border-l-2 border-teal-600/40">
                  {step.keyPoints.map((kp, kIdx) => (
                    <p key={kIdx} className="text-slate-700 leading-relaxed italic text-[11px]">
                      {kp}
                    </p>
                  ))}
                </div>

                <div className="pt-1 flex items-center gap-1.5 text-slate-500 font-semibold text-[10px]">
                  <span className="text-teal-700 font-mono">ACTION:</span>
                  <span>{step.action}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => {
              onRunSample();
              onClose();
            }}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-semibold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load & Run Sample Lecture Now</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg font-semibold text-xs cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
