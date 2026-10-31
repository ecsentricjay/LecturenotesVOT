/**
 * Service to transcribe audio using Groq Whisper API.
 * In local development, Vite dev-server proxy forwards `/groq/*` and `/api/groq/*` to `https://api.groq.com/`.
 * On Vercel, the Edge Function at `/api/groq/[...path].ts` handles the requests.
 */

export interface TranscriptionOptions {
  language?: string;
}

/**
 * Retrieves the custom Groq API key from localStorage if entered by the user
 */
export function getSavedGroqApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('groq_api_key_override') || '';
}

/**
 * Saves or clears the custom Groq API key in localStorage
 */
export function setSavedGroqApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const clean = key.trim();
  if (clean) {
    localStorage.setItem('groq_api_key_override', clean);
  } else {
    localStorage.removeItem('groq_api_key_override');
  }
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

  const headers: Record<string, string> = {};
  const customKey = getSavedGroqApiKey();
  if (customKey) {
    headers['x-groq-api-key'] = customKey;
  }

  // Attempt proxy endpoints: /api/groq is Vercel native function route; /groq is rewritten in vercel.json & Vite proxy
  const endpoints = [
    '/api/groq/openai/v1/audio/transcriptions',
    '/groq/openai/v1/audio/transcriptions',
  ];

  let response: Response | null = null;
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: formData,
      });

      // If we got a response (even non-200), break unless it was a 404 on the proxy route itself
      if (response.status !== 404) {
        break;
      }
    } catch (netErr: any) {
      lastError = netErr;
    }
  }

  if (!response) {
    throw new Error(
      `Network connection failed: ${lastError?.message || 'Could not reach Groq Whisper proxy endpoint.'}`
    );
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      errorDetail = await response.text();
    } catch {
      // ignore
    }

    if (errorDetail) {
      try {
        const parsed = JSON.parse(errorDetail);
        if (parsed.error?.message) {
          throw new Error(parsed.error.message);
        }
      } catch (e: any) {
        if (e.message && !e.message.includes('JSON')) {
          throw e;
        }
      }
    }

    if (response.status === 401) {
      throw new Error(
        'Groq API Key Required (401): Please enter your Groq API key (starts with gsk_) in the app settings, or configure GROQ_API_KEY in your Vercel project environment variables.'
      );
    }

    if (response.status === 429) {
      throw new Error(
        'Groq API Rate Limit Reached (429): You have exceeded the free tier rate limits. Please wait 10 seconds before trying again.'
      );
    }

    if (response.status === 413) {
      throw new Error(
        'Audio File Too Large (413): Groq Whisper enforces a 25 MB file limit. Please trim the audio.'
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
