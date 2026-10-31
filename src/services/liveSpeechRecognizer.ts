/**
 * Live Speech Recognition & Audio Capture Service
 * Uses ONE single MediaStream to prevent device conflicts:
 * - Real-time SpeechRecognition for 0-latency live streaming text on screen
 * - Web Audio API AnalyserNode for live VU meter and voice activity detection
 * - MediaRecorder with 30-second rolling valid chunks + final audio blob for Groq Whisper
 */

export interface LiveRecognitionCallbacks {
  onInterimText: (text: string) => void;
  onFinalText: (text: string) => void;
  onLevelUpdate: (level: number) => void;
  onError: (error: string) => void;
  onChunkReady?: (blob: Blob, chunkIndex: number, isSilent: boolean) => void;
  onAudioBlobReady?: (blob: Blob) => void;
  onSpeechRecognitionActive?: (isActive: boolean) => void;
}

/**
 * Returns appropriate file extension for audio MIME type
 */
export function getExtensionForMimeType(mimeType: string): string {
  const lower = (mimeType || '').toLowerCase();
  if (lower.includes('mp4') || lower.includes('m4a') || lower.includes('aac')) return 'mp4';
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('ogg') || lower.includes('opus')) return 'ogg';
  if (lower.includes('wav')) return 'wav';
  if (lower.includes('mp3') || lower.includes('mpeg')) return 'mp3';
  return 'mp4'; // safe default on mobile (iOS WebKit standard)
}

export class LiveSpeechRecognizer {
  private recognition: any = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private allRecordedBlobs: Blob[] = [];
  private currentChunkRmsSamples: number[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private chunkIntervalId: number | null = null;
  private chunkCounter: number = 1;
  private isListening: boolean = false;
  private mimeType: string = 'audio/webm';
  private callbacks: LiveRecognitionCallbacks | null = null;
  private isSpeechRecognitionRunning: boolean = false;

  private readonly SILENCE_RMS_THRESHOLD = 0.008;

  constructor() {
    this.mimeType = this.detectMimeType();
  }

  private detectMimeType(): string {
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
      return 'audio/mp4';
    }
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4;codecs=mp4a.40.2',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav',
    ];
    for (const t of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(t)) {
          return t;
        }
      } catch {
        // ignore check errors on older browsers
      }
    }
    return '';
  }

  public getMimeType(): string {
    return this.mimeType || 'audio/mp4';
  }

  public getAudioExtension(): string {
    return getExtensionForMimeType(this.mimeType);
  }

  public static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    );
  }

  public isSpeechApiActive(): boolean {
    return this.isSpeechRecognitionRunning;
  }

  public async start(callbacks: LiveRecognitionCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.allRecordedBlobs = [];
    this.currentChunkRmsSamples = [];
    this.chunkCounter = 1;
    this.isSpeechRecognitionRunning = false;

    // 1. Single getUserMedia call with mobile fallback
    try {
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (constraintErr: any) {
        // Fallback for mobile devices / external headsets that reject advanced constraints
        console.warn('Advanced audio constraints not supported, falling back to basic audio:', constraintErr);
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error(
          'Microphone permission denied. Please allow microphone access in your mobile/browser settings.'
        );
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error('No microphone device found on this system.');
      }
      throw new Error(`Microphone access failed: ${err.message || 'Unknown error'}`);
    }

    if (!this.mediaStream) {
      throw new Error('Failed to acquire audio stream.');
    }

    // 2. Set up Web Audio AnalyserNode without blocking on iOS AudioContext restrictions
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        // Do not await resume() synchronously because on iOS Safari it can stall execution
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch((e) => {
            console.warn('AudioContext resume deferred on mobile:', e);
          });
        }
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.3;
        source.connect(this.analyser);
        this.startLevelLoop();
      }
    } catch (e) {
      console.warn('AudioContext level meter initialization failed (non-fatal):', e);
    }

    // 3. Start ONE continuous MediaRecorder for the entire session
    // This guarantees a single, non-corrupted container (especially for iOS Safari MP4)
    this.startContinuousRecorder();

    // 4. Set up 30-second interval: requestData from the running recorder without stopping it
    this.chunkIntervalId = window.setInterval(() => {
      if (this.isListening && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        try {
          this.mediaRecorder.requestData();
        } catch (e) {
          console.warn('requestData error on interval:', e);
        }
      }
    }, 30000);

    // 5. Start browser SpeechRecognition if available (Chrome/Safari desktop/mobile)
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          this.isSpeechRecognitionRunning = true;
          this.callbacks?.onSpeechRecognitionActive?.(true);
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          if (finalTranscript && this.callbacks) {
            this.callbacks.onFinalText(finalTranscript.trim());
          } else if (interimTranscript && this.callbacks) {
            this.callbacks.onInterimText(interimTranscript.trim());
          }
        };

        recognition.onerror = (event: any) => {
          this.isSpeechRecognitionRunning = false;
          this.callbacks?.onSpeechRecognitionActive?.(false);
          if (event.error === 'not-allowed') {
            console.warn('Web Speech API permission blocked. Audio capture via MediaRecorder continues.');
          } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
            console.warn('Web Speech API event notice:', event.error);
          }
        };

        recognition.onend = () => {
          this.isSpeechRecognitionRunning = false;
          this.callbacks?.onSpeechRecognitionActive?.(false);
          if (this.isListening && this.recognition) {
            setTimeout(() => {
              if (this.isListening && this.recognition) {
                try {
                  this.recognition.start();
                } catch {
                  // ignore restart collisions
                }
              }
            }, 300);
          }
        };

        this.recognition = recognition;
        recognition.start();
      } catch (err: any) {
        console.warn('SpeechRecognition could not start on this browser. MediaRecorder will capture audio for Whisper.', err);
      }
    }

    this.isListening = true;
  }

  private startContinuousRecorder(): void {
    if (!this.mediaStream || !this.mediaStream.active) return;

    const options: MediaRecorderOptions = {};
    if (this.mimeType) {
      options.mimeType = this.mimeType;
    }

    try {
      const recorder = new MediaRecorder(this.mediaStream, options);

      let chunkBlobAccumulator: Blob[] = [];

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          this.allRecordedBlobs.push(e.data);
          chunkBlobAccumulator.push(e.data);

          // If we accumulated roughly 30 seconds of slices or on explicit interval
          if (chunkBlobAccumulator.length >= 30 && this.callbacks?.onChunkReady) {
            const chunkBlob = new Blob(chunkBlobAccumulator, {
              type: this.mimeType || 'audio/mp4',
            });
            chunkBlobAccumulator = [];

            const totalSamples = this.currentChunkRmsSamples.length;
            const avgRms =
              totalSamples > 0
                ? this.currentChunkRmsSamples.reduce((a, b) => a + b, 0) / totalSamples
                : 0;
            this.currentChunkRmsSamples = [];

            const isSilent = avgRms < this.SILENCE_RMS_THRESHOLD;
            this.callbacks.onChunkReady(chunkBlob, this.chunkCounter++, isSilent);
          }
        }
      };

      recorder.onerror = (event: any) => {
        console.warn('MediaRecorder runtime error:', event);
      };

      this.mediaRecorder = recorder;
      // 1000ms timeslices for smooth collection and mobile battery friendliness
      recorder.start(1000);
    } catch (err: any) {
      console.warn('Failed to start MediaRecorder with options:', options, err);
      // Fallback without explicit mimeType
      try {
        const recorder = new MediaRecorder(this.mediaStream);
        recorder.ondataavailable = (e: BlobEvent) => {
          if (e.data && e.data.size > 0) {
            this.allRecordedBlobs.push(e.data);
          }
        };
        this.mediaRecorder = recorder;
        recorder.start(1000);
      } catch (fallbackErr: any) {
        throw new Error(`MediaRecorder not supported on this device: ${fallbackErr.message}`);
      }
    }
  }

  private startLevelLoop(): void {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const tick = () => {
      if (!this.isListening || !this.analyser) return;
      this.analyser.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const norm = (dataArray[i] - 128) / 128;
        sum += norm * norm;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      this.currentChunkRmsSamples.push(rms);

      const level = Math.min(1.0, Math.max(0, rms * 4.5));

      if (this.callbacks) {
        this.callbacks.onLevelUpdate(level);
      }
      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  public async stop(): Promise<Blob | null> {
    this.isListening = false;

    if (this.chunkIntervalId) {
      clearInterval(this.chunkIntervalId);
      this.chunkIntervalId = null;
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        if (!this.mediaRecorder) return resolve();
        const timeout = setTimeout(() => resolve(), 2500);
        this.mediaRecorder.addEventListener(
          'stop',
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true }
        );
        try {
          this.mediaRecorder.stop();
        } catch {
          clearTimeout(timeout);
          resolve();
        }
      });
    }

    let finalBlob: Blob | null = null;
    if (this.allRecordedBlobs.length > 0) {
      const finalMime = this.mediaRecorder?.mimeType || this.mimeType || 'audio/mp4';
      finalBlob = new Blob(this.allRecordedBlobs, {
        type: finalMime,
      });
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
    }

    if (this.callbacks) {
      this.callbacks.onLevelUpdate(0);
      if (finalBlob && this.callbacks.onAudioBlobReady) {
        this.callbacks.onAudioBlobReady(finalBlob);
      }
    }

    return finalBlob;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

