import { useRef, useCallback } from 'react';
import { useToast } from "@/shared/hooks/use-toast";

interface AudioProcessingHandlers {
  onAudioChunk: (chunk: Blob) => void;
  onRecordingStop: (audioBlob: Blob) => void;
  onError: (error: string) => void;
}

export const useAudioProcessing = (handlers: AudioProcessingHandlers) => {
  const { toast } = useToast();
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Convert Float32Array to Int16Array for PCM16
  const convertFloat32ToPCM16 = useCallback((float32Array: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  }, []);

  const setupAudioProcessing = useCallback(async (
    stream: MediaStream,
    onAudioData: (data: ArrayBuffer) => void,
    isPaused: boolean
  ) => {
    try {
      // Setup audio processing
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      let audioBuffer = new Float32Array(0);
      const bufferSize = 16000;

      processor.onaudioprocess = (e) => {
        if (!isPaused) {
          const inputData = e.inputBuffer.getChannelData(0);

          // Downsample from 44100Hz to 16000Hz
          const downsampleRatio = 44100 / 16000;
          const downsampledLength = Math.floor(inputData.length / downsampleRatio);
          const downsampled = new Float32Array(downsampledLength);

          for (let i = 0; i < downsampledLength; i++) {
            const offset = Math.floor(i * downsampleRatio);
            downsampled[i] = inputData[offset];
          }

          // Accumulate audio data
          const newBuffer = new Float32Array(audioBuffer.length + downsampled.length);
          newBuffer.set(audioBuffer);
          newBuffer.set(downsampled, audioBuffer.length);
          audioBuffer = newBuffer;

          // Send chunks when we have enough data
          while (audioBuffer.length >= bufferSize) {
            const chunk = audioBuffer.slice(0, bufferSize);
            const pcm16 = convertFloat32ToPCM16(chunk);
            onAudioData(pcm16);
            audioBuffer = audioBuffer.slice(bufferSize);
          }
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      return { audioContext, processor };
    } catch (error) {
      console.error('Error setting up audio processing:', error);
      handlers.onError('Failed to setup audio processing');
      throw error;
    }
  }, [convertFloat32ToPCM16, handlers]);

  const setupMediaRecorder = useCallback((stream: MediaStream) => {
    try {
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          handlers.onAudioChunk(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // This will be handled by the parent component
        // The audio chunks are collected via onAudioChunk
      };

      return mediaRecorder;
    } catch (error) {
      console.error('Error setting up media recorder:', error);
      handlers.onError('Failed to setup media recorder');
      throw error;
    }
  }, [handlers]);

  const cleanupAudioProcessing = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const requestMicrophoneAccess = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });

      return stream;
    } catch (error) {
      console.error('Error requesting microphone access:', error);
      if (error instanceof Error && error.message.includes('microphone')) {
        handlers.onError('Unable to access the microphone. Please check your permissions.');
      } else {
        handlers.onError('Failed to access microphone');
      }
      throw error;
    }
  }, [handlers]);

  return {
    setupAudioProcessing,
    setupMediaRecorder,
    cleanupAudioProcessing,
    requestMicrophoneAccess,
    convertFloat32ToPCM16,
  };
};

