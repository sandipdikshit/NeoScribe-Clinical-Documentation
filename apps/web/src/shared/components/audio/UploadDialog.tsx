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
import { Upload, FileAudio } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { getPatients } from "@/services/patientApis";
import NoteInfoForm from "@/shared/components/notes/NoteInfoForm";
import AddPatientDialog from "@/shared/components/patient/AddPatientDialog";
import { Patient } from "@/shared/types/patient.type";
import { useViewport } from "@/shared/hooks/useViewport";
import { uploadService } from "@/services/uploadService";
import ProcessingProgress, {
     ProcessingTask,
} from "@/shared/components/ui/ProcessingProgress";
import { Description } from "@radix-ui/react-dialog";

interface UploadDialogProps {
     onUploadComplete?: () => void;
     sidebarOpen?: boolean;
}

interface UploadItem {
     id: string;
     fileName: string;
     progress: number;
     status:
          | "pending"
          | "uploading"
          | "processing"
          | "completed"
          | "failed"
          | "cancelled";
     error?: string;
}

interface FileUploadControlsProps {
     selectedFile: File | null;
     selectedPatient: string;
     selectedTemplate: string;
     onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
     onUpload: () => void;
     formatFileSize: (bytes: number) => string;
}

const FileUploadControls: React.FC<FileUploadControlsProps> = ({
     selectedFile,
     selectedPatient,
     selectedTemplate,
     onFileUpload,
     onUpload,
     formatFileSize,
}) => (
     <div className="space-y-3 sm:space-y-4">
          <div className="relative">
               <input
                    type="file"
                    accept="audio/*"
                    onChange={onFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    id="audio-file-input"
                    data-test-id="audio-file-input"
               />
               <label
                    htmlFor="audio-file-input"
                    className="block w-full cursor-pointer"
               >
                    <div className="flex flex-col items-center justify-center w-full h-24 sm:h-32 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
                         {selectedFile ? (
                              <div className="flex flex-col items-center text-center px-4">
                                   <FileAudio className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 mb-2" />
                                   <p className="text-xs sm:text-sm font-medium text-gray-700 truncate max-w-full">
                                        {selectedFile.name}
                                   </p>
                                   <p className="text-xs text-gray-500 mt-1">
                                        {formatFileSize(selectedFile.size)}
                                   </p>
                              </div>
                         ) : (
                              <div className="flex flex-col items-center">
                                   <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 mb-2" />
                                   <p className="text-xs sm:text-sm font-medium text-gray-700">
                                        Tap to choose audio file
                                   </p>
                                   <p className="text-xs text-gray-500 mt-1">
                                        MP3, WAV, M4A up to 500MB
                                   </p>
                              </div>
                         )}
                    </div>
               </label>
          </div>

          <Button
               onClick={onUpload}
               disabled={!selectedFile || !selectedPatient || !selectedTemplate}
               variant="default"
               className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center justify-center py-2 sm:py-2.5"
               data-test-id="upload-process-button"
          >
               <Upload className="w-4 h-4 mr-2" />
               Add to Upload Queue
          </Button>

          {(!selectedFile || !selectedPatient || !selectedTemplate) && (
               <div className="space-y-1">
                    {!selectedFile && (
                         <p className="text-xs text-center text-amber-500">
                              Please select an audio file
                         </p>
                    )}
                    {!selectedPatient && selectedFile && (
                         <p className="text-xs text-center text-amber-500">
                              Please select a patient
                         </p>
                    )}
                    {!selectedTemplate && selectedFile && selectedPatient && (
                         <p className="text-xs text-center text-amber-500">
                              Please select a template
                         </p>
                    )}
               </div>
          )}
     </div>
);

const UploadDialog: React.FC<UploadDialogProps> = ({
     onUploadComplete,
     sidebarOpen,
}) => {
     const { isMobile } = useViewport();
     const [open, setOpen] = useState(false);
     const [selectedFile, setSelectedFile] = useState<File | null>(null);
     const [uploads, setUploads] = useState<UploadItem[]>([]);
     const [processingTasks, setProcessingTasks] = useState<ProcessingTask[]>(
          []
     );
     const [showProcessingProgress, setShowProcessingProgress] =
          useState(false);

     // Form state
     const [chiefComplaint, setChiefComplaint] = useState("");
     const [selectedPatient, setSelectedPatient] = useState("");
     const [visitDate, setVisitDate] = useState<Date | undefined>(new Date());
     const [selectedTemplate, setSelectedTemplate] = useState("");
     const [noteType, setNoteType] = useState("");
     const [patients, setPatients] = useState<Patient[]>([]);
     const [isLoadingPatients, setIsLoadingPatients] = useState(false);

     // Add patient state
     const [addPatientOpen, setAddPatientOpen] = useState(false);

     const { toast } = useToast();

     // Upload event handlers
     const handleUploadProgress = (task: any) => {
          setUploads((prev) =>
               prev.map((u) =>
                    u.id === task.id
                         ? {
                                ...u,
                                progress: task.progress,
                                status: task.status,
                           }
                         : u
               )
          );

          setProcessingTasks((prev) =>
               prev.map((t) =>
                    t.id === task.id
                         ? {
                                ...t,
                                progress: task.progress,
                                status: task.status,
                           }
                         : t
               )
          );
     };

     const handleUploadCompleted = (task: any) => {
          setUploads((prev) =>
               prev.map((u) =>
                    u.id === task.id
                         ? { ...u, progress: 100, status: "completed" }
                         : u
               )
          );

          setProcessingTasks((prev) =>
               prev.map((t) =>
                    t.id === task.id
                         ? { ...t, progress: 100, status: "completed" }
                         : t
               )
          );
          toast({
               description: `${task.file.name} uploaded successfully`,
               variant: "success",
          });
     };

     const handleUploadFailed = (task: any) => {
          setUploads((prev) =>
               prev.map((u) =>
                    u.id === task.id
                         ? { ...u, status: "failed", error: task.error }
                         : u
               )
          );

          setProcessingTasks((prev) =>
               prev.map((t) =>
                    t.id === task.id
                         ? { ...t, status: "failed", error: task.error }
                         : t
               )
          );

          toast({
               title: "Upload Failed",
               description: `Failed to upload ${task.file.name}: ${task.error}`,
               variant: "destructive",
          });
     };

     const handleUploadCancelled = (task: any) => {
          setUploads((prev) =>
               prev.map((u) =>
                    u.id === task.id ? { ...u, status: "cancelled" } : u
               )
          );
          toast({
               title: "Upload Cancelled",
               description: `Cancelled to upload ${task.file.name}: ${task.error}`,
               variant: "block",
          });
     };

     const handleUploadProcessing = (task: any) => {
          setUploads((prev) =>
               prev.map((u) =>
                    u.id === task.id ? { ...u, status: "processing" } : u
               )
          );

          setProcessingTasks((prev) =>
               prev.map((t) =>
                    t.id === task.id ? { ...t, status: "processing" } : t
               )
          );
     };

     // Subscribe to upload events
     useEffect(() => {
          uploadService.on("upload-progress", handleUploadProgress);
          uploadService.on("upload-completed", handleUploadCompleted);
          uploadService.on("upload-failed", handleUploadFailed);
          uploadService.on("upload-processing", handleUploadProcessing);
          uploadService.on("upload-cancelled", handleUploadCancelled);

          return () => {
               uploadService.off("upload-progress", handleUploadProgress);
               uploadService.off("upload-completed", handleUploadCompleted);
               uploadService.off("upload-failed", handleUploadFailed);
               uploadService.off("upload-processing", handleUploadProcessing);
               uploadService.off("upload-cancelled", handleUploadCancelled);
          };
     }, [onUploadComplete, toast]);

     // Show processing progress when there are active uploads
     useEffect(() => {
          const hasActiveUploads = uploads.some(
               (u) =>
                    u.status === "pending" ||
                    u.status === "uploading" ||
                    u.status === "processing"
          );
          if (hasActiveUploads && !showProcessingProgress) {
               setShowProcessingProgress(true);
          }

          // Auto-close processing progress when all tasks are completed
          const allCompleted = uploads.every(
               (u) =>
                    u.status === "completed" ||
                    u.status === "failed" ||
                    u.status === "cancelled"
          );
          if (allCompleted && showProcessingProgress && uploads.length > 0) {
               setTimeout(() => {
                    setShowProcessingProgress(false);
                    setProcessingTasks([]);
               }, 2000);
          }
     }, [uploads, showProcessingProgress]);

     // Fetch patients when dialog opens
     useEffect(() => {
          if (open) {
               fetchPatients();
          }
     }, [open]);

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
                    title: "Error",
                    description: "Failed to load patients",
                    variant: "destructive",
               });
          } finally {
               setIsLoadingPatients(false);
          }
     };

     const handleAddPatient = () => {
          setOpen(false);
          setAddPatientOpen(true);
     };

     const handlePatientAdded = (newPatient: Patient) => {
          setPatients((prev) => [...prev, newPatient]);
          setSelectedPatient(newPatient.patient_id);
     };

     const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0];
          if (file) {
               // Validate file size (500MB limit)
               if (file.size > 500 * 1024 * 1024) {
                    toast({
                         title: "File too large",
                         description: "Please select a file smaller than 500MB",
                         variant: "destructive",
                    });
                    return;
               }
               setSelectedFile(file);
          }
     };

     const validateForm = () => {
          if (!selectedFile) {
               toast({
                    title: "Error",
                    description: "Please select a file to upload",
                    variant: "destructive",
               });
               return false;
          }

          if (!selectedPatient) {
               toast({
                    title: "Error",
                    description: "Please select a patient",
                    variant: "destructive",
               });
               return false;
          }

          if (!visitDate) {
               toast({
                    title: "Error",
                    description: "Please select a visit date",
                    variant: "destructive",
               });
               return false;
          }

          if (!selectedTemplate) {
               toast({
                    title: "Error",
                    description: "Please select a template",
                    variant: "destructive",
               });
               return false;
          }

          return true;
     };

     const setupUpload = () => {
          const formattedDate = visitDate
               ? visitDate.toISOString()
               : new Date().toISOString();

          // Add upload to service (non-blocking)
          const uploadId = uploadService.addUpload(
               selectedFile!,
               chiefComplaint,
               selectedPatient,
               formattedDate,
               noteType,
               selectedTemplate
          );

          // Add to local state for UI
          setUploads((prev) => [
               ...prev,
               {
                    id: uploadId,
                    fileName: selectedFile!.name,
                    progress: 0,
                    status: "pending",
               },
          ]);

          // Add to processing tasks
          setProcessingTasks((prev) => [
               ...prev,
               {
                    id: uploadId,
                    title: selectedFile!.name,
                    progress: 0,
                    status: "pending",
                    description: "Uploading audio file...",
               },
          ]);

          return uploadId;
     };

     const showUploadSuccess = (uploadId: string) => {
          // Close dialog and show toast
          setOpen(false);
          toast({
               description: `${selectedFile!.name} added to upload queue`,
               variant: "success",
               duration: 500,
          });

          // Reset form
          handleOpenChange(false);
     };

     const handleUploadError = (error: any) => {
          console.error("Error adding upload:", error);
          toast({
               title: "Error",
               description: "Failed to start upload",
               variant: "destructive",
          });
     };

     const handleUpload = async () => {
          if (!validateForm()) {
               return;
          }

          try {
               const uploadId = setupUpload();
               showUploadSuccess(uploadId);
          } catch (error) {
               handleUploadError(error);
          }
     };

     const handleCancelUpload = (uploadId: string) => {
          uploadService.cancelUpload(uploadId);
          setUploads((prev) => prev.filter((u) => u.id !== uploadId));
          setProcessingTasks((prev) => prev.filter((t) => t.id !== uploadId));
     };

     const handleCancelProcessingTask = (taskId: string) => {
          handleCancelUpload(taskId);
     };

     const handleCloseProcessingProgress = () => {
          setShowProcessingProgress(false);
          setProcessingTasks([]);
     };

     const handleOpenChange = (newOpen: boolean) => {
          setOpen(newOpen);
          if (!newOpen) {
               // Reset form data
               setSelectedFile(null);
               setChiefComplaint("");
               setSelectedPatient("");
               setVisitDate(new Date());
               setSelectedTemplate("");
               setNoteType("");
          }
     };

     // Format file size
     const formatFileSize = (bytes: number) => {
          if (bytes === 0) return "0 Bytes";
          const k = 1024;
          const sizes = ["Bytes", "KB", "MB", "GB"];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return (
               parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
          );
     };

     return (
          <>
               <Dialog open={open} onOpenChange={handleOpenChange}>
                    <DialogTrigger asChild>
                         <Button
                              data-test-id="upload-audio-button"
                              variant="outline"
                              className={`text-sm sm:text-base gap-0 justify-center`}
                         >
                              <Upload
                                   className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                                        sidebarOpen ? "mr-2" : ""
                                   }`}
                              />
                              {sidebarOpen ? <span>Upload</span> : null}
                         </Button>
                    </DialogTrigger>
                    <DialogContent
                         className={`
            ${
                 isMobile
                      ? "fixed inset-x-0 bottom-0 top-auto !translate-x-0 !translate-y-0 rounded-t-lg rounded-b-none max-h-[90vh] overflow-y-auto"
                      : "sm:max-w-[600px] w-[95%] md:w-[600px] top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%] max-h-[90vh] overflow-y-auto"
            }
            p-4 sm:p-6
          `}
                    >
                         <Description className="text-sm text-gray-300">
                              This dialog allows you to upload audio files.
                         </Description>
                         <DialogHeader className="mb-3 sm:mb-4">
                              <DialogTitle className="text-lg sm:text-xl">
                                   Upload Audio
                              </DialogTitle>
                         </DialogHeader>

                         <div className="max-h-[calc(90vh-120px)] overflow-y-auto">
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

                              <div className="py-3 sm:py-4">
                                   <FileUploadControls
                                        selectedFile={selectedFile}
                                        selectedPatient={selectedPatient}
                                        selectedTemplate={selectedTemplate}
                                        onFileUpload={handleFileUpload}
                                        onUpload={handleUpload}
                                        formatFileSize={formatFileSize}
                                   />
                              </div>
                         </div>
                    </DialogContent>
               </Dialog>

               <AddPatientDialog
                    open={addPatientOpen}
                    setOpen={setAddPatientOpen}
                    onPatientAdded={handlePatientAdded}
                    parentDialogOpen={true}
                    setParentDialogOpen={setOpen}
               />

               <ProcessingProgress
                    tasks={processingTasks}
                    isVisible={showProcessingProgress}
                    onClose={handleCloseProcessingProgress}
                    onCancelTask={handleCancelProcessingTask}
                    title="Upload Processing"
               />
          </>
     );
};

export default UploadDialog;
