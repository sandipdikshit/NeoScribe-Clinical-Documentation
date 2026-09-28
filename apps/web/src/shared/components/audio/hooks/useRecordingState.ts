import { useState, useRef } from 'react';
import { useToast } from "@/shared/hooks/use-toast";
import { ProcessingTask } from "@/shared/components/ui/ProcessingProgress";

export const useRecordingState = () => {
  const { toast } = useToast();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Processing progress state
  const [processingTasks, setProcessingTasks] = useState<ProcessingTask[]>([]);
  const [showProcessingProgress, setShowProcessingProgress] = useState(false);
  const [isUserCancelled, setIsUserCancelled] = useState(false);

  // WebSocket and transcription state
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  // Patient details websocket state
  const [isPatientDetailsLoading, setIsPatientDetailsLoading] = useState(false);
  const [patientDetailsAckReceived, setPatientDetailsAckReceived] = useState(false);

  const resetRecordingState = () => {
    setTranscript("");
    setInterimTranscript("");
    setProcessingTasks([]);
    setShowProcessingProgress(false);
    setIsPatientDetailsLoading(false);
    setPatientDetailsAckReceived(false);
    setIsAuthenticating(false);
    setIsUserCancelled(false);
  };

  const startRecording = () => {
    setIsRecording(true);
    setIsPaused(false);
  };

  const pauseRecording = () => {
    setIsPaused(true);
  };

  const resumeRecording = () => {
    setIsPaused(false);
  };

  const stopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
  };

  const setMediaRecorder = (recorder: MediaRecorder | null) => {
    mediaRecorderRef.current = recorder;
  };

  const getMediaRecorder = () => mediaRecorderRef.current;

  const addAudioChunk = (chunk: Blob) => {
    audioChunksRef.current.push(chunk);
  };

  const getAudioChunks = () => audioChunksRef.current;

  const clearAudioChunks = () => {
    audioChunksRef.current = [];
  };

  const setStream = (stream: MediaStream | null) => {
    setMediaStream(stream);
  };

  const getStream = () => mediaStream;

  const addProcessingTask = (task: ProcessingTask) => {
    setProcessingTasks(prev => [...prev, task]);
  };

  const updateProcessingTask = (taskId: string, updates: Partial<ProcessingTask>) => {
    setProcessingTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ));
  };

  const clearProcessingTasks = () => {
    setProcessingTasks([]);
  };

  const showProgress = () => {
    setShowProcessingProgress(true);
  };

  const hideProgress = () => {
    setShowProcessingProgress(false);
  };

  const setUserCancelled = (cancelled: boolean) => {
    setIsUserCancelled(cancelled);
  };

  const setConnected = (connected: boolean) => {
    setIsConnected(connected);
  };

  const setAuthenticating = (authenticating: boolean) => {
    setIsAuthenticating(authenticating);
  };

  const setPatientDetailsLoading = (loading: boolean) => {
    setIsPatientDetailsLoading(loading);
  };

  const updateTranscript = (text: string, isFinal: boolean = false) => {
    if (isFinal) {
      setTranscript(prev => prev ? prev + ' ' + text : text);
      setInterimTranscript('');
    } else {
      setInterimTranscript(text);
    }
  };

  const clearTranscript = () => {
    setTranscript("");
    setInterimTranscript("");
  };

  return {
    // State
    isRecording,
    isPaused,
    mediaStream,
    processingTasks,
    showProcessingProgress,
    isUserCancelled,
    isConnected,
    isAuthenticating,
    transcript,
    interimTranscript,
    isPatientDetailsLoading,
    patientDetailsAckReceived,

    // Actions
    resetRecordingState,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    setMediaRecorder,
    getMediaRecorder,
    addAudioChunk,
    getAudioChunks,
    clearAudioChunks,
    setStream,
    getStream,
    addProcessingTask,
    updateProcessingTask,
    clearProcessingTasks,
    showProgress,
    hideProgress,
    setUserCancelled,
    setConnected,
    setAuthenticating,
    setPatientDetailsLoading,
    setPatientDetailsAckReceived,
    updateTranscript,
    clearTranscript,
  };
};

