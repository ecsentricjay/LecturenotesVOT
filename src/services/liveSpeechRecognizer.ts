/**
 * Live Speech Recognition Service
 * Combines browser-native SpeechRecognition (for instant, 0-latency live streaming words)
 * with MediaRecorder audio capture (for Groq Whisper API verification and export).
 */

export interface LiveRecognitionCallbacks {
  onInterimText: (text: string) => void;
  onFinalText: (text: string) => void;
  onLevelUpdate: (level: number) => void;
  onError: (error: string) => void;
  onAudioBlobReady?: (blob: Blob) => void;
}

export class LiveSpeechRecognizer {
  private recognition: any = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private isListening: boolean = false;
  private callbacks: LiveRecognitionCallbacks | null = null;

  public static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    );
  }

  public async start(callbacks: LiveRecognitionCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.audioChunks = [];

    // 1. Initialize microphone stream for audio level VU meter & MediaRecorder
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
        throw new Error('Microphone permission denied. Please allow microphone access in your browser.');
      }
      throw new Error(`Microphone access failed: ${err.message || 'Unknown error'}`);
    }

    // Set up Web Audio Analyser for VU meter
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.3;
      source.connect(this.analyser);
      this.startLevelLoop();
    } catch (e) {
      console.warn('AudioContext level meter initialization failed:', e);
    }

    // Set up MediaRecorder to capture audio blob for Whisper
    try {
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };
      this.mediaRecorder.start(250); // collect in small 250ms slices
    } catch (e) {
      console.warn('MediaRecorder for test audio could not start:', e);
    }

    // 2. Set up SpeechRecognition if available
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
          console.warn('SpeechRecognition error:', event.error);
          if (event.error === 'not-allowed') {
            this.callbacks?.onError('Microphone permission blocked.');
          }
        };

        recognition.onend = () => {
          // Restart if still marked as listening
          if (this.isListening && this.recognition) {
            try {
              this.recognition.start();
            } catch {
              // ignore
            }
          }
        };

        this.recognition = recognition;
        recognition.start();
      } catch (err: any) {
        console.warn('Failed to start SpeechRecognition:', err);
      }
    }

    this.isListening = true;
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
      const level = Math.min(1.0, rms * 4.5);

      if (this.callbacks) {
        this.callbacks.onLevelUpdate(level);
      }
      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  public async stop(): Promise<Blob | null> {
    this.isListening = false;

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

    let finalBlob: Blob | null = null;
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      await new Promise<void>((resolve) => {
        if (!this.mediaRecorder) return resolve();
        this.mediaRecorder.addEventListener('stop', () => {
          if (this.audioChunks.length > 0) {
            finalBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          }
          resolve();
        }, { once: true });
        this.mediaRecorder.stop();
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
