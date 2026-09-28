import React from 'react';
import { Button } from "@/shared/components/ui/button";
import { Mic, Square, Loader2, Play, Pause, X } from "lucide-react";
import AudioVisualizer from "@/shared/components/audio/AudioVisualizer";
import TranscriptionDisplay from "./TranscriptionDisplay";
import { getAuthToken } from "@/services/authApis";

interface RecordingControlsProps {
    isRecording: boolean;
    isPaused: boolean;
    isPatientDetailsLoading: boolean;
    isAuthenticating: boolean;
    isConnected: boolean;
    transcript: string;
    interimTranscript: string;
    mediaStream: MediaStream | null;
    selectedPatient: string;
    selectedTemplate: string;
    onStartRecording: () => void;
    onPauseRecording: () => void;
    onResumeRecording: () => void;
    onStopRecording: () => void;
    onCancelRecording: () => void;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({
    isRecording,
    isPaused,
    isPatientDetailsLoading,
    isAuthenticating,
    isConnected,
    transcript,
    interimTranscript,
    mediaStream,
    selectedPatient,
    selectedTemplate,
    onStartRecording,
    onPauseRecording,
    onResumeRecording,
    onStopRecording,
    onCancelRecording,
}) => {
    if (!isRecording) {
        return (
            <div className="space-y-3">
                {isPatientDetailsLoading || isAuthenticating ? (
                    <div className="space-y-4 py-8">
                        <div className="flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                        <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                            {isAuthenticating ? "Authenticating..." : "Connecting to server and sending patient details..."}
                        </p>
                        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                            Please wait while we establish a secure connection
                        </p>
                    </div>
                ) : (
                    <Button
                        onClick={onStartRecording}
                        variant="secondary"
                        disabled={!selectedPatient || !selectedTemplate || !getAuthToken()}
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Mic className="w-5 h-5 mr-2" />
                        Start Recording
                    </Button>
                )}
                {(!selectedPatient || !selectedTemplate) && !isPatientDetailsLoading && !isAuthenticating && (
                    <p className="text-xs text-center text-amber-600 dark:text-amber-500">
                        Please select a patient and template to enable recording
                    </p>
                )}
                {!getAuthToken() && !isPatientDetailsLoading && !isAuthenticating && (
                    <p className="text-xs text-center text-red-600 dark:text-red-500">
                        Please log in to use the recording feature
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <AudioVisualizer isRecording={isRecording} mediaStream={mediaStream} />

            <TranscriptionDisplay
                transcript={transcript}
                interimTranscript={interimTranscript}
                isConnected={isConnected}
                isAuthenticating={isAuthenticating}
                isPatientDetailsLoading={isPatientDetailsLoading}
            />

            <div className="space-y-3">
                <div className="flex gap-2">
                    {!isPaused ? (
                        <Button
                            onClick={onPauseRecording}
                            variant="secondary"
                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            <Pause className="w-4 h-4 mr-2" />
                            Pause
                        </Button>
                    ) : (
                        <Button
                            onClick={onResumeRecording}
                            variant="secondary"
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                            <Play className="w-4 h-4 mr-2" />
                            Resume
                        </Button>
                    )}
                    <Button
                        onClick={onStopRecording}
                        variant="default"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <Square className="w-4 h-4 mr-2" />
                        Stop & Save
                    </Button>
                </div>

                <Button
                    onClick={onCancelRecording}
                    variant="outline"
                    className="w-full"
                >
                    <X className="w-4 h-4 mr-2" />
                    Cancel Recording
                </Button>
            </div>

            {isPaused && (
                <p className="text-sm text-center text-amber-600 dark:text-amber-500 animate-pulse">
                    Recording paused
                </p>
            )}
        </div>
    );
};

export default RecordingControls;

