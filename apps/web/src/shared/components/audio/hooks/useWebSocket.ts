import { useRef, useCallback } from 'react';
import { useToast } from "@/shared/hooks/use-toast";
import { getAuthToken } from "@/services/authApis";

// WebSocket configuration
const WS_URL = String(process.env.NEXT_PUBLIC_WS_URL);

interface WebSocketHandlers {
  onTranscriptUpdate: (text: string, isFinal: boolean) => void;
  onProcessingComplete: () => void;
  onTranscriptionJobCreated: () => void;
  onError: (message: string) => void;
  onConnectionChange: (connected: boolean) => void;
  onAuthenticatingChange: (authenticating: boolean) => void;
  onPatientDetailsLoadingChange: (loading: boolean) => void;
  onPatientDetailsAckReceived: (ack: boolean) => void;
  onUserCancelledChange: (cancelled: boolean) => void;
}

export const useWebSocket = (handlers: WebSocketHandlers) => {
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);

  const connectWebSocket = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }

        // Get authentication token
        const token = getAuthToken();
        if (!token) {
          toast({
            title: "Authentication Required",
            description: "Please log in to use the recording feature",
            variant: "destructive",
          });
          reject(new Error("No authentication token found"));
          return;
        }

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        // Track if we've received auth response
        let authCompleted = false;

        ws.onopen = () => {
          handlers.onAuthenticatingChange(true);

          // Send authentication message as first message
          ws.send(JSON.stringify({
            type: 'auth',
            token: token
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Handle authentication response
            if (data.type === 'auth_success') {
              authCompleted = true;
              handlers.onAuthenticatingChange(false);
              handlers.onConnectionChange(true);

              // Send configuration after successful authentication
              ws.send(JSON.stringify({
                type: 'config',
                config: {
                  sampleRate: 16000,
                  language: 'en-US',
                  encoding: 'linear16',
                }
              }));

              resolve();

            } else if (data.type === 'auth_failed') {
              console.error('Authentication failed:', data.message);
              authCompleted = true;
              handlers.onAuthenticatingChange(false);
              handlers.onConnectionChange(false);

              toast({
                title: "Authentication Failed",
                description: data.message || "Invalid authentication token",
                variant: "destructive",
              });

              ws.close();
              reject(new Error('Authentication failed'));

            } else if (data.type === 'transcript') {
              handlers.onTranscriptUpdate(data.text, data.isFinal);

            } else if (data.type === 'patient_details_ack') {
              handlers.onPatientDetailsAckReceived(true);
              handlers.onPatientDetailsLoadingChange(false);

              // Send audio_start message after patient details acknowledgment
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'audio_start' }));
              }

              toast({
                description: "Connected to server successfully",
                duration: 2000,
              });

            } else if (data.type === 'error') {
              console.error('WebSocket error:', data.message);
              handlers.onPatientDetailsLoadingChange(false);
              handlers.onError(data.message);

            } else if (data.type === 'keepalive') {
              // Respond to keepalive to maintain connection
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
              }
            } else if (data.type === 'transcription_job_created') {
              // Handle successful transcription job creation
              handlers.onTranscriptionJobCreated();

            } else if (data.type === 'processing_complete') {
              // Handle processing complete message
              handlers.onProcessingComplete();
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          handlers.onConnectionChange(false);
          handlers.onAuthenticatingChange(false);
          reject(error);
        };

        ws.onclose = (event) => {
          handlers.onConnectionChange(false);
          handlers.onAuthenticatingChange(false);
          wsRef.current = null;

          // Handle different close codes
          if (event.code === 1008) { // Policy violation (auth failure)
            toast({
              title: "Authentication Error",
              description: "Authentication failed. Please log in again.",
              variant: "destructive",
            });
          } else if (event.code === 1001) { // Going away
          } else if (event.code === 1000 && event.reason === 'Recording cancelled by user') {
            // User-initiated cancellation - don't show error toast
          } else if (event.code !== 1000) { // Abnormal closure
            toast({
              title: "Connection Lost",
              description: "Connection to transcription service was lost",
              variant: "destructive",
            });
          }
        };

      } catch (error) {
        reject(error);
      }
    });
  }, [handlers, toast]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendAudioData = useCallback((data: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const pauseTranscription = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'transcription_pause' }));
    }
  }, []);

  const resumeTranscription = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'transcription_resume' }));
    }
  }, []);

  const closeWebSocket = useCallback((code?: number, reason?: string) => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(code || 1000, reason);
      }
      wsRef.current = null;
    }
  }, []);

  const isConnected = useCallback(() => {
    return wsRef.current?.readyState === WebSocket.OPEN;
  }, []);

  return {
    connectWebSocket,
    sendMessage,
    sendAudioData,
    pauseTranscription,
    resumeTranscription,
    closeWebSocket,
    isConnected,
    wsRef,
  };
};

