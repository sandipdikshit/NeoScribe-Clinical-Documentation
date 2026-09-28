import React, { useState, useEffect } from 'react';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import { Clock, User, Users } from 'lucide-react';
import { formatTime } from '@/shared/utils/date.utils';

interface Word {
  word: string;
  start: number;
  end: number;
  confidence: number | null;
  speaker: number | null;
}

interface TranscriptEntry {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: string;
  speaker: number | null;
  words: Word[];
  audioTimestamp?: number; // Start time in the audio
}

interface TranscriptDisplayProps {
  transcript: string;
  interimTranscript: string;
  isConnected: boolean;
  onTranscriptUpdate?: (entries: TranscriptEntry[]) => void;
}

const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({
  transcript,
  interimTranscript,
  isConnected,
  onTranscriptUpdate
}) => {
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [speakers, setSpeakers] = useState<Set<number>>(new Set());
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [showSpeakers, setShowSpeakers] = useState(true);
  const [selectedSpeaker, setSelectedSpeaker] = useState<number | null>(null);

  // Speaker colors
  const speakerColors = [
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-purple-100 text-purple-800',
    'bg-orange-100 text-orange-800',
    'bg-pink-100 text-pink-800',
    'bg-yellow-100 text-yellow-800'
  ];

  const getSpeakerColor = (speaker: number | null) => {
    if (speaker === null) return 'bg-gray-100 text-gray-800';
    return speakerColors[speaker % speakerColors.length];
  };

  // Filter entries by speaker
  const filteredEntries = selectedSpeaker !== null
    ? transcriptEntries.filter(entry => entry.speaker === selectedSpeaker)
    : transcriptEntries;

  // Calculate speaker statistics
  const speakerStats = React.useMemo(() => {
    const stats: { [key: number]: { wordCount: number; duration: number } } = {};
    
    transcriptEntries.forEach(entry => {
      if (entry.speaker !== null && entry.isFinal) {
        if (!stats[entry.speaker]) {
          stats[entry.speaker] = { wordCount: 0, duration: 0 };
        }
        stats[entry.speaker].wordCount += entry.text.split(' ').length;
        
        // Calculate duration from words
        if (entry.words.length > 0) {
          const duration = entry.words[entry.words.length - 1].end - entry.words[0].start;
          stats[entry.speaker].duration += duration;
        }
      }
    });
    
    return stats;
  }, [transcriptEntries]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setShowTimestamps(!showTimestamps)}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              showTimestamps 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Clock className="w-3 h-3 inline mr-1" />
            Timestamps
          </button>
          <button
            onClick={() => setShowSpeakers(!showSpeakers)}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              showSpeakers 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Users className="w-3 h-3 inline mr-1" />
            Speakers
          </button>
        </div>
        
        {/* Connection status */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-600">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Speaker Filter */}
      {showSpeakers && speakers.size > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedSpeaker(null)}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              selectedSpeaker === null
                ? 'bg-gray-700 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All Speakers
          </button>
          {Array.from(speakers).map(speaker => (
            <button
              key={speaker}
              onClick={() => setSelectedSpeaker(speaker)}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                selectedSpeaker === speaker
                  ? getSpeakerColor(speaker)
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <User className="w-3 h-3 inline mr-1" />
              Speaker {speaker + 1}
              {speakerStats[speaker] && (
                <span className="ml-2 text-xs opacity-75">
                  ({speakerStats[speaker].wordCount} words)
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Transcript */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Live Transcription</h4>
        <ScrollArea className="h-48 w-full">
          <div className="space-y-2">
            {filteredEntries.length === 0 && !interimTranscript ? (
              <p className="text-sm text-gray-400 italic">
                {!isConnected 
                  ? "Transcription service not available" 
                  : "Start speaking..."}
              </p>
            ) : (
              <>
                {filteredEntries.map((entry) => (
                  <div key={entry.id} className="flex gap-2 items-start">
                    {showTimestamps && entry.audioTimestamp !== undefined && (
                      <span className="text-xs text-gray-500 mt-0.5 min-w-[45px]">
                        {formatTime(entry.audioTimestamp)}
                      </span>
                    )}
                    {showSpeakers && (
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getSpeakerColor(entry.speaker)} min-w-[70px]`}
                      >
                        <User className="w-3 h-3 mr-1" />
                        {entry.speaker !== null ? `S${entry.speaker + 1}` : 'Unknown'}
                      </Badge>
                    )}
                    <p className={`text-sm flex-1 ${entry.isFinal ? 'text-gray-800' : 'text-gray-500'}`}>
                      {entry.text}
                    </p>
                  </div>
                ))}
                {interimTranscript && (
                  <div className="flex gap-2 items-start">
                    {showTimestamps && <span className="text-xs text-gray-500 mt-0.5 min-w-[45px]">--:--</span>}
                    {showSpeakers && (
                      <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600 min-w-[70px]">
                        <User className="w-3 h-3 mr-1" />
                        ...
                      </Badge>
                    )}
                    <p className="text-sm text-gray-400 italic flex-1">{interimTranscript}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Speaker Statistics */}
      {showSpeakers && Object.keys(speakerStats).length > 0 && (
        <div className="bg-blue-50 rounded-lg p-3">
          <h5 className="text-xs font-medium text-blue-900 mb-2">Speaker Statistics</h5>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(speakerStats).map(([speaker, stats]) => (
              <div key={speaker} className="text-xs text-blue-800">
                <span className="font-medium">Speaker {parseInt(speaker) + 1}:</span>{' '}
                {stats.wordCount} words, {formatTime(stats.duration)} speaking time
              </div>
            ))}
          </div>
        </div>
      )}

      {!isConnected && (
        <p className="text-xs text-amber-500">
          ⚠️ Real-time transcription unavailable. Recording will continue without live transcription.
        </p>
      )}
    </div>
  );
};

export default TranscriptDisplay;