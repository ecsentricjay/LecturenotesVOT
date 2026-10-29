# LectureNote AI: Voice-to-Text Lecture Note Generator

A minimalist, high-reliability front-end-only web application designed for a final-year project defense. It captures lecture audio via microphone or file upload, transcribes it through Groq's Whisper API via a secure local Vite proxy, extracts structured topic summaries using a pure JavaScript TF-IDF and sentence centrality NLP engine, renders academic notes with interactive keywords, exports publication-ready DOCX and PDF documents, and stores sessions locally.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed based on your project requirements:
> - **Default Execution Mode**: Demo mode is enabled by default with a sample computer science / neural networks lecture, allowing an instant, guaranteed-working defense presentation with zero network latency. A prominent mode switch enables live microphone and Groq Whisper transcription on demand.
> - **Audio Recording Pipeline**: Browser MediaRecorder configured for `audio/webm;codecs=opus` with fallback to `audio/mp4` and `audio/wav`. 30-second rolling chunk intervals with Web Audio API `AnalyserNode` RMS thresholding (skipping silent intervals).
> - **Interactive Keyword Chips**: Topic keyword chips in the note preview are interactive—clicking a keyword highlights its occurrences across bullet points and the raw transcript.
> - **Pure Client-Side Export**: Complete in-browser document generation using `docx` and `pdf-lib` with Times New Roman typography, double spacing, academic metadata header, and comprehensive keyword glossary.

---

## 1. Overview & Core Concept

- **What It Does**: Transcribes live lecture speech or uploaded audio into text, autonomously detects topic transitions using text similarity sliding windows, extracts key domain concepts, generates concise bullet summaries, and formats the output into standard academic notes available for instant on-screen review and DOCX/PDF download.
- **Target Audience / Persona**: University students, researchers, and defense committee evaluators seeking structured, standardized study notes without relying on external cloud databases, logins, or paid subscription APIs.
- **Key Value**: 100% reliable local defense execution with a graceful demo fallback, strict privacy (all structuring and storage happen client-side in the browser), and zero server maintenance.

---

## 2. User Experience & Visual Design

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  SIDEBAR (#113C3C)       │  MAIN CONTENT CANVAS (#F1F5F7)                                   │
│                          │                                                                 │
│  [Logo] LectureNote      │  [Header / Top Zone: View Title + Demo/Live Badge + Status]     │
│                          │ ─────────────────────────────────────────────────────────────── │
│  [+] New Session         │  [Metadata Grid: Course, Code, Lecturer, Date, Topic]           │
│  [↑] Upload Audio        │ ─────────────────────────────────────────────────────────────── │
│  [=] Note Preview        │  [Active Stage: Recording Controls + Timer + RMS VU Meter OR   │
│  [D] Session History     │   Drop Zone + 5-Step Pipeline Progress Stepper]                 │
│                          │ ─────────────────────────────────────────────────────────────── │
│  ──────────────────────  │  [Live Transcript Panel / Synchronous Segment Stream]           │
│  [Sample Lecture Button] │                                                                 │
│  [Defense Script Guide]  │                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Color Palette & Visual Tone**:
  - Dominant Neutral: Canvas light background `#F1F5F7` with crisp white structural cards (`#FFFFFF`) and hairline slate borders (`#E2E8F0`).
  - Primary Teal: `#0F766E` for primary action buttons, active tab indicators, and progress states.
  - Deep Academic Teal Sidebar: `#113C3C` with crisp white navigation labels and subtle emerald hover highlights.
  - Typography: Clean Inter font hierarchy for high legibility, paired with tabular numerals for audio timers and RMS meters, and Times New Roman serif styling for academic note previews and document exports.
- **Views & Flows**:
  1. **New Session**: Metadata inputs, large recording control button with elapsed duration timer, live Web Audio API RMS visualizer bar, real-time chunk streaming status, and live transcript scroll box.
  2. **Upload Audio**: File drop zone supporting `.wav`, `.mp3`, `.m4a` up to 25 MB with instantaneous size validation, paired with a 5-step progress stepper (*Transcribing* $\to$ *Segmenting* $\to$ *Keywords* $\to$ *Summarising* $\to$ *Generating Note*).
  3. **Note Preview**: Academic metadata header card, numbered topic breakdown cards (with heading, 5 interactive keyword chips, and 3–5 bullet points), raw transcript inspector modal/tab, and 1-click Download DOCX & PDF buttons.
  4. **Session History**: Chronological table of saved lecture sessions from `localStorage`, with one-click note restoration, re-export, and storage management.

---

## 3. Key Product Decisions & Trade-Offs

- **Vite Dev Server Proxy for Groq Whisper**:
  - *Chosen Approach*: Route `/groq/audio/transcriptions` $\to$ `https://api.groq.com/openai/v1/audio/transcriptions` via `vite.config.ts`, automatically injecting `Authorization: Bearer ${process.env.GROQ_API_KEY}` on localhost.
  - *Why*: Satisfies security standards (the API key is never bundled into client JavaScript) while remaining 100% serverless for the client bundle without requiring a separate backend Node/Python server.
- **Pure JavaScript NLP Pipeline (`src/nlp.js`)**:
  - *Chosen Approach*: Pure algorithmic TF-IDF vectorizer, sliding-window cosine similarity boundary detection (`SIMILARITY_THRESHOLD`), and sentence graph centrality ranking for extractive summarization.
  - *Why*: Zero network dependencies, zero cold-start latency, completely deterministic, and operates with sub-50ms execution speed directly on the user's laptop.
- **Dual Defense Safety Net**:
  - *Chosen Approach*: Embedded `src/demo/sample.json` containing a high-quality university lecture on "Deep Learning & Neural Network Architectures" with pre-split 30-second audio simulation chunks.
  - *Why*: Even if the presentation venue experiences Wi-Fi loss, microphone hardware denial, or Groq API rate limits, the student can toggle Demo Mode or click "Load sample lecture" for an end-to-end, flawless live demonstration.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BROWSER RUNTIME                                 │
│                                                                             │
│  ┌──────────────────────┐      ┌─────────────────┐      ┌────────────────┐  │
│  │   Audio Capture      │      │   Demo Streamer │      │  File Dropper  │  │
│  │ (getUserMedia,       │      │ (src/demo/      │      │ (WAV/MP3/M4A   │  │
│  │  MediaRecorder 30s,  │      │  sample.json    │      │  File upload   │  │
│  │  AnalyserNode RMS)   │      │  1-2s intervals)│      │  ≤ 25 MB)      │  │
│  └──────────┬───────────┘      └────────┬────────┘      └───────┬────────┘  │
│             │                           │                       │           │
│             ▼                           ▼                       ▼           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                  Transcription Interface Layer                        │  │
│  │    • Live Mode: POST /groq/audio/transcriptions (FormData multipart)   │  │
│  │    • Demo Mode: Simulated streaming chunks accumulator                │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │ Raw Transcript Text                   │
│                                     ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                   NLP Pipeline Module (src/nlp.js)                    │  │
│  │  1. Sentence Tokenizer (regex with abbreviation protection)           │  │
│  │  2. TF-IDF Matrix Generator (unigrams + bigrams, stopword filter)     │  │
│  │  3. Sliding Window Topic Segmentation (cosine similarity threshold)   │  │
│  │  4. Centrality Extractive Summarization (top 3-5 sentences per topic) │  │
│  │  5. Keyword Ranking & Glossary Compilation                            │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │ Structured Note Object                │
│                                     ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                       Presentation & Export                           │  │
│  │  • Interactive React UI with Keyword Search & Highlighting            │  │
│  │  • localStorage Persistence (sessions history schema)                 │  │
│  │  • DOCX Engine (docx: Times New Roman 12pt, double space, headings)   │  │
│  │  • PDF Engine (pdf-lib: TimesRoman, wrapped pagination, glossary)     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ Vite Proxy (/groq/*)
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │       Groq Cloud API (whisper-large-v3)         │
             └─────────────────────────────────────────────────┘
```

### Data Schema
- **`LectureSession`**:
  ```ts
  interface LectureMetadata {
    courseTitle: string;
    courseCode: string;
    lecturer: string;
    date: string;
    lectureTopic: string;
  }

  interface TopicSection {
    id: string;
    heading: string;
    keywords: string[];
    bullets: string[];
    sentences: string[];
  }

  interface LectureSession {
    id: string;
    timestamp: number;
    metadata: LectureMetadata;
    rawTranscript: string;
    sections: TopicSection[];
    glossary: { term: string; count: number }[];
    durationSeconds: number;
  }
  ```

---

## 5. Phased Implementation Roadmap

1. **Step 1: NLP Engine & Document Export**
   - Install required client dependencies: `docx`, `pdf-lib`.
   - Implement `src/nlp.js` featuring sentence boundary detection, TF-IDF calculation, cosine similarity, window segmentation, keyword extraction, and extractive summarization.
   - Implement `src/export/docxExport.ts` and `src/export/pdfExport.ts` adhering strictly to academic formatting guidelines (Times New Roman, 12pt, double line-spacing, metadata block, and glossary).
   - Test NLP and export with a realistic 1,500-word lecture transcript.

2. **Step 2: Core UI Views & Bundled Demo Mode**
   - Create `src/demo/sample.json` containing authentic lecture text and timed chunk definitions.
   - Build App shell with teal sidebar navigation (`#113C3C`), top banner with status and defense script modal, and responsive main view switching.
   - Build **New Session** view with metadata form, audio level meter, timer, live transcript box, and sample lecture runner.
   - Build **Upload Audio** view with drag-and-drop file picker, format/size validation, and 5-step progress stepper.
   - Build **Note Preview** view with metadata summary, structured topic cards, keyword filtering, and raw transcript modal.

3. **Step 3: Vite Dev Proxy & Live Groq Transcription**
   - Configure `vite.config.ts` proxy forwarding `/groq/*` to `https://api.groq.com/` with injected `GROQ_API_KEY`.
   - Create `.env.example` with `GROQ_API_KEY` and `VITE_DEMO_MODE=true`.
   - Wire `getUserMedia` and `MediaRecorder` with 30-second rolling segmentation and Web Audio RMS silence detection.
   - Implement error banners for mic permission denied, network failure, or API rate limits.

4. **Step 4: Session History & Final Polish**
   - Implement `localStorage` session manager for saving, loading, and deleting past lecture notes.
   - Provide comprehensive README with setup steps, architecture breakdown, and 5-minute defense presentation script.
   - Verify build integrity with `compile_applet`.
