// components/notes/note.jsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Section, NoteSections, SoapData } from "@/shared/types/note.type";

const SoapNotePanel = ({ soapData }: { soapData: SoapData }) => {
  if (!soapData || !soapData.sections || soapData.sections.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Note Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-64 text-gray-500">
            No sections available for this note.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort sections by sequence_number
  const sortedSections = [...soapData.sections].sort((a, b) => a.sequence_number - b.sequence_number);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl">Note</CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-4 py-1 pl-3">
          {sortedSections.map((section) => (
            <div key={section.section_id} className="border-b pb-3 last:border-b-0 last:pb-0">
              <h3 className="font-semibold text-md text-blue-800 mb-1">{section.section_name}</h3>
              <div className="prose max-w-none text-gray-700 text-sm">
                <p>{section.content || "No content available"}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default SoapNotePanel;