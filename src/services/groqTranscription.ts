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
 * Infers valid file extension and MIME type for Groq Whisper
 */
export function resolveAudioFormat(
  audioBlob: Blob | File,
  proposedFilename?: string
): { filename: string; mimeType: string } {
  const blobMime = (audioBlob.type || '').toLowerCase();
  let ext = 'mp4';
  let mimeType = 'audio/mp4';

  if (blobMime.includes('webm')) {
    ext = 'webm';
    mimeType = 'audio/webm';
  } else if (blobMime.includes('mp4')) {
    ext = 'mp4';
    mimeType = 'audio/mp4';
  } else if (blobMime.includes('m4a') || blobMime.includes('aac')) {
    ext = 'm4a';
    mimeType = 'audio/m4a';
  } else if (blobMime.includes('ogg') || blobMime.includes('opus')) {
    ext = 'ogg';
    mimeType = 'audio/ogg';
  } else if (blobMime.includes('wav')) {
    ext = 'wav';
    mimeType = 'audio/wav';
  } else if (blobMime.includes('mpeg') || blobMime.includes('mp3')) {
    ext = 'mp3';
    mimeType = 'audio/mpeg';
  } else if (proposedFilename && proposedFilename.includes('.')) {
    const rawExt = proposedFilename.split('.').pop()?.toLowerCase();
    if (rawExt && ['webm', 'mp4', 'm4a', 'mp3', 'wav', 'ogg'].includes(rawExt)) {
      ext = rawExt;
      mimeType = ext === 'webm' ? 'audio/webm' : ext === 'mp4' ? 'audio/mp4' : `audio/${ext}`;
    }
  }

  const base = (proposedFilename || 'recording').replace(/\.[^/.]+$/, '');
  return {
    filename: `${base}.${ext}`,
    mimeType,
  };
}

/**
 * Transcribes an audio Blob or File using Groq whisper-large-v3 model.
 * @param audioBlob Audio file or recording chunk
 * @param proposedFilename Filename (extension will be adjusted to match audioBlob MIME if needed)
 * @returns Transcribed text string
 */
export async function transcribeAudio(
  audioBlob: Blob | File,
  proposedFilename?: string
): Promise<string> {
  if (!audioBlob || audioBlob.size < 500) {
    throw new Error('Recorded audio is empty or too short. Please speak for at least 2-3 seconds.');
  }

  const { filename, mimeType } = resolveAudioFormat(audioBlob, proposedFilename);

  // Package into a valid File instance so multipart boundary contains proper content-type
  const fileToUpload =
    audioBlob instanceof File
      ? audioBlob
      : new File([audioBlob], filename, { type: audioBlob.type || mimeType });

  const formData = new FormData();
  formData.append('file', fileToUpload, filename);
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
