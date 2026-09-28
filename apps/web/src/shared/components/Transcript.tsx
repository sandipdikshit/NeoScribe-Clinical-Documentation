'use client';

import { useEffect, useState, useRef } from 'react';

// Define types
type TranscriptionState = {
  status: 'idle' | 'connecting' | 'recording' | 'processing' | 'completed' | 'error';
  sessionId: string | null;
  interimText: string;
  finalTexts: string[];
  combinedText: string;
  error: string | null;
  debugInfo: string[];
};

const AudioProcessor = `
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = true;
    this.sampleCounter = 0;
    
    // Setup message handling
    this.port.onmessage = (event) => {
      if (event.data.command === 'stop') {
        this.isRecording = false;
      }
    };
    
    // Send initialization confirmation
    this.port.postMessage({ status: 'initialized' });
  }
  
  process(inputs, outputs, parameters) {
    if (!this.isRecording) return false;
    
    // Check if we have input data
    const input = inputs[0];
    if (input && input.length > 0) {
      const samples = input[0];
      
      // Only process if we have samples and increment counter for debugging
      if (samples && samples.length > 0) {
        this.sampleCounter += samples.length;
        
        // Send status update every ~5 seconds (assuming 48kHz)
        if (this.sampleCounter > 240000) {
          this.port.postMessage({ status: 'processing', count: this.sampleCounter });
          this.sampleCounter = 0;
        }
        
        // Convert to 16-bit PCM
        const pcmData = new Int16Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
          const s = Math.max(-1, Math.min(1, samples[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Send the audio data
        this.port.postMessage({
          audioData: pcmData.buffer
        }, [pcmData.buffer]);
      }
    }
    
    return this.isRecording;
  }
}

registerProcessor('audio-processor', AudioProcessor);
`;

const TranscriptionComponent = () => {
  // State for transcription
  const [state, setState] = useState<TranscriptionState>({
    status: 'idle',
    sessionId: null,
    interimText: '',
    finalTexts: [],
    combinedText: '',
    error: null,
    debugInfo: []
  });

  // Refs for maintaining WebSocket and audio resources
  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorUrlRef = useRef<string | null>(null);
  // Add a ref for session ID to avoid closure issues
  const sessionIdRef = useRef<string | null>(null);

  // Add debug info to state
  const addDebugInfo = (message: string) => {
    setState(prev => ({
      ...prev,
      debugInfo: [...prev.debugInfo, `${new Date().toISOString().slice(11, 19)} - ${message}`]
    }));
  };

  // Initialize audio worklet
  const initializeAudioWorklet = async () => {
    try {
      addDebugInfo('Initializing audio worklet...');
      
      // Create AudioContext with appropriate settings for speech recognition
      const audioContext = new AudioContext({
        sampleRate: 16000, // 16kHz is good for speech recognition
        latencyHint: 'interactive'
      });
      audioContextRef.current = audioContext;

      // Create blob URL for the processor if not already created
      if (!processorUrlRef.current) {
        const blob = new Blob([AudioProcessor], { type: 'application/javascript' });
        processorUrlRef.current = URL.createObjectURL(blob);
        addDebugInfo('Created audio processor blob URL');
      }

      // Add the module to the audio worklet
      await audioContext.audioWorklet.addModule(processorUrlRef.current);
      addDebugInfo('Audio worklet module loaded successfully');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize audio worklet:', error);
      addDebugInfo(`Audio worklet init failed: ${error instanceof Error ? error.message : String(error)}`);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: `Failed to initialize audio system: ${error instanceof Error ? error.message : String(error)}`
      }));
      return false;
    }
  };

  // Submit transcription to another API
  const submitTranscription = async (text: string) => {
    // Use the sessionIdRef.current instead of state.sessionId
    const currentSessionId = sessionIdRef.current;
    
    if (!text || !currentSessionId) {
      addDebugInfo(`No text or session ID available for submission. Text length: ${text?.length || 0}, SessionID: ${currentSessionId}`);
      return;
    }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_TRANSCRIPTION_API_URL || 'http://localhost:5000/api/v2/transcription/submit';
      addDebugInfo(`Submitting transcription to ${apiUrl} with session ID: ${currentSessionId}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: currentSessionId,
          text: text
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.json();
      addDebugInfo(`Transcription submitted successfully: ${JSON.stringify(result)}`);
    } catch (error) {
      addDebugInfo(`Submission failed: ${error instanceof Error ? error.message : String(error)}`);
      setState(prev => ({ 
        ...prev, 
        error: `Failed to submit transcription: ${error instanceof Error ? error.message : String(error)}`
      }));
    }
  };

  // Start WebSocket connection and transcription
  const startTranscription = async () => {
    try {
      setState(prev => ({ ...prev, status: 'connecting', error: null, debugInfo: [] }));
      addDebugInfo('Starting transcription process...');

      // Initialize audio worklet
      const initialized = await initializeAudioWorklet();
      if (!initialized) {
        throw new Error('Failed to initialize audio system');
      }

      // Connect to WebSocket
      const wsUrl = process.env.NEXT_PUBLIC_TRANSCRIPTION_WS_URL || 'ws://localhost:5000/api/v2/transcription/ws';
      addDebugInfo(`Connecting to WebSocket at ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl);
      websocketRef.current = ws;

      // Add event listeners
      ws.onopen = () => {
        addDebugInfo('WebSocket connection established');
        // Some servers expect an initial message to complete the handshake
        ws.send(JSON.stringify({ type: 'connect', timestamp: Date.now() }));
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          addDebugInfo(`Received message: ${JSON.stringify(data).substring(0, 100)}`);
          
          // Handle session initialization
          if (data.session_id) {
            addDebugInfo(`Session established: ${data.session_id}`);
            
            // Store the session ID in the ref for reliable access
            sessionIdRef.current = data.session_id;
            
            // Also update the state for UI rendering
            setState(prev => ({ 
              ...prev, 
              sessionId: data.session_id,
              status: 'connecting'
            }));
            
            // Start the audio capture once we have a session ID
            await startAudioCapture();
          }
          
          // Handle transcription results
          if (data.text !== undefined) {
            if (data.is_final) {
              setState(prev => ({ 
                ...prev, 
                finalTexts: [...prev.finalTexts, data.text],
                interimText: ''
              }));
            } else {
              setState(prev => ({ ...prev, interimText: data.text }));
            }
          }
          
          // Handle completed transcription
          if (data.status === 'completed' && data.complete_text) {
            addDebugInfo('Transcription completed');
            addDebugInfo(`Current session ID from ref: ${sessionIdRef.current}`);
            
            // Update state with completed text
            setState(prev => ({ 
              ...prev, 
              status: 'completed',
              combinedText: data.complete_text
            }));
            
            // Submit the transcription using the complete_text from the message
            // No need to access state.combinedText which might not be updated yet
            submitTranscription(data.complete_text);
          }
          
          // Handle errors
          if (data.error) {
            addDebugInfo(`Server error: ${data.error}`);
            setState(prev => ({ 
              ...prev, 
              error: data.error
            }));
          }
        } catch (error) {
          addDebugInfo(`Error parsing WebSocket message: ${error instanceof Error ? error.message : String(error)}`);
        }
      };

      ws.onerror = (error) => {
        addDebugInfo(`WebSocket error: ${JSON.stringify(error)}`);
        setState(prev => ({ 
          ...prev, 
          status: 'error',
          error: 'WebSocket connection error'
        }));
      };

      ws.onclose = (event) => {
        addDebugInfo(`WebSocket closed: Code ${event.code}, Reason: ${event.reason}`);
        if (state.status === 'recording') {
          setState(prev => ({ 
            ...prev, 
            status: 'error',
            error: `WebSocket connection closed unexpectedly: ${event.code}`
          }));
        }
      };
    } catch (error) {
      addDebugInfo(`Failed to start: ${error instanceof Error ? error.message : String(error)}`);
      setState(prev => ({ 
        ...prev, 
        status: 'error',
        error: `Failed to start transcription: ${error instanceof Error ? error.message : String(error)}`
      }));
    }
  };

  // Start capturing audio and sending to WebSocket
  const startAudioCapture = async () => {
    try {
      addDebugInfo('Starting audio capture...');
      
      // Get user media
      addDebugInfo('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      addDebugInfo('Microphone access granted');
      
      mediaStreamRef.current = stream;
      
      if (!audioContextRef.current) {
        addDebugInfo('Audio context not found, reinitializing...');
        const initialized = await initializeAudioWorklet();
        if (!initialized) {
          throw new Error('Failed to initialize audio system');
        }
      }
      
      const audioContext = audioContextRef.current;
      if (!audioContext) {
        throw new Error('Audio context not initialized');
      }
      
      // Resume audio context if it's suspended (browser policy)
      if (audioContext.state === 'suspended') {
        addDebugInfo('Resuming suspended audio context...');
        await audioContext.resume();
        addDebugInfo(`Audio context state: ${audioContext.state}`);
      }
      
      // Create audio worklet node
      addDebugInfo('Creating AudioWorkletNode...');
      const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
      workletNodeRef.current = workletNode;
      
      // Connect audio graph
      addDebugInfo('Connecting audio graph...');
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(workletNode);
      // Don't connect to destination to avoid feedback
      // workletNode.connect(audioContext.destination); 
      
      // Handle messages from the processor
      workletNode.port.onmessage = (event) => {
        try {
          // Handle status messages
          if (event.data.status) {
            if (event.data.status === 'initialized') {
              addDebugInfo('AudioWorklet processor initialized');
            } else if (event.data.status === 'processing') {
              addDebugInfo(`AudioWorklet processing: ${event.data.count} samples processed`);
            }
            return;
          }
          
          // Handle audio data
          if (event.data.audioData && websocketRef.current) {
            if (websocketRef.current.readyState === WebSocket.OPEN) {
              // Convert to Base64
              const base64Data = arrayBufferToBase64(event.data.audioData);
              
              // Send to server
              websocketRef.current.send(JSON.stringify({
                audio: base64Data
              }));
              
              // Log every 20 messages to avoid flooding the console
              if (Math.random() < 0.05) {
                addDebugInfo(`Sent audio chunk: ${base64Data.substring(0, 20)}...`);
              }
            } else {
              addDebugInfo(`WebSocket not open: ${websocketRef.current.readyState}`);
            }
          }
        } catch (error) {
          addDebugInfo(`Error in AudioWorklet message handler: ${error instanceof Error ? error.message : String(error)}`);
        }
      };
      
      setState(prev => ({ ...prev, status: 'recording' }));
      addDebugInfo('Audio capture started successfully');
      
    } catch (error) {
      addDebugInfo(`Audio capture failed: ${error instanceof Error ? error.message : String(error)}`);
      setState(prev => ({ 
        ...prev, 
        status: 'error',
        error: `Failed to access microphone: ${error instanceof Error ? error.message : String(error)}`
      }));
    }
  };

  // Stop transcription
  const stopTranscription = () => {
    addDebugInfo('Stopping transcription...');
    setState(prev => ({ ...prev, status: 'processing' }));
    
    // Tell the worklet to stop processing
    if (workletNodeRef.current) {
      addDebugInfo('Stopping AudioWorklet...');
      workletNodeRef.current.port.postMessage({ command: 'stop' });
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    
    // Stop the media stream
    if (mediaStreamRef.current) {
      addDebugInfo('Stopping media stream...');
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Close the audio context
    if (audioContextRef.current) {
      addDebugInfo('Closing audio context...');
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Tell the server we're done
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      addDebugInfo('Sending stop command to server...');
      websocketRef.current.send(JSON.stringify({ command: 'stop' }));
    } else {
      addDebugInfo(`WebSocket not available for stop command: ${websocketRef.current?.readyState}`);
    }
  };

  // Convert ArrayBuffer to Base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Clean up resources on component unmount
  useEffect(() => {
    return () => {
      // Close WebSocket
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
      
      // Stop media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      
      // Clean up audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Revoke processor URL
      if (processorUrlRef.current) {
        URL.revokeObjectURL(processorUrlRef.current);
        processorUrlRef.current = null;
      }

      // Clear session ID ref
      sessionIdRef.current = null;
    };
  }, []);

  return (
    <div className="p-6 max-w-lg mx-auto bg-white rounded-xl shadow-md">
      <h1 className="text-2xl font-bold mb-4">Voice Transcription</h1>
      
      {/* Status indicator */}
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-500">Status</div>
        <div className="mt-1">
          {state.status === 'idle' && <span className="text-gray-700">Ready</span>}
          {state.status === 'connecting' && <span className="text-blue-600">Connecting...</span>}
          {state.status === 'recording' && (
            <span className="flex items-center text-green-600">
              <span className="h-2 w-2 bg-green-600 rounded-full mr-2 animate-pulse"></span>
              Recording
            </span>
          )}
          {state.status === 'processing' && <span className="text-yellow-600">Processing...</span>}
          {state.status === 'completed' && <span className="text-green-600">Completed</span>}
          {state.status === 'error' && <span className="text-red-600">Error</span>}
        </div>
      </div>
      
      {/* Error message */}
      {state.error && (
        <div className="p-3 mb-4 bg-red-100 border-l-4 border-red-500 text-red-700">
          <p>{state.error}</p>
        </div>
      )}
      
      {/* Transcription display */}
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-500 mb-2">Transcription</div>
        <div className="p-4 bg-gray-50 rounded-md min-h-32 max-h-64 overflow-y-auto">
          {state.finalTexts.map((text, index) => (
            <div key={index} className="mb-2 font-medium">{text}</div>
          ))}
          {state.interimText && (
            <div className="text-gray-500 italic">{state.interimText}</div>
          )}
          {state.status === 'idle' && !state.finalTexts.length && (
            <div className="text-gray-400">Transcription will appear here...</div>
          )}
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex space-x-4">
        {(state.status === 'idle' || state.status === 'completed' || state.status === 'error') && (
          <button
            onClick={startTranscription}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Start Recording
          </button>
        )}
        
        {state.status === 'recording' && (
          <button
            onClick={stopTranscription}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Stop Recording
          </button>
        )}
      </div>
      
      {/* Completed transcription */}
      {state.status === 'completed' && state.combinedText && (
        <div className="mt-6">
          <div className="text-sm font-medium text-gray-500 mb-2">Complete Transcription</div>
          <div className="p-4 bg-green-50 rounded-md border border-green-200">
            <p>{state.combinedText}</p>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            The transcription has been submitted to the API.
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptionComponent;