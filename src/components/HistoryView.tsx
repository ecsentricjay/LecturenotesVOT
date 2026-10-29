import React, { useState } from 'react';
import {
  History,
  Search,
  Download,
  Trash2,
  Calendar,
  Clock,
  BookOpen,
  ArrowRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import { LectureSession } from '../types';
import { generateDocx, downloadBlob } from '../export/docxExport';
import { generatePdf } from '../export/pdfExport';

interface HistoryViewProps {
  sessions: LectureSession[];
  onSelectSession: (session: LectureSession) => void;
  onDeleteSession: (id: string) => void;
  onClearAll: () => void;
  onLoadSample: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  sessions,
  onSelectSession,
  onDeleteSession,
  onClearAll,
  onLoadSample,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [exportingId, setExportingId] = useState<string | null>(null);

  const filteredSessions = sessions.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.metadata.courseTitle?.toLowerCase().includes(q) ||
      s.metadata.courseCode?.toLowerCase().includes(q) ||
      s.metadata.lectureTopic?.toLowerCase().includes(q) ||
      s.metadata.lecturer?.toLowerCase().includes(q)
    );
  });

  const sanitizeFilename = (name: string) => {
    return (name || 'Lecture_Notes').replace(/[^a-zA-Z0-9_-]/g, '_');
  };

  const handleDownloadDocx = async (e: React.MouseEvent, session: LectureSession) => {
    e.stopPropagation();
    try {
      setExportingId(`${session.id}-docx`);
      const blob = await generateDocx(session.metadata, session.sections, session.glossary);
      const filename = `${sanitizeFilename(session.metadata.courseCode || 'Note')}_${sanitizeFilename(
        session.metadata.lectureTopic || 'Lecture'
      )}.docx`;
      downloadBlob(blob, filename);
    } catch (err) {
      console.error('Failed to export DOCX:', err);
    } finally {
      setExportingId(null);
    }
  };

  const handleDownloadPdf = async (e: React.MouseEvent, session: LectureSession) => {
    e.stopPropagation();
    try {
      setExportingId(`${session.id}-pdf`);
      const blob = await generatePdf(session.metadata, session.sections, session.glossary);
      const filename = `${sanitizeFilename(session.metadata.courseCode || 'Note')}_${sanitizeFilename(
        session.metadata.lectureTopic || 'Lecture'
      )}.pdf`;
      downloadBlob(blob, filename);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setExportingId(null);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved lectures by title, topic, or code..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 text-slate-900"
          />
        </div>

        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to clear your local session history?')) {
                  onClearAll();
                }
              }}
              className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-colors cursor-pointer"
            >
              Clear Archive
            </button>
          )}
          <button
            onClick={onLoadSample}
            className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-700" />
            <span>Load Sample Session</span>
          </button>
        </div>
      </div>

      {/* Session Cards List */}
      {filteredSessions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <History className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-800">No Sessions Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? 'No lecture sessions match your search query.'
              : 'Your localStorage history is empty. Record a new session or load the bundled sample.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => onSelectSession(session)}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-teal-600 hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-teal-800 transition-colors">
                      {session.metadata.lectureTopic || 'Untitled Lecture Topic'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {session.metadata.courseCode && (
                        <span className="font-semibold text-slate-700 mr-2">
                          {session.metadata.courseCode}
                        </span>
                      )}
                      <span>{session.metadata.courseTitle}</span>
                      {session.metadata.lecturer && <span> · {session.metadata.lecturer}</span>}
                    </p>
                  </div>
                </div>

                {/* Right side stats */}
                <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {session.metadata.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {formatDuration(session.durationSeconds || 120)}
                  </span>
                  <span className="bg-teal-50 text-teal-800 px-2 py-0.5 rounded font-sans font-semibold">
                    {session.sections.length} Topics
                  </span>
                </div>
              </div>

              {/* Bottom Quick Actions & Topic Previews */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-serif italic">Topics:</span>
                  {session.sections.slice(0, 4).map((sec, i) => (
                    <span
                      key={sec.id}
                      className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded"
                    >
                      {i + 1}. {sec.heading}
                    </span>
                  ))}
                  {session.sections.length > 4 && (
                    <span className="text-[11px] text-slate-400">
                      +{session.sections.length - 4} more
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => handleDownloadDocx(e, session)}
                    title="Export DOCX directly"
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDownloadPdf(e, session)}
                    title="Export PDF directly"
                    className="p-1.5 text-slate-600 hover:text-teal-800 hover:bg-teal-50 rounded-md border border-slate-200 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-teal-700" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    title="Delete session"
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center gap-1 text-teal-700 font-semibold pl-2">
                    <span>Reopen</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
