"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Mic } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { getPatients } from "@/services/patientApis";
import NoteInfoForm from "@/shared/components/notes/NoteInfoForm";
import AddPatientDialog from "@/shared/components/patient/AddPatientDialog";
import { useViewport } from "@/shared/hooks/useViewport";
import { Patient } from '@/shared/types/patient.type';
import ProcessingProgress from "@/shared/components/ui/ProcessingProgress";

// Custom hooks
import { useRecordingState } from "./hooks/useRecordingState";
import { useWebSocket } from "./hooks/useWebSocket";
import { useAudioProcessing } from "./hooks/useAudioProcessing";
import { useDispatch, useSelector } from 'react-redux'

// Components
import RecordingControls from "./components/RecordingControls";

//Redux
import { closeRecordingDialogIndicator, openRecordingDialogIndicator } from '@/shared/reducers/recordingDialogIndicatorState.reducer'
import { openRecordingDialog, closeRecordingDialog, toggleRecordingDialog } from '@/shared/reducers/recordingDialogState.reducer'

interface RecordDialogProps {
  sidebarOpen?: boolean;
}

const RecordDialog: React.FC<RecordDialogProps> = ({ sidebarOpen }) => {
  const { toast } = useToast();
  const { isMobile } = useViewport();

  // Form state
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [selectedPatient, setSelectedPatient] = useState("");
  const [visitDate, setVisitDate] = useState<Date | undefined>(new Date());
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [noteType, setNoteType] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [addPatientOpen, setAddPatientOpen] = useState(false);

  // Custom hooks
  const recordingState = useRecordingState();
  const dispatch = useDispatch();
  const isRecordingDialogOpen = useSelector((state: any) => state.recordingDialogState.isOpen)


  // WebSocket handlers
  const webSocketHandlers = {
    onTranscriptUpdate: recordingState.updateTranscript,
    onProcessingComplete: () => {
      recordingState.updateProcessingTask('recording-processing', {
        status: 'completed',
        progress: 100,
        description: 'Note generated successfully!'
      });
      setTimeout(() => {
        recordingState.hideProgress();
        recordingState.clearProcessingTasks();
      }, 2000);
    },
    onTranscriptionJobCreated: () => {
      recordingState.updateProcessingTask('recording-processing', {
        progress: 75,
        description: 'Generating note...'
      });
      toast({
        title: "Success",
        description: "Recording saved and transcription job created successfully",
        duration: 3000,
      });
    },
    onError: (message: string) => {
      toast({
        title: "Transcription Error",
        description: message,
        variant: "destructive",
      });
    },
    onConnectionChange: recordingState.setConnected,
    onAuthenticatingChange: recordingState.setAuthenticating,
    onPatientDetailsLoadingChange: recordingState.setPatientDetailsLoading,
    onPatientDetailsAckReceived: recordingState.setPatientDetailsAckReceived,
    onUserCancelledChange: recordingState.setUserCancelled,
  };

  const { connectWebSocket, sendMessage, sendAudioData, pauseTranscription, resumeTranscription, closeWebSocket, isConnected } = useWebSocket(webSocketHandlers);

  // Audio processing handlers
  const audioProcessingHandlers = {
    onAudioChunk: recordingState.addAudioChunk,
    onRecordingStop: (audioBlob: Blob) => {
      // Handle recording stop
    },
    onError: (error: string) => {
      toast({
        title: "Recording Error",
        description: error,
        variant: "destructive",
      });
    },
  };

  const { setupAudioProcessing, setupMediaRecorder, cleanupAudioProcessing, requestMicrophoneAccess } = useAudioProcessing(audioProcessingHandlers);

  // Fetch patients when dialog opens
  useEffect(() => {
    if (isRecordingDialogOpen && !recordingState.isRecording) {
      fetchPatients();
    }
  }, [isRecordingDialogOpen, recordingState.isRecording]);

  useEffect(() => {
    if (recordingState.isRecording && !isRecordingDialogOpen) {
      dispatch(openRecordingDialogIndicator())
    } else if (!recordingState.isRecording && isRecordingDialogOpen) {
      dispatch(closeRecordingDialogIndicator())
    }
  }, [isRecordingDialogOpen, recordingState.isRecording, dispatch])

  const fetchPatients = async () => {
    setIsLoadingPatients(true);
    try {
      const response = await getPatients();
      if (!response) {
        throw new Error("Failed to fetch patients");
      }
      setPatients(response);
    } catch (error) {
      console.error("Error fetching patients:", error);
      toast({
        title: "Error fetching patients",
        description: "Unable to fetch patients. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPatients(false);
    }
  };

  const handleAddPatient = () => {
    dispatch(closeRecordingDialog())
    setAddPatientOpen(true);
  };

  const handlePatientAdded = (newPatient: Patient) => {
    setPatients((prev) => [...prev, newPatient]);
    setSelectedPatient(newPatient.patient_id);
  };

  const handleStartRecording = async () => {
    if (recordingState.isPatientDetailsLoading || recordingState.isAuthenticating) {
      return;
    }

    try {
      // Reset previous recording details
      recordingState.clearTranscript();
      recordingState.clearProcessingTasks();
      recordingState.hideProgress();

      // Connect WebSocket with authentication
      try {
        await connectWebSocket();
      } catch (error) {
        console.error('WebSocket connection failed:', error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to transcription service. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Start recording state
      recordingState.startRecording();

      // Send patient details
      if (isConnected() && selectedPatient && selectedTemplate && visitDate && chiefComplaint.trim()) {
        recordingState.setPatientDetailsLoading(true);
        recordingState.setPatientDetailsAckReceived(false);

        const patient = patients.find(p => p.patient_id === selectedPatient);
        if (patient) {
          const patientDetails = {
            type: 'patient_details',
            patient: {
              chief_complaint: chiefComplaint,
              patient_id: patient.patient_id,
              visit_date: visitDate?.toISOString(),
              template_id: selectedTemplate,
              note_type: noteType
            }
          };

          sendMessage(patientDetails);

          // Allow some time for acknowledgment
          await new Promise(resolve => setTimeout(resolve, 2000));
          recordingState.setPatientDetailsLoading(false);
        }
      } else if (!selectedPatient || !selectedTemplate || !visitDate || !chiefComplaint.trim()) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields before starting recording.",
          variant: "destructive",
        });
        recordingState.stopRecording();
        return;
      }

      // Request microphone access
      const stream = await requestMicrophoneAccess();
      recordingState.setStream(stream);

      // Setup audio processing
      await setupAudioProcessing(stream, sendAudioData, recordingState.isPaused);

      // Setup MediaRecorder
      const mediaRecorder = setupMediaRecorder(stream);
      recordingState.setMediaRecorder(mediaRecorder);

      mediaRecorder.onstop = async () => {
        if (isConnected()) {
          sendMessage({ type: 'audio_end' });

          // Close the record dialog and show processing progress
          dispatch(closeRecordingDialog())
          recordingState.showProgress();

          // Add processing task
          recordingState.addProcessingTask({
            id: 'recording-processing',
            title: 'Processing Recording',
            progress: 0,
            status: 'processing',
            description: 'Transcribing and generating note...'
          });

          // Simulate progress updates
          const currentTask = recordingState.processingTasks.find(task => task.id === 'recording-processing');
          const progressInterval = setInterval(() => {
            if (currentTask && currentTask.progress < 50) {
              recordingState.updateProcessingTask('recording-processing', {
                progress: currentTask.progress + 5
              });
            }
          }, 1000);

          // Clear interval after 10 seconds
          setTimeout(() => {
            clearInterval(progressInterval);
          }, 10000);
        }

        // Cleanup
        cleanupAudioProcessing();
        stream.getTracks().forEach((track) => track.stop());
        recordingState.setStream(null);
      };

      mediaRecorder.start(1000);

      toast({
        description: "Recording started",
        duration: 2000,
      });

    } catch (error) {
      console.error("Error starting recording:", error);
      recordingState.stopRecording();
      recordingState.setPatientDetailsLoading(false);
      recordingState.setAuthenticating(false);
    }
  };

  const handlePauseRecording = () => {
    const mediaRecorder = recordingState.getMediaRecorder();
    if (mediaRecorder?.state === "recording") {
      mediaRecorder.pause();
      recordingState.pauseRecording();
      // Pause transcription on the server
      pauseTranscription();
    }
  };

  const handleResumeRecording = () => {
    const mediaRecorder = recordingState.getMediaRecorder();
    if (mediaRecorder?.state === "paused") {
      mediaRecorder.resume();
      recordingState.resumeRecording();
      // Resume transcription on the server
      resumeTranscription();
    }
  };

  const handleStopRecording = () => {
    const mediaRecorder = recordingState.getMediaRecorder();

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      try {
        if (mediaRecorder.state === "paused") {
          mediaRecorder.resume();
        }

        mediaRecorder.stop();
        recordingState.stopRecording();
        dispatch(closeRecordingDialog())

      } catch (error) {
        console.error('Error stopping recording:', error);
        recordingState.stopRecording();
      }
    } else {
      recordingState.stopRecording();
    }
  };

  const handleCancelRecording = () => {
    // Set user cancelled flag
    recordingState.setUserCancelled(true);

    // Stop media recorder if active
    const mediaRecorder = recordingState.getMediaRecorder();
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.onstop = null;
      mediaRecorder.stop();
    }

    // Clear audio chunks
    recordingState.clearAudioChunks();

    // Reset recording states
    recordingState.stopRecording();
    recordingState.resetRecordingState();

    // Cleanup audio processing
    cleanupAudioProcessing();

    // Gracefully close WebSocket connection
    if (isConnected()) {
      // Send a cancellation message to the server before closing
      try {
        sendMessage({ type: 'audio_cancel' });
      } catch (error) {
        console.error('Error sending cancellation message:', error);
      }

      // Close the connection gracefully
      closeWebSocket(1000, 'Recording cancelled by user');
    }

    // Stop media stream
    const stream = recordingState.getStream();
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      recordingState.setStream(null);
    }

    toast({
      description: "Recording cancelled",
      duration: 2000,
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    // Prevent closing dialog when loading or authenticating
    if (!newOpen && (recordingState.isPatientDetailsLoading || recordingState.isAuthenticating)) {
      return;
    }

    dispatch(toggleRecordingDialog());
    // Only reset form state when dialog closes and not recording
    if (!newOpen && !recordingState.isRecording) {
      setChiefComplaint("");
      setSelectedPatient("");
      setVisitDate(new Date());
      setSelectedTemplate("");
      setNoteType("");
      recordingState.resetRecordingState();
    } else if (newOpen && !recordingState.isRecording) {
      // Reset recording state when dialog opens (only if not already recording)
      recordingState.resetRecordingState();
    }
    // Note: When recording is active and dialog closes, we preserve all recording state
  };

  const handleSetParentDialogOpen = () => {
    dispatch(openRecordingDialog());
  };

  const handleCloseProcessingProgress = () => {
    recordingState.hideProgress();
    recordingState.clearProcessingTasks();
  };

  const handleCancelProcessingTask = (taskId: string) => {
    // For recording, we can't really cancel the processing on the backend
    // but we can close the progress panel
    recordingState.hideProgress();
    recordingState.clearProcessingTasks();
    toast({
      description: "Processing will continue in the background",
      duration: 3000,
    });
  };

  return (
    <>
      <Dialog open={isRecordingDialogOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className={`${recordingState.isRecording
              ? "bg-red-200 text-red-700 border-red-300 hover:bg-red-300 hover:text-red-700 hover:border-red-400"
              : "bg-emerald-200 text-green-700 border-emerald-300 hover:bg-emerald-300 hover:text-green-700 hover:border-emerald-400"
              } ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <Mic className={`w-4 h-4 ${sidebarOpen ? 'mr-2' : ''} ${recordingState.isRecording ? 'animate-pulse' : ''}`} />
            {sidebarOpen ? (<span>{recordingState.isRecording ? "Recording..." : "Record"}</span>) : null}
          </Button>
        </DialogTrigger>
        <DialogContent
          className={`
            ${recordingState.isRecording ? "sm:max-w-3xl" : "sm:max-w-2xl"}
            ${isMobile ? "h-full max-h-[100vh]" : "max-h-[90vh]"}
          `}
          onInteractOutside={(e) => {
            // Only prevent closing when loading/authenticating, but allow closing during recording
            if (recordingState.isPatientDetailsLoading || recordingState.isAuthenticating) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {recordingState.isRecording ? "Recording Conversation" : "Record Conversation"}
            </DialogTitle>
          </DialogHeader>

          <div className={`${isMobile ? "overflow-y-auto" : ""} ${recordingState.isRecording ? "" : "space-y-4"}`}>
            {!recordingState.isRecording && (
              <NoteInfoForm
                chiefComplaint={chiefComplaint}
                setChiefComplaint={setChiefComplaint}
                selectedPatient={selectedPatient}
                setSelectedPatient={setSelectedPatient}
                visitDate={visitDate}
                setVisitDate={setVisitDate}
                selectedTemplate={selectedTemplate}
                setSelectedTemplate={setSelectedTemplate}
                setNoteType={setNoteType}
                patients={patients}
                isLoading={isLoadingPatients}
                onAddPatient={handleAddPatient}
              />
            )}

            <RecordingControls
              isRecording={recordingState.isRecording}
              isPaused={recordingState.isPaused}
              isPatientDetailsLoading={recordingState.isPatientDetailsLoading}
              isAuthenticating={recordingState.isAuthenticating}
              isConnected={recordingState.isConnected}
              transcript={recordingState.transcript}
              interimTranscript={recordingState.interimTranscript}
              mediaStream={recordingState.mediaStream}
              selectedPatient={selectedPatient}
              selectedTemplate={selectedTemplate}
              onStartRecording={handleStartRecording}
              onPauseRecording={handlePauseRecording}
              onResumeRecording={handleResumeRecording}
              onStopRecording={handleStopRecording}
              onCancelRecording={handleCancelRecording}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AddPatientDialog
        open={addPatientOpen}
        setOpen={setAddPatientOpen}
        onPatientAdded={handlePatientAdded}
        parentDialogOpen={true}
        setParentDialogOpen={handleSetParentDialogOpen}
      />

      <ProcessingProgress
        tasks={recordingState.processingTasks}
        isVisible={recordingState.showProcessingProgress}
        onClose={handleCloseProcessingProgress}
        onCancelTask={handleCancelProcessingTask}
        title="Recording Processing"
      />
    </>
  );
};

export default RecordDialog;