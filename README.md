# LectureNote AI: Voice-to-Text Academic Lecture Note Generator

A minimalist, high-reliability front-end-only lecture note generator designed for final-year project defense presentations. It captures live speech from the browser or accepts uploaded audio files, transcribes them using Groq's Whisper API via a local proxy, segments topics and summarizes content using an in-browser pure JavaScript NLP pipeline, and exports academic DOCX and PDF documents.

---

## Key Features

- **100% Client-Side NLP Pipeline (`src/nlp.js`)**: No external server or LLM API calls needed for note generation. Uses pure JavaScript:
  - Sentence tokenization with academic abbreviation handling (`Prof.`, `Dr.`, `e.g.`, `i.e.`)
  - Sublinear TF-IDF vectorization per sentence
  - Sliding-window cosine similarity topic segmentation with `SIMILARITY_THRESHOLD`
  - Unigram and bigram keyword extraction
  - Sentence graph centrality ranking for extractive summarization
  - Alphabetical keyword glossary generation
- **Rolling 30-Second Audio Chunking**: Records continuously via `MediaRecorder` without long-file upload delays, using Web Audio API `AnalyserNode` RMS silence detection (voice activity detection) to avoid transcribing empty pauses.
- **Secure Dev Proxy for Groq Whisper**: Requests to `/groq/*` are forwarded to `https://api.groq.com/` in `vite.config.ts`, automatically injecting `Authorization: Bearer ${GROQ_API_KEY}` from your local `.env`.
- **Publication-Ready Exports**:
  - **DOCX (`docx`)**: Times New Roman 12pt double-spaced body, 13pt bold topic headings, metadata header block, italic keywords line, and alphabetical glossary.
  - **PDF (`pdf-lib`)**: TimesRoman typography, double line-spacing, manual word wrapping, pagination, and page numbers.
- **Fail-Safe Demo Mode**: Built-in toggle and sample lecture data (`src/demo/sample.json`) for CSC 411 Neural Networks, guaranteeing a reliable defense presentation even without an internet connection or microphone.
- **Local Persistence**: Sessions automatically save to `localStorage` for instant review, reopening, and re-exporting.

---

## Quick Start & Setup

### 1. Installation
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your free Groq API key:
```env
# Groq API Key for Whisper Speech-to-Text (proxied server-side)
GROQ_API_KEY="gsk_your_groq_api_key_here"

# Set to "true" for offline demo mode or "false" for live microphone by default
VITE_DEMO_MODE="true"
```
*(Get a free Groq API key in 30 seconds at [console.groq.com](https://console.groq.com/keys)).*

### 3. Launch Development Server
```bash
npm run dev
```
Open your browser to `http://localhost:3000`.

---

## 5-Minute Defense Presentation Script

| Time | Phase | Script & Actions |
| :--- | :--- | :--- |
| **0:00 – 1:00** | **Problem & Overview** | *"Good day, committee members. During university lectures, students suffer cognitive overload attempting to manually transcribe complex concepts. LectureNote AI automates this process entirely in the browser, transcribing lecture speech, mathematically isolating topic boundaries, and creating standardized study documents."* <br>👉 **Action:** Point to the New Session screen, showing the 5 metadata fields (Course Title, Code, Lecturer, Date, Topic) and live VU level meter. |
| **1:00 – 2:00** | **Live Speech & 30s Chunks** | *"To avoid catastrophic network failures when uploading massive audio files, our system implements 30-second rolling MediaRecorder chunks on a continuous audio stream. Each chunk is checked via Web Audio API RMS silence detection to discard pauses before routing to Whisper-large-v3."* <br>👉 **Action:** Click **Start Recording** for live speech, or demonstrate the live chunk accumulator. |
| **2:00 – 3:30** | **Pure JavaScript NLP Pipeline** | *"Rather than relying on black-box LLMs, our summarization engine is implemented in `src/nlp.js` without any external ML downloads. It builds sentence TF-IDF vectors, runs sliding-window cosine similarity to identify topic transitions, ranks sentences by centrality, and extracts key domain bigrams."* <br>👉 **Action:** Click **Load Sample Lecture** (CSC 411) to trigger the pipeline and view the generated topic cards. |
| **3:30 – 4:15** | **Interactive Notes & DOCX/PDF Export** | *"The note preview formats topics into numbered sections with 5 keyword chips and 3–5 bullet summaries. Notice that clicking any keyword chip immediately highlights matching sentences across the lecture."* <br>👉 **Action:** Click a keyword chip (e.g., `activation functions` or `deep architectures`) to show sentence highlighting. Then click **Download DOCX** and **Download PDF** to show the browser downloads. |
| **4:15 – 5:00** | **Session History & Wrap-Up** | *"Finally, all sessions persist locally in the student's browser via localStorage, allowing them to archive entire semester courses, search past lectures, and re-export notes at any time. Thank you, I am ready for questions."* <br>👉 **Action:** Switch to **Session History** to show the saved CSC 411 lecture and re-open it. |

---

## Project Structure

```
├── .env.example              # Environment variables template (GROQ_API_KEY, VITE_DEMO_MODE)
├── index.html                # HTML entry point with Inter font & metadata
├── vite.config.ts            # Vite config with /groq/* dev proxy and key injection
├── src/
│   ├── App.tsx               # Main container & state management
│   ├── types.ts              # TypeScript data models (LectureSession, TopicSection)
│   ├── nlp.js                # Pure JS sentence splitting, TF-IDF, segmentation, centrality
│   ├── demo/
│   │   └── sample.json       # CSC 411 Neural Networks lecture transcript & chunks
│   ├── services/
│   │   ├── audioRecorder.ts  # MediaRecorder 30s rolling chunking & RMS VU meter
│   │   ├── groqTranscription.ts # Client proxy caller for whisper-large-v3
│   │   └── storage.ts        # localStorage session management
│   ├── export/
│   │   ├── docxExport.ts     # DOCX generation (Times New Roman 12pt, double spaced, glossary)
│   │   └── pdfExport.ts      # PDF generation (pdf-lib, pagination, word wrapping)
│   └── components/
│       ├── Sidebar.tsx       # Dark teal (#113C3C) sidebar navigation & mode toggle
│       ├── TopBar.tsx        # Top status bar
│       ├── NewSessionView.tsx # Form, Record/Stop button, timer, VU meter, live transcript
│       ├── UploadView.tsx    # Drag-and-drop audio upload with 5-step progress stepper
│       ├── NotePreviewView.tsx # Topic cards, interactive chips, bullets, DOCX/PDF download
│       ├── HistoryView.tsx   # Saved session archives & management
│       └── DefenseGuideModal.tsx # 5-minute defense presentation walkthrough
```
"# LecturenotesVOT" 
