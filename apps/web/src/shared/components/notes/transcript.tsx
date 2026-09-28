import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { MessageSquare, Stethoscope, User, Clock } from "lucide-react";
import { TranscriptSegment } from '@/shared/types/transcript.type';
import { formatTime } from '@/shared/utils/date.utils';

interface TranscriptPanelProps {
  originalText: string | TranscriptSegment[];
}

// Render JSON format transcript
const renderJsonTranscript = (segments: TranscriptSegment[]) => {
  // Group consecutive segments by speaker for better conversation flow
  const groupedSegments: { speaker: number; segments: TranscriptSegment[] }[] = [];

  segments.forEach((segment) => {
    const lastGroup = groupedSegments[groupedSegments.length - 1];
    if (lastGroup && lastGroup.speaker === segment.speaker) {
      lastGroup.segments.push(segment);
    } else {
      groupedSegments.push({ speaker: segment.speaker, segments: [segment] });
    }
  });

  return groupedSegments.map((group, groupIndex) => {
    const isDoctor = group.speaker === 0;
    const speakerName = isDoctor ? "Doctor" : "Patient";
    const bgColor = isDoctor
      ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
      : "bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500";
    const iconBg = isDoctor ? "bg-blue-500" : "bg-green-500";
    const Icon = isDoctor ? Stethoscope : User;

    return (
      <div key={groupIndex} className={`mb-4 p-3 rounded-lg ${bgColor} transition-all hover:shadow-sm`}>
        <div className="flex items-start space-x-3">
          <div className={`flex-shrink-0 w-8 h-8 rounded-full ${iconBg} text-white flex items-center justify-center`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              {/* <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                  {speakerName}
                </h4> */}
              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                <Clock className="w-3 h-3 mr-1" />
                <span>{formatTime(group.segments[0].start)}</span>
                {group.segments.length > 1 && (
                  <span className="ml-1">- {formatTime(group.segments[group.segments.length - 1].end)}</span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              {group.segments.map((segment, segIndex) => (
                <p key={segIndex} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {segment.text}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  });
};

// Format text-based transcript (legacy support)
const renderTextTranscript = (text: string) => {
  if (!text) return <p className="text-gray-500 text-center py-4">No transcript available</p>;

  // Split by speaker change (quotes)
  const parts = text.split('"');

  return parts.map((part, index) => {
    if (index === 0 && part.trim()) {
      return (
        <div key={index} className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          {part}
        </div>
      );
    }

    // Odd indices are dialogue
    if (index % 2 === 1) {
      // Alternate between doctor and patient for text format
      const isDoctor = Math.floor(index / 2) % 2 === 0;
      const speakerName = isDoctor ? "Doctor" : "Patient";
      const bgColor = isDoctor
        ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
        : "bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500";
      const iconBg = isDoctor ? "bg-blue-500" : "bg-green-500";
      const Icon = isDoctor ? Stethoscope : User;

      return (
        <div key={index} className={`mb-3 p-3 rounded-lg ${bgColor} transition-all hover:shadow-sm`}>
          <div className="flex items-start space-x-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full ${iconBg} text-white flex items-center justify-center`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1">
                {speakerName}
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">{part}</p>
            </div>
          </div>
        </div>
      );
    }

    if (part.trim()) {
      return (
        <div key={index} className="my-2 text-sm text-gray-600 dark:text-gray-400">
          {part}
        </div>
      );
    }

    return null;
  });
};
// Main render logic
const renderContent = (originalText: string | any[]) => {
  if (Array.isArray(originalText)) {
    if (originalText.length === 0) {
      return <p className="text-gray-500 text-center py-8">No transcript available</p>;
    }
    return renderJsonTranscript(originalText);
  } else {
    return renderTextTranscript(originalText);
  }
};

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({ originalText }) => {

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-base text-gray-700 sm:text-lg">Conversation Transcript</CardTitle>
          </div>
        </div>
        {/* Legend for speakers */}
        {Array.isArray(originalText) && (
          <div className="flex items-center gap-4 mt-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-gray-600 dark:text-gray-400">Doctor</span>
            </div>

            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-600 dark:text-gray-400">Patient</span>
            </div>

          </div>)}
      </CardHeader>
      <CardContent className="p-0 flex-grow overflow-hidden">
        <ScrollArea className="h-full">
          <div className="px-4 py-4 space-y-2">
            {renderContent(originalText)}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default TranscriptPanel;