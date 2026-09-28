"use client";

import React, { useState, useEffect } from "react";
import {
     Dialog,
     DialogContent,
     DialogDescription,
     DialogHeader,
     DialogTitle,
     DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Calendar, User, Clock, CheckCircle, Edit, X } from "lucide-react";
import { updatePatient, getPatient } from "@/services/patientApis";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Patient } from "@/shared/types/patient.type";
import { formatDate } from "@/shared/utils/date.utils";

interface PatientInfoDialogProps {
     open: boolean;
     setOpen: (open: boolean) => void;
     patientId: string | null;
     onPatientUpdated: (updatedPatient: Patient) => void;
}

const PatientInfoDialog: React.FC<PatientInfoDialogProps> = ({
     open,
     setOpen,
     patientId,
     onPatientUpdated,
}) => {
     const [patient, setPatient] = useState<Patient | null>(null);
     const [isLoading, setIsLoading] = useState(false);
     const [error, setError] = useState<string | null>(null);
     const [isEditMode, setIsEditMode] = useState(false);

     // Form fields
     const [firstName, setFirstName] = useState("");
     const [lastName, setLastName] = useState("");
     const [dateOfBirth, setDateOfBirth] = useState("");

     // Success notification
     const [showSuccess, setShowSuccess] = useState(false);

     useEffect(() => {
          if (open && patientId) {
               fetchPatientData(patientId);
          } else {
               // Reset state when dialog is closed
               setIsEditMode(false);
               setShowSuccess(false);
               setError(null);
          }
     }, [open, patientId]);

     const fetchPatientData = async (id: string) => {
          setIsLoading(true);
          setError(null);

          try {
               // Replace with your actual API call
               const data = await getPatient(id);
               setPatient(data);

               // Initialize form fields
               setFirstName(data.first_name || "");
               setLastName(data.last_name || "");
               setDateOfBirth(data.date_of_birth || "");

               setIsLoading(false);
          } catch (error) {
               console.error("Error fetching patient data:", error);
               setError("Failed to load patient information.");
               setIsLoading(false);
          }
     };

     const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          setIsLoading(true);
          setError(null);

          try {
               if (!patient) throw new Error("No patient data available");

               const updatedPatientData = {
                    ...patient,
                    first_name: firstName,
                    last_name: lastName,
                    date_of_birth: dateOfBirth,
                    gender: patient.gender, // Ensure gender is included
               };

               // Call API to update patient
               const result = await updatePatient(
                    updatedPatientData,
                    patient.patient_id
               );

               // Update local state
               setPatient(result);
               onPatientUpdated(result);

               // Show success message
               setShowSuccess(true);
               setTimeout(() => setShowSuccess(false), 3000);

               // Exit edit mode
               setIsEditMode(false);
               setIsLoading(false);
          } catch (error) {
               console.error("Error updating patient:", error);
               setError("Failed to update patient information.");
               setIsLoading(false);
          }
     };

     return (
          <Dialog open={open} onOpenChange={setOpen}>
               <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl">
                    {isLoading ? (
                         <>
                              {/* Hidden title for accessibility */}
                              <VisuallyHidden.Root>
                                   <DialogTitle>
                                        Loading Patient Information
                                   </DialogTitle>
                              </VisuallyHidden.Root>
                              <div className="flex justify-center items-center py-8">
                                   <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                              </div>
                         </>
                    ) : error ? (
                         <>
                              <DialogHeader>
                                   <DialogTitle>Error</DialogTitle>
                                   <DialogDescription>
                                        An error occurred while loading patient
                                        information
                                   </DialogDescription>
                              </DialogHeader>
                              <div className="text-red-500 p-4 text-center">
                                   <div className="flex justify-center mb-2">
                                        <X className="h-8 w-8" />
                                   </div>
                                   {error}
                                   <Button
                                        className="mt-4 w-full"
                                        onClick={() => setOpen(false)}
                                   >
                                        Close
                                   </Button>
                              </div>
                         </>
                    ) : patient ? (
                         <>
                              <DialogHeader>
                                   <div className="flex justify-between items-center">
                                        <DialogTitle className="text-xl">
                                             {isEditMode
                                                  ? "Edit Patient Information"
                                                  : "Patient Information"}
                                        </DialogTitle>
                                   </div>
                                   <DialogDescription>
                                        {isEditMode
                                             ? "Update the patient details below."
                                             : `View details for ${patient.first_name} ${patient.last_name}`}
                                   </DialogDescription>
                              </DialogHeader>

                              {showSuccess && (
                                   <div className="bg-green-50 text-green-700 p-3 rounded-md flex items-center mb-4">
                                        <CheckCircle className="h-5 w-5 mr-2" />
                                        Patient information updated successfully
                                   </div>
                              )}

                              {isEditMode ? (
                                   <form onSubmit={handleSubmit}>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                                             <div className="space-y-2">
                                                  <Label htmlFor="firstName">
                                                       First Name
                                                  </Label>
                                                  <Input
                                                       data-test-id="first-name-input"
                                                       id="firstName"
                                                       value={firstName}
                                                       onChange={(e) =>
                                                            setFirstName(
                                                                 e.target.value
                                                            )
                                                       }
                                                       required
                                                  />
                                             </div>

                                             <div className="space-y-2">
                                                  <Label htmlFor="lastName">
                                                       Last Name
                                                  </Label>
                                                  <Input
                                                       data-test-id="last-name-input"
                                                       id="lastName"
                                                       value={lastName}
                                                       onChange={(e) =>
                                                            setLastName(
                                                                 e.target.value
                                                            )
                                                       }
                                                       required
                                                  />
                                             </div>

                                             <div className="space-y-2">
                                                  <Label htmlFor="dateOfBirth">
                                                       Date of Birth
                                                  </Label>
                                                  <Input
                                                       id="dateOfBirth"
                                                       type="date"
                                                       value={dateOfBirth}
                                                       onChange={(e) =>
                                                            setDateOfBirth(
                                                                 e.target.value
                                                            )
                                                       }
                                                       required
                                                  />
                                             </div>
                                        </div>

                                        <DialogFooter className="mt-6">
                                             <Button
                                                  type="button"
                                                  variant="outline"
                                                  onClick={() =>
                                                       setIsEditMode(false)
                                                  }
                                             >
                                                  Cancel
                                             </Button>
                                             <Button
                                                  data-test-id="update-patient-button"
                                                  type="submit"
                                                  disabled={isLoading}
                                                  className="bg-blue-400 hover:bg-blue-700"
                                             >
                                                  {isLoading
                                                       ? "Saving..."
                                                       : "Save Changes"}
                                             </Button>
                                        </DialogFooter>
                                   </form>
                              ) : (
                                   <div className="py-4">
                                        <div className="space-y-6">
                                             <div className="flex flex-col gap-4">
                                                  <div className="flex items-center gap-3">
                                                       <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                            <User className="h-6 w-6 text-blue-600" />
                                                       </div>
                                                       <div>
                                                            <h3 className="font-medium text-lg">
                                                                 {
                                                                      patient.first_name
                                                                 }{" "}
                                                                 {
                                                                      patient.last_name
                                                                 }
                                                            </h3>
                                                            <p className="text-gray-500 text-sm">
                                                                 Patient ID:{" "}
                                                                 {
                                                                      patient.patient_id
                                                                 }
                                                            </p>
                                                       </div>
                                                  </div>
                                             </div>

                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                                                       <Calendar className="h-4 w-4 text-gray-600" />
                                                       <div>
                                                            <p className="text-gray-500">
                                                                 Date of Birth
                                                            </p>
                                                            <p className="font-medium">
                                                                 {formatDate(
                                                                      patient.date_of_birth
                                                                 )}
                                                            </p>
                                                       </div>
                                                  </div>

                                                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                                                       <Clock className="h-4 w-4 text-gray-600" />
                                                       <div>
                                                            <p className="text-gray-500">
                                                                 Patient Since
                                                            </p>
                                                            <p className="font-medium">
                                                                 {formatDate(
                                                                      patient.created_at
                                                                 )}
                                                            </p>
                                                       </div>
                                                  </div>
                                             </div>
                                        </div>

                                        <div className="mt-8 flex justify-end align-items-center gap-4">
                                             {!isEditMode && (
                                                  <Button
                                                       data-test-id="edit-patient-button"
                                                       variant="outline"
                                                       size="sm"
                                                       onClick={() =>
                                                            setIsEditMode(true)
                                                       }
                                                       className="flex items-center gap-1"
                                                  >
                                                       <Edit className="h-4 w-4" />
                                                       Edit
                                                  </Button>
                                             )}
                                             <Button
                                                  size={"sm"}
                                                  onClick={() => {
                                                       setOpen(false);
                                                       // If you want to navigate to the patient page after viewing
                                                       // router.push(`/patients/${patient.patient_id}`);
                                                  }}
                                                  className="bg-blue-400 hover:bg-blue-700"
                                             >
                                                  Close
                                             </Button>
                                        </div>
                                   </div>
                              )}
                         </>
                    ) : (
                         <>
                              <DialogHeader>
                                   <DialogTitle>
                                        Patient Information
                                   </DialogTitle>
                                   <DialogDescription>
                                        No patient information available
                                   </DialogDescription>
                              </DialogHeader>
                              <div className="text-center p-6">
                                   No patient information available
                              </div>
                         </>
                    )}
               </DialogContent>
          </Dialog>
     );
};

export default PatientInfoDialog;
