// SoapNoteView.jsx
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatDate } from "@/shared/lib/utils";
import {
  Clock, MessageSquare, FileText, CheckCircle,
  XCircle, RefreshCcw,
  EarOff,
  ChevronLeft,
  Calendar
} from "lucide-react";

// Import our component panels
import SoapNotePanel from '@/shared/components/notes/SoapNotePanel';
import TranscriptPanel from '@/shared/components/notes/transcript';
import { getSections, getNoteWithID, getAudio } from '@/services/notesApis';
import AudioPlayer from '@/shared/components/AudioPlayer';

// Import Skeleton component
import { Skeleton } from "@/shared/components/ui/skeleton";

import { TranscriptionResult, TranscriptionMetadata, TranscriptSegment, } from '@/shared/types/transcript.type';
import { Note, Section, NoteSections } from '@/shared/types/note.type';
import { Patient } from '@/shared/types/patient.type';

interface SoapNoteViewProps {
  noteId: string;
}

const SoapNoteView: React.FC<SoapNoteViewProps> = ({ noteId }) => {

  interface StatusMessage {
    type: 'success' | 'error' | 'info';
    text: string;
  }

  const router = useRouter();

  // State management
  const [sections, setSections] = useState<NoteSections | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [audioURI, setAudioURI] = useState<string | null>(null)
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'soap' | 'transcript'>('split');

  // Detect viewport size for responsive layout
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewMode('soap'); // Default to SOAP note view on mobile
      } else {
        setViewMode('split'); // Default to split view on larger screens
      }
    };

    // Initial check
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchSections = async () => {
    try {
      const response = await getSections(noteId);

      if (!response) {
        throw new Error(`Failed to fetch SOAP data: ${response.status}`);
      }

      return {
        sections: response
      };
    } catch (error) {
      console.error('Error fetching SOAP data:', error);
      throw error;
    }
  };

  const fetchNote = async () => {
    try {
      const response = await getNoteWithID(noteId);

      if (!response) {
        throw new Error(`Failed to fetch note data: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error('Error fetching note data:', error);
      throw error;
    }
  };

  const fetchAudio = async () => {
    try {
      const response = await getAudio(noteId);

      if (!response) {
        throw new Error(`Failed to fetch note data: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error('Error fetching note data:', error);
      throw error;
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load note and sections in parallel
      const [noteResponse, sectionsResponse, audioResponse] = await Promise.all([
        fetchNote(),
        fetchSections(),
        fetchAudio()
      ]);

      setNote(noteResponse);
      setSections(sectionsResponse);
      setAudioURI(audioResponse);

      setLoading(false);
      setStatusMessage({ type: 'success', text: 'Data loaded successfully' });

      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setLoading(false);
      setStatusMessage({ type: 'error', text: `Error loading data: ${errorMessage}` });
    }
  };

  useEffect(() => {
    if (noteId) {
      loadData();
    }
  }, [noteId]);

  const handleRefresh = () => {
    setStatusMessage({ type: 'info', text: 'Refreshing data...' });
    loadData();
  };

  // Handle section updates from child components
  const handleSectionUpdate = (updatedSection: Section) => {
    if (sections) {
      const updatedSections = sections.sections.map(section =>
        section.section_id === updatedSection.section_id ? updatedSection : section
      );

      setSections({
        sections: updatedSections
      });

      // Show a success message
      setStatusMessage({
        type: 'success',
        text: `${updatedSection.section_name} updated successfully`
      });

      // Auto-hide the message after 3 seconds
      setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
    }
  };

  // Toggle between view modes (mobile only)
  const toggleViewMode = (mode: 'soap' | 'transcript') => {
    setViewMode(mode);
  };


  const handleBackToList = () => {
    router.push('/dashboard?tab=Notes');
  }

  // Skeleton loader component for header
  const HeaderSkeleton = () => (
    <Card className="mb-4 md:mb-6 border-none overflow-hidden">
      <div className="bg-gradient-to-r from-neutral-900 to-blue-900 text-white">
        <CardHeader className="p-3 md:p-4 lg:p-6">
          <div className="flex flex-col space-y-3 md:space-y-4">
            {/* Top row skeleton */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
              <Skeleton className="h-4 w-32 bg-neutral-700" />
              <div className="flex items-center space-x-3">
                <Skeleton className="h-6 w-20 rounded-full bg-neutral-700" />
                <Skeleton className="h-7 w-20 rounded-md bg-neutral-700" />
              </div>
            </div>

            {/* Title row skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-7 w-3/4 bg-neutral-700" />
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <Skeleton className="h-4 w-20 bg-neutral-700" />
                <Skeleton className="h-4 w-32 bg-neutral-700" />
                <Skeleton className="h-4 w-24 bg-neutral-700" />
              </div>
            </div>
          </div>
        </CardHeader>

        <div className="px-4 pb-4">
          <Skeleton className="h-12 w-full bg-neutral-700 rounded-md" />
        </div>
      </div>
    </Card>
  );

  // Skeleton loader for SOAP panel
  const SoapPanelSkeleton = () => (
    <div className="space-y-4">
      {/* Section headers + content skeletons */}
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3">
          <Skeleton className="h-6 w-40 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
        </div>
      ))}
    </div>
  );

  // Skeleton loader for Transcript panel
  const TranscriptPanelSkeleton = () => (
    <div className="border rounded-lg p-4 space-y-3">
      <Skeleton className="h-6 w-40 rounded-md" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-3/4 rounded-md" />
      </div>
    </div>
  );

  // Show error state
  if (error && !loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200 max-w-md">
          <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-red-800 mb-2">Failed to Load Data</h2>
          <p className="text-gray-600 mb-4">
            {error || "Unable to load the note data."}
          </p>
          <Button
            variant="outline"
            onClick={handleRefresh}
            className="flex items-center space-x-2"
          >
            <RefreshCcw className="h-4 w-4" />
            <span>Try Again</span>
          </Button>
        </div>
      </div>
    );
  }


  const transcriptionText = note?.transcription_result?.transcription_data || note?.transcription_result?.transcription || '';

  return (
    <div className="max-w-full h-screen mx-auto p-2 md:p-4 lg:p-6">
      {/* Header Card */}
      {loading ? (
        <HeaderSkeleton />

      ) : (
        <Card className="mb-4 md:mb-6 border-none overflow-hidden">
          <div className="bg-gradient-to-r from-neutral-900 to-blue-900 text-white">
            <CardHeader className="p-3 md:p-4 lg:p-6">
              <div className="flex flex-col space-y-3 md:space-y-4">
                {/* Top row with date and status */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
                  <div className="flex items-center space-x-2 text-neutral-200 relative">
                    <Button
                      onClick={handleBackToList}
                      className="text-white bg-transparent rounded-full h-8 border-none hover:bg-blue-500 hover:text-white"
                      variant="outline"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </Button>
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {formatDate(note?.visit_date || new Date().toISOString())}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    {statusMessage ? (
                      <Badge
                        variant="default"
                        className={`flex items-center space-x-1 ${statusMessage.type === 'success' ? 'bg-green-600' :
                          statusMessage.type === 'error' ? 'bg-red-600' :
                            'bg-blue-600'
                          }`}
                      >
                        {statusMessage.type === 'success' ? <CheckCircle className="h-3 w-3 mr-1" /> :
                          statusMessage.type === 'error' ? <XCircle className="h-3 w-3 mr-1" /> :
                            <Clock className="h-3 w-3 mr-1" />}
                        {statusMessage.text}
                      </Badge>
                    ) : (
                      <Badge
                        variant="default"
                        className={`flex items-center space-x-1 ${note?.status === 'COMPLETED' || note?.status === 'SIGNED' ? 'bg-green-600' :
                          note?.status === 'ERROR' ? 'bg-red-600' :
                            note?.status === 'PROCESSING' || note?.status === 'ANALYZING' ? 'bg-blue-600' :
                              'bg-yellow-600'
                          }`}
                      >
                        {note?.status === 'COMPLETED' || note?.status === 'SIGNED' ? <CheckCircle className="h-3 w-3 mr-1" /> :
                          note?.status === 'ERROR' ? <XCircle className="h-3 w-3 mr-1" /> :
                            note?.status === 'FAILED' ? <EarOff className="h-3 w-3 mr-1" /> :
                              <Clock className="h-3 w-3 mr-1" />}
                        {note?.status}
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-transparent border-white text-white hover:bg-white/20 h-7"
                      onClick={handleRefresh}
                      disabled={loading}
                    >
                      <RefreshCcw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
                      <span className="text-xs">Refresh</span>
                    </Button>
                  </div>
                </div>

                {/* Title row */}
                <div className="space-y-2">
                  <CardTitle className="text-lg md:text-xl lg:text-2xl font-bold leading-tight">
                    {note?.note_title || `${note?.note_type} Note`}
                  </CardTitle>

                  {/* Note ID and type indicator */}
                  <div className="flex flex-wrap items-center gap-2 md:gap-3 text-neutral-300 text-xs md:text-sm">
                    <div className="flex items-center space-x-1">
                      <MessageSquare className="h-3 w-3 md:h-4 md:w-4" />
                      <span>{note?.note_type || "Note"}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <FileText className="h-3 w-3 md:h-4 md:w-4" />
                      <span className="truncate max-w-[120px] md:max-w-none">ID: {note?.note_id || noteId}</span>
                    </div>
                    {note?.chief_complaint && (
                      <div className="flex items-center space-x-1">
                        <span className="font-medium">CC:</span>
                        <span className="truncate max-w-[150px] md:max-w-none">{note?.chief_complaint}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>

            <div className="">
              <AudioPlayer
                audioUrl={audioURI || ''}
                title={'Session Recording'}
              />
            </div>
          </div>
        </Card>

      )}

      {/* Mobile view toggle buttons */}
      <div className="md:hidden flex mb-4 gap-2">
        <Button
          className={`flex-1 ${viewMode === 'soap' ? '!bg-blue-600 text-white' : '!bg-gray-100 text-gray-700'}`}
          onClick={() => toggleViewMode('soap')}
        >
          Note
        </Button>
        <Button
          className={`flex-1 ${viewMode === 'transcript' ? '!bg-blue-600 text-white' : '!bg-gray-100 text-gray-700'}`}
          onClick={() => toggleViewMode('transcript')}
        >
          Transcript
        </Button>
      </div>

      {/* Mobile View with fixed height and sticky player */}
      <div className="md:hidden flex flex-col h-[calc(100vh-180px)]">
        <div className="flex-grow overflow-auto pb-4">
          {viewMode === 'soap' && (
            <div className="h-full overflow-auto">
              {loading ? (
                <SoapPanelSkeleton />
              ) : (
                <SoapNotePanel
                  soapData={sections || { sections: [] }}
                  isLoading={loading}
                  noteType={note?.note_type || ''}
                  note={note ?? undefined}
                />
              )}
            </div>
          )}
          {viewMode === 'transcript' && (
            <div className="h-full overflow-auto">
              {loading ? (
                <TranscriptPanelSkeleton />
              ) : (
                <TranscriptPanel originalText={transcriptionText} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tablet and Desktop View with sticky player */}
      <div className="hidden md:flex md:flex-col h-[calc(100vh-200px)]">
        <div className="flex-grow flex md:flex-row md:gap-4 overflow-auto pb-2">
          {/* SOAP Note (Left/Middle) */}
          <div className="w-2/3 lg:w-3/4">
            {loading ? (
              <SoapPanelSkeleton />
            ) : (
              <SoapNotePanel
                soapData={sections || { sections: [] }}
                isLoading={loading}
                noteType={note?.note_type || ''}
                note={note ?? undefined}
              />
            )}
          </div>

          {/* Transcript (Right) */}
          <div className="w-1/3 lg:w-1/4">
            {loading ? (
              <TranscriptPanelSkeleton />
            ) : (
              <TranscriptPanel originalText={transcriptionText} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SoapNoteView;