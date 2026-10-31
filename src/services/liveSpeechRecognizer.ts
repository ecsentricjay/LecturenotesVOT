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
}

export class LiveSpeechRecognizer {
  private recognition: any = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private currentChunkBlobs: Blob[] = [];
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

  private readonly SILENCE_RMS_THRESHOLD = 0.008;

  constructor() {
    this.detectMimeType();
  }

  private detectMimeType(): void {
    if (typeof MediaRecorder === 'undefined') return;
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg',
      '',
    ];
    for (const t of candidates) {
      if (!t || MediaRecorder.isTypeSupported(t)) {
        this.mimeType = t || 'audio/webm';
        break;
      }
    }
  }

  public static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    );
  }

  public async start(callbacks: LiveRecognitionCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.currentChunkBlobs = [];
    this.allRecordedBlobs = [];
    this.currentChunkRmsSamples = [];
    this.chunkCounter = 1;

    // 1. Single getUserMedia call - requested once, shared across audio nodes & recorders
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error(
          'Microphone permission denied. Please allow microphone access in your browser.'
        );
      }
      throw new Error(`Microphone access failed: ${err.message || 'Unknown error'}`);
    }

    // 2. Set up Web Audio AnalyserNode on this stream for VU meter
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.3;
      source.connect(this.analyser);
      this.startLevelLoop();
    } catch (e) {
      console.warn('AudioContext level meter initialization failed:', e);
    }

    // 3. Start MediaRecorder for 30s chunking & final audio assembly
    this.startNewRecorderChunk();

    // 30-second rollover interval for standalone chunks
    this.chunkIntervalId = window.setInterval(() => {
      if (this.isListening && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
        this.startNewRecorderChunk();
      }
    }, 30000);

    // 4. Start browser SpeechRecognition if supported (Chrome/Edge/Safari)
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

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
          if (event.error === 'not-allowed') {
            this.callbacks?.onError('Microphone permission blocked for speech recognition.');
          } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
            console.warn('SpeechRecognition notice:', event.error);
          }
        };

        recognition.onend = () => {
          if (this.isListening && this.recognition) {
            setTimeout(() => {
              if (this.isListening && this.recognition) {
                try {
                  this.recognition.start();
                } catch {
                  // ignore restart errors
                }
              }
            }, 300);
          }
        };

        this.recognition = recognition;
        recognition.start();
      } catch (err: any) {
        console.warn('SpeechRecognition could not start:', err);
      }
    }

    this.isListening = true;
  }

  private startNewRecorderChunk(): void {
    if (!this.mediaStream || !this.mediaStream.active) return;

    this.currentChunkBlobs = [];
    this.currentChunkRmsSamples = [];

    const options: MediaRecorderOptions = {};
    if (this.mimeType) {
      options.mimeType = this.mimeType;
    }

    try {
      const recorder = new MediaRecorder(this.mediaStream, options);

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          this.currentChunkBlobs.push(e.data);
          this.allRecordedBlobs.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (this.currentChunkBlobs.length > 0 && this.callbacks?.onChunkReady) {
          const chunkBlob = new Blob(this.currentChunkBlobs, {
            type: this.mimeType || 'audio/webm',
          });

          const totalSamples = this.currentChunkRmsSamples.length;
          const avgRms =
            totalSamples > 0
              ? this.currentChunkRmsSamples.reduce((a, b) => a + b, 0) / totalSamples
              : 0;

          const isSilent = avgRms < this.SILENCE_RMS_THRESHOLD;
          this.callbacks.onChunkReady(chunkBlob, this.chunkCounter++, isSilent);
        }
      };

      this.mediaRecorder = recorder;
      recorder.start(500); // 500ms timeslices for smooth collection
    } catch (err: any) {
      console.warn('Failed to start MediaRecorder:', err);
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

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      await new Promise<void>((resolve) => {
        if (!this.mediaRecorder) return resolve();
        this.mediaRecorder.addEventListener('stop', () => resolve(), { once: true });
        this.mediaRecorder.stop();
      });
    }

    let finalBlob: Blob | null = null;
    if (this.allRecordedBlobs.length > 0) {
      finalBlob = new Blob(this.allRecordedBlobs, {
        type: this.mimeType || 'audio/webm',
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
