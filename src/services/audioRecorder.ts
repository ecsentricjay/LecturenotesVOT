/**
 * Audio Recording Service using MediaRecorder and Web Audio API AnalyserNode.
 * - Prioritizes audio/webm;codecs=opus, with fallbacks to audio/webm and audio/mp4.
 * - Implements 30-second rolling chunk restarts on the persistent MediaStream.
 * - Computes real-time RMS audio levels for the VU meter and voice activity detection (VAD).
 */

export interface RecorderCallbacks {
  onChunkReady: (blob: Blob, averageRms: number, isSilent: boolean) => void;
  onLevelUpdate: (normalizedLevel: number) => void;
  onError: (error: Error) => void;
}

export class AudioRecorderManager {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private currentRecorder: MediaRecorder | null = null;
  private chunkIntervalId: number | null = null;
  private animFrameId: number | null = null;

  private mimeType: string = '';
  private currentChunkBlobs: Blob[] = [];
  private currentChunkRmsSamples: number[] = [];
  private isRecording: boolean = false;
  private callbacks: RecorderCallbacks | null = null;

  // Silence threshold for simple Voice Activity Detection (VAD)
  private readonly SILENCE_RMS_THRESHOLD = 0.008;

  constructor() {
    this.detectSupportedMimeType();
  }

  private detectSupportedMimeType(): void {
    if (typeof MediaRecorder === 'undefined') return;

    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg',
      '',
    ];

    for (const type of candidates) {
      if (!type || MediaRecorder.isTypeSupported(type)) {
        this.mimeType = type;
        break;
      }
    }
  }

  public getMimeType(): string {
    return this.mimeType;
  }

  /**
   * Starts recording from microphone.
   */
  public async start(callbacks: RecorderCallbacks): Promise<void> {
    this.callbacks = callbacks;

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
          'Microphone permission denied. Please allow microphone access in your browser address bar to record live lectures.'
        );
      }
      throw new Error(`Microphone initialization failed: ${err.message || 'Unknown error'}`);
    }

    // Set up Web Audio API AnalyserNode for live level meter & RMS
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioCtx();
    const sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.3;
    sourceNode.connect(this.analyser);

    this.isRecording = true;
    this.startLevelMeter();

    // Start first 30-second chunk
    this.startNewRecorderChunk();

    // Schedule 30-second rollover
    this.chunkIntervalId = window.setInterval(() => {
      if (this.isRecording && this.currentRecorder && this.currentRecorder.state === 'recording') {
        // Stopping the recorder finalizes the current chunk and triggers onstop
        this.currentRecorder.stop();
        // Immediately start next recorder on same stream
        this.startNewRecorderChunk();
      }
    }, 30000);
  }

  private startNewRecorderChunk(): void {
    if (!this.mediaStream || !this.isRecording) return;

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
        }
      };

      recorder.onstop = () => {
        if (this.currentChunkBlobs.length > 0) {
          const chunkBlob = new Blob(this.currentChunkBlobs, {
            type: this.mimeType || 'audio/webm',
          });

          // Compute average RMS for this chunk
          const totalSamples = this.currentChunkRmsSamples.length;
          const avgRms =
            totalSamples > 0
              ? this.currentChunkRmsSamples.reduce((sum, v) => sum + v, 0) / totalSamples
              : 0;

          const isSilent = avgRms < this.SILENCE_RMS_THRESHOLD;
          if (this.callbacks) {
            this.callbacks.onChunkReady(chunkBlob, avgRms, isSilent);
          }
        }
      };

      this.currentRecorder = recorder;
      recorder.start();
    } catch (err: any) {
      if (this.callbacks) {
        this.callbacks.onError(new Error(`Failed to start MediaRecorder: ${err.message}`));
      }
    }
  }

  private startLevelMeter(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const updateLoop = () => {
      if (!this.isRecording || !this.analyser) return;

      this.analyser.getByteTimeDomainData(dataArray);

      // Calculate Root Mean Square (RMS)
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        // Normalize 0-255 to -1.0 to 1.0
        const normalized = (dataArray[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);

      // Track RMS for current 30s chunk
      this.currentChunkRmsSamples.push(rms);

      // Normalized value between 0.0 and 1.0 with soft exponential curve for UI
      const visualLevel = Math.min(1.0, Math.max(0.0, rms * 4.5));
      if (this.callbacks) {
        this.callbacks.onLevelUpdate(visualLevel);
      }

      this.animFrameId = requestAnimationFrame(updateLoop);
    };

    this.animFrameId = requestAnimationFrame(updateLoop);
  }

  /**
   * Stops recording, flushes final chunk, and tears down streams.
   */
  public async stop(): Promise<void> {
    this.isRecording = false;

    if (this.chunkIntervalId) {
      clearInterval(this.chunkIntervalId);
      this.chunkIntervalId = null;
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.currentRecorder && this.currentRecorder.state === 'recording') {
      // Final chunk stop
      await new Promise<void>((resolve) => {
        if (!this.currentRecorder) return resolve();
        this.currentRecorder.addEventListener('stop', () => resolve(), { once: true });
        this.currentRecorder.stop();
      });
    }

    // Stop all audio tracks
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

    this.analyser = null;
    this.currentRecorder = null;
    if (this.callbacks) {
      this.callbacks.onLevelUpdate(0);
    }
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }
}
