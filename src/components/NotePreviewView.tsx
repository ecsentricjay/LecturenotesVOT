import React, { useState } from 'react';
import {
  Download,
  FileText,
  Copy,
  Check,
  Search,
  BookOpen,
  Calendar,
  User,
  Hash,
  Sparkles,
  Layers,
  ArrowLeft,
  GraduationCap,
} from 'lucide-react';
import { LectureSession } from '../types';
import { generateDocx, downloadBlob } from '../export/docxExport';
import { generatePdf } from '../export/pdfExport';

interface NotePreviewViewProps {
  session: LectureSession | null;
  onNewSession: () => void;
  onLoadSample: () => void;
}

export const NotePreviewView: React.FC<NotePreviewViewProps> = ({
  session,
  onNewSession,
  onLoadSample,
}) => {
  const [activeTab, setActiveTab] = useState<'structured' | 'raw' | 'glossary'>('structured');
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  if (!session) {
    return (
      <div className="p-12 max-w-3xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center mx-auto">
          <FileText className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">No Note Generated Yet</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          Record a live lecture in New Session, upload an audio file, or immediately load the sample
          lecture to view and export structured notes.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            onClick={onLoadSample}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Load Sample Lecture</span>
          </button>
          <button
            onClick={onNewSession}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go to New Session</span>
          </button>
        </div>
      </div>
    );
  }

  const { metadata, sections, glossary, rawTranscript } = session;

  const sanitizeFilename = (name: string) => {
    return (name || 'Lecture_Notes').replace(/[^a-zA-Z0-9_-]/g, '_');
  };

  const handleDownloadDocx = async () => {
    try {
      setIsExportingDocx(true);
      const blob = await generateDocx(metadata, sections, glossary);
      const filename = `${sanitizeFilename(metadata.courseCode || 'Note')}_${sanitizeFilename(
        metadata.lectureTopic || 'Lecture'
      )}.docx`;
      downloadBlob(blob, filename);
    } catch (err) {
      console.error('Failed to export DOCX:', err);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      const blob = await generatePdf(metadata, sections, glossary);
      const filename = `${sanitizeFilename(metadata.courseCode || 'Note')}_${sanitizeFilename(
        metadata.lectureTopic || 'Lecture'
      )}.pdf`;
      downloadBlob(blob, filename);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleCopyTranscript = () => {
    navigator.clipboard.writeText(rawTranscript);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const totalWords = rawTranscript ? rawTranscript.split(/\s+/).filter(Boolean).length : 0;
  const estimatedReadTimeMins = Math.ceil(totalWords / 200);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setActiveTab('structured')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'structured'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Structured Note ({sections.length} Topics)
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'raw'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Raw Transcript
          </button>
          <button
            onClick={() => setActiveTab('glossary')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'glossary'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Keyword Glossary ({glossary.length})
          </button>
        </div>

        {/* Download Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleDownloadDocx}
            disabled={isExportingDocx}
            className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingDocx ? 'Generating DOCX...' : 'Download DOCX'}</span>
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="flex-1 sm:flex-none px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-medium shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* Metadata Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-4">
          <div>
            <span className="text-xs font-semibold text-teal-700 tracking-wider uppercase">
              Academic Lecture Notes
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">
              {metadata.lectureTopic || 'Lecture Note'}
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
            <span>{totalWords} words</span>
            <span>·</span>
            <span>~{estimatedReadTimeMins} min read</span>
            <span>·</span>
            <span className="text-teal-700 font-semibold">{sections.length} topic segments</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="flex items-start gap-2">
            <BookOpen className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[11px]">Course</span>
              <span className="font-semibold text-slate-800">
                {metadata.courseTitle || 'Untitled Course'}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Hash className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[11px]">Code</span>
              <span className="font-semibold text-slate-800">{metadata.courseCode || 'N/A'}</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[11px]">Lecturer</span>
              <span className="font-semibold text-slate-800">{metadata.lecturer || 'N/A'}</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[11px]">Date</span>
              <span className="font-semibold text-slate-800">{metadata.date}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Keyword Highlighting Banner */}
      {selectedKeyword && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>
              Highlighting sentences mentioning: <strong>"{selectedKeyword}"</strong>
            </span>
          </div>
          <button
            onClick={() => setSelectedKeyword(null)}
            className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline cursor-pointer"
          >
            Clear Highlight
          </button>
        </div>
      )}

      {/* Tab 1: Structured Academic Note */}
      {activeTab === 'structured' && (
        <div className="space-y-6">
          {sections.map((section, idx) => (
            <div
              key={section.id}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-colors"
            >
              {/* Topic Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    {section.heading}
                  </h3>
                </div>
              </div>

              {/* Keyword Chips (Interactive) */}
              <div className="flex flex-wrap items-center gap-1.5 mb-4 pb-3 border-b border-slate-100">
                <span className="text-[11px] font-serif italic text-slate-500 mr-1">
                  Keywords:
                </span>
                {section.keywords.map((kw) => {
                  const isSelected = selectedKeyword === kw.toLowerCase();
                  return (
                    <button
                      key={kw}
                      onClick={() =>
                        setSelectedKeyword(isSelected ? null : kw.toLowerCase())
                      }
                      title="Click to highlight in text"
                      className={`text-xs px-2.5 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 shadow-xs ring-2 ring-amber-400/40'
                          : 'bg-slate-100 hover:bg-teal-50 hover:text-teal-900 text-slate-700 border border-slate-200/60'
                      }`}
                    >
                      {kw}
                    </button>
                  );
                })}
              </div>

              {/* Bullet Summaries (3 to 5 sentences) */}
              <ul className="space-y-3 font-serif text-slate-800 leading-relaxed text-sm">
                {section.bullets.map((bullet, bulletIdx) => {
                  const containsKeyword =
                    selectedKeyword && bullet.toLowerCase().includes(selectedKeyword);

                  return (
                    <li
                      key={bulletIdx}
                      className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                        containsKeyword
                          ? 'bg-amber-50/80 border-l-2 border-amber-400 pl-3'
                          : ''
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-700 mt-2 shrink-0"></span>
                      <p className="flex-1 text-[13px] leading-relaxed">{bullet}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Keyword Glossary Card at end of structured view */}
          {glossary && glossary.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
                <GraduationCap className="w-4 h-4 text-teal-700" />
                <h3 className="font-semibold text-slate-900 text-sm">
                  Alphabetical Keyword Glossary
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {glossary.map((item) => (
                  <div key={item.term} className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900">{item.term}</span>
                      <span className="text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded font-mono">
                        {item.count}x
                      </span>
                    </div>
                    <p className="text-slate-600 font-serif leading-relaxed line-clamp-2">
                      {item.example}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Raw Transcript Tab */}
      {activeTab === 'raw' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                placeholder="Search within transcript..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 text-slate-900"
              />
            </div>
            <button
              onClick={handleCopyTranscript}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium flex items-center gap-1.5 self-start cursor-pointer"
            >
              {copiedTranscript ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Full Transcript</span>
                </>
              )}
            </button>
          </div>

          <div className="font-sans text-xs sm:text-sm leading-relaxed text-slate-800 p-4 bg-slate-50/50 rounded-lg border border-slate-200/80 whitespace-pre-wrap max-h-96 overflow-y-auto">
            {transcriptSearch
              ? rawTranscript
                  .split(new RegExp(`(${transcriptSearch})`, 'gi'))
                  .map((part, i) =>
                    part.toLowerCase() === transcriptSearch.toLowerCase() ? (
                      <mark key={i} className="bg-amber-300 text-slate-900 px-0.5 rounded-xs">
                        {part}
                      </mark>
                    ) : (
                      part
                    )
                  )
              : rawTranscript}
          </div>
        </div>
      )}

      {/* Tab 3: Keyword Glossary Tab */}
      {activeTab === 'glossary' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Comprehensive Glossary</h3>
              <p className="text-xs text-slate-500">
                Alphabetical inventory of key domain terminology and contextual occurrences.
              </p>
            </div>
            <span className="text-xs font-mono text-teal-800 bg-teal-50 px-2 py-1 rounded">
              {glossary.length} Unique Concepts
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {glossary.map((item) => (
              <div key={item.term} className="py-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm">{item.term}</h4>
                  <span className="text-xs text-slate-400 font-mono">
                    Occurrences: {item.count}
                  </span>
                </div>
                <p className="text-xs font-serif text-slate-600 mt-1 leading-relaxed">
                  {item.example}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
