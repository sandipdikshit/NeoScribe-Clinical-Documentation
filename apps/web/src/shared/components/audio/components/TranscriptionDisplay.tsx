import React, { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { useViewport } from "@/shared/hooks/useViewport";

interface TranscriptionDisplayProps {
    transcript: string;
    interimTranscript: string;
    isConnected: boolean;
    isAuthenticating: boolean;
    isPatientDetailsLoading: boolean;
}

const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
    transcript,
    interimTranscript,
    isConnected,
    isAuthenticating,
    isPatientDetailsLoading,
}) => {
    const { isMobile } = useViewport();
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new transcript comes in with debouncing
    useEffect(() => {
        const scrollToBottom = () => {
            if (transcriptEndRef.current) {
                transcriptEndRef.current.scrollIntoView({
                    behavior: "smooth",
                    block: "end",
                    inline: "nearest"
                });
            }
        };

        const timeoutId = setTimeout(scrollToBottom, 100);
        return () => clearTimeout(timeoutId);
    }, [transcript, interimTranscript]);

    return (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="p-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-100">
                        Live Transcription
                    </h4>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : isAuthenticating ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {isConnected ? 'Connected' : isAuthenticating ? 'Authenticating...' : 'Disconnected'}
                        </span>
                    </div>
                </div>
            </div>

            {isPatientDetailsLoading || isAuthenticating ? (
                <div className="p-8 text-center">
                    <div className="flex items-center justify-center mb-4">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {isAuthenticating ? "Authenticating..." : "Connecting to server and sending patient details..."}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Please wait while we establish a secure connection
                    </p>
                </div>
            ) : (
                <ScrollArea className={isMobile ? "h-[40vh]" : "h-[50vh] min-h-[300px]"}>
                    <div className="p-4">
                        {!transcript && !interimTranscript ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-8">
                                {isConnected ? "Start speaking..." : "Transcription service not available. Recording will continue without live transcription."}
                            </p>
                        ) : (
                            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                {transcript}
                                {interimTranscript && (
                                    <span className="text-gray-400 dark:text-gray-500 italic"> {interimTranscript}</span>
                                )}
                                <div ref={transcriptEndRef} />
                            </div>
                        )}
                    </div>
                </ScrollArea>
            )}
        </div>
    );
};

export default TranscriptionDisplay;

