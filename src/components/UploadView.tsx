import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileAudio,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { LectureMetadata, LectureSession } from '../types';
import sampleData from '../demo/sample.json';
import { transcribeAudio } from '../services/groqTranscription';
import { structureNote, buildGlossary } from '../nlp.js';

interface UploadViewProps {
  demoMode: boolean;
  metadata: LectureMetadata;
  setMetadata: React.Dispatch<React.SetStateAction<LectureMetadata>>;
  onSessionGenerated: (session: LectureSession) => void;
  onLoadSample: () => void;
}

type StepperStage = 'idle' | 'transcribing' | 'segmenting' | 'keywords' | 'summarising' | 'generating' | 'completed';

export const UploadView: React.FC<UploadViewProps> = ({
  demoMode,
  metadata,
  setMetadata,
  onSessionGenerated,
  onLoadSample,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<StepperStage>('idle');
  const [stepDetail, setStepDetail] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB Groq free-tier limit
  const ACCEPTED_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.mp4', '.mpeg', '.webm', '.ogg'];

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null);
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setErrorMessage(
        `Unsupported audio format (${ext}). Supported formats: WAV, MP3, M4A, WEBM, OGG.`
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setErrorMessage(
        `File is too large (${sizeMb} MB). Groq Whisper free tier enforces a strict 25 MB limit.`
      );
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Process Uploaded File through Stepper Pipeline
   */
  const handleProcessAudio = async () => {
    if (!selectedFile) {
      setErrorMessage('Please choose or drag an audio file (WAV, MP3, M4A up to 25 MB).');
      return;
    }

    setErrorMessage(null);

    try {
      let transcriptText = '';

      // Step 1: Transcribing
      if (selectedFile) {
        setStepDetail(`Sending ${selectedFile.name} to Groq Whisper API (whisper-large-v3)...`);
        transcriptText = await transcribeAudio(selectedFile, selectedFile.name);
      } else {
        setStepDetail('Loading sample lecture audio transcript...');
        await delay(1000);
        transcriptText = sampleData.fullTranscript;
      }

      if (!transcriptText || transcriptText.trim().length === 0) {
        throw new Error('Transcription returned empty text. Please verify audio clarity.');
      }

      // Step 2: Segmenting Topics
      setCurrentStep('segmenting');
      setStepDetail('Executing sentence tokenization and sliding-window cosine similarity...');
      await delay(600);

      const sections = structureNote(transcriptText);
      if (!sections || sections.length === 0) {
        throw new Error('Could not identify distinct topic boundaries in transcript.');
      }

      // Step 3: Extracting Keywords
      setCurrentStep('keywords');
      setStepDetail('Calculating TF-IDF weights and ranking domain unigrams and bigrams...');
      await delay(500);

      // Step 4: Summarising Points
      setCurrentStep('summarising');
      setStepDetail('Computing graph centrality matrix and ranking core explanatory sentences...');
      await delay(500);

      // Step 5: Generating Note
      setCurrentStep('generating');
      setStepDetail('Compiling academic section headings, keyword glossary, and export models...');
      await delay(500);

      const glossary = buildGlossary(sections);

      const session: LectureSession = {
        id: `session-${Date.now()}`,
        timestamp: Date.now(),
        metadata: { ...metadata },
        rawTranscript: transcriptText,
        sections,
        glossary,
        durationSeconds: selectedFile ? Math.round(selectedFile.size / 32000) : 180,
      };

      setCurrentStep('completed');
      setStepDetail('Note successfully generated! Navigating to preview...');
      await delay(400);

      onSessionGenerated(session);
    } catch (err: any) {
      console.error('Processing error:', err);
      setCurrentStep('idle');
      setErrorMessage(err.message || 'An error occurred during audio processing.');
    }
  };

  const stepsList = [
    { key: 'transcribing', label: '1. Transcribing Audio', desc: 'Whisper large-v3' },
    { key: 'segmenting', label: '2. Segmenting Topics', desc: 'Cosine similarity' },
    { key: 'keywords', label: '3. Extracting Keywords', desc: 'TF-IDF Unigrams & Bigrams' },
    { key: 'summarising', label: '4. Summarising Key Points', desc: 'Sentence Centrality' },
    { key: 'generating', label: '5. Generating Note', desc: 'DOCX & PDF compilation' },
  ];

  const getStepIndex = (step: StepperStage) => {
    switch (step) {
      case 'transcribing':
        return 0;
      case 'segmenting':
        return 1;
      case 'keywords':
        return 2;
      case 'summarising':
        return 3;
      case 'generating':
        return 4;
      case 'completed':
        return 5;
      default:
        return -1;
    }
  };

  const currentIdx = getStepIndex(currentStep);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-red-900">Upload Notice</h4>
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

      {/* Metadata Form Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-teal-700" />
            <h3 className="font-semibold text-slate-900 text-sm">Lecture Metadata</h3>
          </div>
          <span className="text-xs text-slate-400">Included on generated notes</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Course Title</label>
            <input
              type="text"
              value={metadata.courseTitle}
              onChange={(e) => setMetadata((p) => ({ ...p, courseTitle: e.target.value }))}
              placeholder="e.g. Artificial Intelligence & Neural Systems"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 focus:bg-white text-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Course Code</label>
            <input
              type="text"
              value={metadata.courseCode}
              onChange={(e) => setMetadata((p) => ({ ...p, courseCode: e.target.value }))}
              placeholder="e.g. CSC 411"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 focus:bg-white text-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={metadata.date}
              onChange={(e) => setMetadata((p) => ({ ...p, date: e.target.value }))}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 focus:bg-white text-slate-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Lecturer</label>
            <input
              type="text"
              value={metadata.lecturer}
              onChange={(e) => setMetadata((p) => ({ ...p, lecturer: e.target.value }))}
              placeholder="e.g. Prof. Katherine Vance"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 focus:bg-white text-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Lecture Topic</label>
            <input
              type="text"
              value={metadata.lectureTopic}
              onChange={(e) => setMetadata((p) => ({ ...p, lectureTopic: e.target.value }))}
              placeholder="e.g. Deep Neural Architectures & Backpropagation"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 focus:bg-white text-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Audio Drop Zone */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,.mp3,.m4a,.mp4,.mpeg,.webm,.ogg"
          onChange={handleFileChange}
          className="hidden"
        />

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150 ${
            isDragging
              ? 'border-teal-600 bg-teal-50/50 scale-[1.01]'
              : selectedFile
              ? 'border-teal-400 bg-teal-50/30'
              : 'border-slate-300 hover:border-teal-600 hover:bg-slate-50/60'
          }`}
        >
          {selectedFile ? (
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center">
                <FileAudio className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-slate-900 text-sm">{selectedFile.name}</h4>
              <p className="text-xs text-slate-500 font-mono">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Ready to transcribe
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                }}
                className="text-xs text-red-600 hover:underline pt-1"
              >
                Choose a different file
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-teal-700 flex items-center justify-center">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-slate-900 text-sm">
                Drop your lecture audio here, or browse
              </h4>
              <p className="text-xs text-slate-500 max-w-md">
                Supports WAV, MP3, M4A, WEBM audio formats up to 25 MB (Groq free-tier limit).
              </p>
              <span className="text-[11px] text-teal-700 font-medium pt-1">
                Click to browse files from your computer
              </span>
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onLoadSample}
            className="text-xs text-slate-600 hover:text-teal-800 font-medium flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Use Bundled Sample File Instead</span>
          </button>

          <button
            type="button"
            onClick={handleProcessAudio}
            disabled={currentStep !== 'idle' && currentStep !== 'completed'}
            className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-sm flex items-center gap-2 cursor-pointer transition-all"
          >
            {currentStep !== 'idle' && currentStep !== 'completed' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Audio Pipeline...</span>
              </>
            ) : (
              <>
                <span>Transcribe & Structure Notes</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Progress Stepper (Always visible or activated on process) */}
        <div className="pt-6 border-t border-slate-100">
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-4">
            Note Generation Stepper
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {stepsList.map((step, idx) => {
              const isPast = currentIdx > idx;
              const isCurrent = currentIdx === idx;
              const isPending = currentIdx < idx;

              return (
                <div
                  key={step.key}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isCurrent
                      ? 'border-teal-600 bg-teal-50/70 shadow-xs'
                      : isPast
                      ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900'
                      : 'border-slate-200 bg-slate-50/50 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {isPast ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="w-4 h-4 text-teal-700 animate-spin shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-300 text-[10px] font-mono flex items-center justify-center text-slate-400">
                        {idx + 1}
                      </div>
                    )}
                    <span
                      className={`text-xs font-semibold truncate ${
                        isCurrent
                          ? 'text-teal-900'
                          : isPast
                          ? 'text-emerald-900'
                          : 'text-slate-600'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{step.desc}</p>
                </div>
              );
            })}
          </div>

          {stepDetail && (
            <p className="mt-3 text-xs text-teal-800 font-mono bg-teal-50/50 p-2.5 rounded-md border border-teal-100">
              {stepDetail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
