/**
 * Service to transcribe audio using Groq Whisper API through the Vite dev-server proxy.
 * Proxy route in vite.config.ts forwards `/groq/*` to `https://api.groq.com/` and injects
 * the `Authorization: Bearer ${GROQ_API_KEY}` header securely.
 */

export interface TranscriptionOptions {
  language?: string;
}

/**
 * Transcribes an audio Blob or File using Groq whisper-large-v3 model.
 * @param audioBlob Audio file or recording chunk
 * @param filename Filename with extension (e.g., chunk.webm, recording.mp3)
 * @returns Transcribed text string
 */
export async function transcribeAudio(
  audioBlob: Blob | File,
  filename: string = 'recording.webm'
): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, filename);
  formData.append('model', 'whisper-large-v3');
  formData.append('language', 'en');
  formData.append('response_format', 'text');

  let response: Response;
  try {
    response = await fetch('/groq/openai/v1/audio/transcriptions', {
      method: 'POST',
      body: formData,
    });
  } catch (netErr: any) {
    throw new Error(
      `Network connection failed to /groq proxy: ${netErr.message || 'Check Vite dev server.'}`
    );
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      errorDetail = await response.text();
    } catch {
      // ignore
    }

    if (response.status === 401) {
      throw new Error(
        'Groq API Authentication Error (401): Please verify GROQ_API_KEY is configured in your .env file, or switch to Demo Mode for instant presentation.'
      );
    }

    if (response.status === 429) {
      throw new Error(
        'Groq API Rate Limit Reached (429): You have exceeded your current rate limits. Switch to Demo Mode for your presentation.'
      );
    }

    if (response.status === 413) {
      throw new Error(
        'Audio File Too Large (413): Groq free-tier Whisper enforces a 25 MB limit per file.'
      );
    }

    throw new Error(
      `Groq Whisper transcription failed (HTTP ${response.status}): ${
        errorDetail || response.statusText
      }`
    );
  }

  const transcribedText = await response.text();
  return transcribedText.trim();
}
