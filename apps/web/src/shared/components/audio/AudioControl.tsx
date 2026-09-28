"use client";

import React from "react";
import RecordDialog from "./RecordDialog";
import UploadDialog from "./UploadDialog";
import { cn } from "@/shared/lib/utils";

interface AudioControlsProps {
     onUploadComplete?: () => void;
     location?: "navbar" | "sidebar";
     sidebarOpen?: boolean;
}

/**
 * AudioControls is the main container component that includes both
 * the RecordDialog and UploadDialog components for audio input.
 */
const AudioControls: React.FC<AudioControlsProps> = ({
     onUploadComplete,
     location,
     sidebarOpen,
}) => {
     return (
          <div
               className={cn(
                    "flex gap-4",
                    location === "sidebar" ? "flex-col" : "flex-row"
               )}
          >
               <RecordDialog sidebarOpen={sidebarOpen} />
               <UploadDialog
                    onUploadComplete={onUploadComplete}
                    sidebarOpen={sidebarOpen}
               />
          </div>
     );
};

export default AudioControls;
