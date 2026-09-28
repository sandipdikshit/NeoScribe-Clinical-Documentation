"use client";

import React, { useEffect, useState } from "react";
import {
     Search,
     Calendar,
     Star,
     ChevronLeft,
     ChevronRight,
     Clock,
     CheckCircle,
     XCircle,
     HelpCircle,
     Trash2,
     UserPlus,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useRouter } from "next/navigation";
import { getPatients, deletePatient } from "@/services/patientApis";
import {
     Card,
     CardContent,
     CardDescription,
     CardHeader,
     CardTitle,
} from "@/shared/components/ui/card";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Skeleton } from "@/shared/components/ui/skeleton";
import AddPatientDialog from "@/shared/components/patient/AddPatientDialog";
import PatientInfoDialog from "@/shared/components/patient/PatientInfoDialog";
import { useToast } from "@/shared/hooks/use-toast";
import { Patient } from "@/shared/types/patient.type";
import { formatDate } from "@/shared/utils/date.utils";

interface PatientsListProps {
     isMobile: boolean;
     isTablet: boolean;
     setIsSidebarOpen: (isOpen: boolean) => void;
}

const PatientsList: React.FC<PatientsListProps> = ({
     isMobile,
     isTablet,
     setIsSidebarOpen,
}) => {
     const { toast } = useToast();

     const [patients, setPatients] = useState<Patient[]>([]);
     const [filteredPatients, setfilteredPatients] = useState<Patient[]>([]);
     const [searchQuery, setSearchQuery] = useState("");
     const [limit, setLimit] = useState(12);
     const [skip, setSkip] = useState(0);
     const [page, setPage] = useState(1);
     const [isLoading, setIsLoading] = useState(true);
     const [isAddPatientDialogOpen, setIsAddPatientDialogOpen] =
          useState(false);

     // Added state for patient info dialog
     const [isPatientInfoOpen, setIsPatientInfoOpen] = useState(false);
     const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
          null
     );

     // Fetch patients data
     useEffect(() => {
          const fetchData = async () => {
               setIsLoading(true);
               try {
                    const data = await getPatients();
                    // Ensure all patients have valid IDs
                    const validData = data.filter((patient: Patient) => patient.patient_id);
                    setPatients(
                         validData.sort((a: any, b: any) =>
                              a.first_name.localeCompare(b.first_name)
                         )
                    );
                    setfilteredPatients(validData);
                    setIsLoading(false);
               } catch (error) {
                    console.error("Error fetching data:", error);
                    setIsLoading(false);
               }
          };
          fetchData();
     }, [page, limit, skip]);

     // Handle search functionality
     useEffect(() => {
          if (searchQuery.trim() === "") {
               setfilteredPatients(patients);
          } else {
               const query = searchQuery.toLowerCase();
               const filtered = patients.filter(
                    (patient) =>
                         (patient.first_name &&
                              patient.first_name
                                   .toLowerCase()
                                   .includes(query)) ||
                         (patient.last_name &&
                              patient.last_name
                                   .toLowerCase()
                                   .includes(query)) ||
                         (patient.date_of_birth &&
                              patient.date_of_birth
                                   .toLowerCase()
                                   .includes(query))
               );
               setfilteredPatients(filtered);
          }
     }, [searchQuery, patients]);

     const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          setSearchQuery(e.target.value);
     };

     const handleNextPage = () => {
          const newPage = page + 1;
          setPage(newPage);
          setSkip((newPage - 1) * limit);
     };

     const handlePrevPage = () => {
          if (page > 1) {
               const newPage = page - 1;
               setPage(newPage);
               setSkip((newPage - 1) * limit);
          }
     };

     const handleDelete = async (id: string) => {
          try {
               await deletePatient(id);
               const data = await getPatients();
               // Ensure all patients have valid IDs
               const validData = data.filter((patient: Patient) => patient.patient_id);
               setPatients(validData);
               setfilteredPatients(validData);
               toast({
                    description: "Patient deleted successfully",
                    variant: "success",
               });
          } catch (error) {
               console.error("Error deleting patient:", error);
          }
     };

     // Modified to open the patient info dialog
     const handleViewPatient = (id: string) => {
          setSelectedPatientId(id);
          setIsPatientInfoOpen(true);
     };

     // Handle sidebar closing when patient info dialog opens on mobile/tablet
     useEffect(() => {
          if (isPatientInfoOpen && (isMobile || isTablet)) {
               setIsSidebarOpen(false);
          }
     }, [isPatientInfoOpen, isMobile, isTablet, setIsSidebarOpen]);

     const handleAddPatient = async (newPatient: Patient) => {
          try {
               // Fetch the updated list of patients from the API
               const data = await getPatients();
               // Ensure all patients have valid IDs
               const validData = data.filter((patient: Patient) => patient.patient_id);
               const sortedData = validData.sort((a: any, b: any) =>
                    a.first_name.localeCompare(b.first_name)
               );
               setPatients(sortedData);
               setfilteredPatients(sortedData);
          } catch (error) {
               console.error("Error fetching updated patients:", error);
               // Fallback to adding the patient locally if API call fails
               if (newPatient.patient_id) {
                    const updatedPatients = [newPatient, ...patients];
                    setPatients(updatedPatients);
                    setfilteredPatients(updatedPatients);
               }
          }
     };

     // Handle updated patient information
     const handlePatientUpdated = async (updatedPatient: Patient) => {
          try {
               // Fetch the updated list of patients from the API
               const data = await getPatients();
               // Ensure all patients have valid IDs
               const validData = data.filter((patient: Patient) => patient.patient_id);
               const sortedData = validData.sort((a: any, b: any) =>
                    a.first_name.localeCompare(b.first_name)
               );
               setPatients(sortedData);
               setfilteredPatients(sortedData);
          } catch (error) {
               console.error("Error fetching updated patients:", error);
               // Fallback to updating the patient locally if API call fails
               if (updatedPatient.patient_id) {
                    const updatedPatients = patients.map((patient) =>
                         patient.patient_id === updatedPatient.patient_id
                              ? updatedPatient
                              : patient
                    );
                    setPatients(updatedPatients);
                    setfilteredPatients(updatedPatients);
               }
          }
     };



     return (
          <div className="h-full flex-1 p-2 sm:p-4 lg:p-6 overflow-hidden">
               <div className="h-full flex flex-col">
                    <Card className="flex-1 flex flex-col overflow-hidden">
                         <CardHeader className="p-3 sm:p-4 lg:p-6 flex-shrink-0">
                              <div className="flex flex-col justify-between items-start space-y-3 sm:space-y-4">
                                   <CardTitle className="text-xl sm:text-2xl">
                                        Your Patients
                                   </CardTitle>
                                   <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 lg:gap-4 w-full">
                                        <div className="relative flex-grow">
                                             <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                             <Input
                                                  className="pl-8 sm:pl-10 w-full"
                                                  placeholder="Search patients..."
                                                  value={searchQuery}
                                                  onChange={handleSearchChange}
                                             />
                                        </div>
                                        <Button
                                             data-test-id="add-patient-button"
                                             variant="outline"
                                             className="w-full sm:w-auto bg-emerald-200 text-green-700 border-emerald-300 hover:bg-emerald-300 hover:text-green-700 hover:border-emerald-400 text-sm sm:text-base"
                                             onClick={() =>
                                                  setIsAddPatientDialogOpen(
                                                       true
                                                  )
                                             }
                                        >
                                             <UserPlus className="h-4 w-4 mr-1" />
                                             Add Patient
                                        </Button>
                                   </div>
                              </div>
                              <CardDescription className="mt-2 sm:mt-3">
                                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
                                        <div>
                                             {isLoading ? (
                                                  <Skeleton className="h-4 w-40 rounded" />
                                             ) : (
                                                  `You have ${filteredPatients.length} patients in total`
                                             )}
                                        </div>
                                        <div className="flex justify-between items-center text-xs sm:text-sm text-gray-500">
                                             {isLoading ? (
                                                  <Skeleton className="h-4 w-16 rounded" />
                                             ) : (
                                                  <div>
                                                       {filteredPatients.length >
                                                            0
                                                            ? `${skip + 1} - ${skip +
                                                            filteredPatients.length
                                                            }`
                                                            : "0 - 0"}
                                                  </div>
                                             )}
                                        </div>
                                   </div>
                              </CardDescription>
                         </CardHeader>
                         <CardContent className="p-0 flex-1 overflow-hidden">
                              <ScrollArea className="h-full">
                                   <div className="divide-y">
                                        {/* Header row - hidden on mobile */}
                                        <div className="hidden sm:flex items-center p-3 bg-gray-50 text-xs font-medium text-gray-500">
                                             <div className="flex-1 pl-2">
                                                  Patient Name
                                             </div>
                                             <div className="w-32 text-center">
                                                  Date of Birth
                                             </div>
                                             <div className="w-10"></div>{" "}
                                             {/* Action space */}
                                        </div>

                                        {/* Skeleton or Content rows */}
                                        {isLoading ? (
                                             // Render skeleton rows during loading
                                             Array.from({ length: 5 }, (_, index) => (
                                                  <div key={`skeleton-${index}`} className="flex flex-col sm:flex-row items-start sm:items-center p-3 border-b">
                                                       {/* Desktop view */}
                                                       <div className="hidden sm:flex items-center w-full">
                                                            <div className="flex-1 pl-2">
                                                                 <Skeleton className="h-5 w-3/4 rounded" />
                                                            </div>
                                                            <div className="w-24 text-center">
                                                                 <Skeleton className="h-4 w-16 mx-auto rounded" />
                                                            </div>
                                                            <div className="w-10 flex justify-center">
                                                                 <Skeleton className="w-6 h-6 rounded-full" />
                                                            </div>
                                                       </div>

                                                       {/* Mobile view */}
                                                       <div className="flex sm:hidden w-full justify-between items-center">
                                                            <div className="flex-1">
                                                                 <Skeleton className="h-5 w-3/4 rounded mb-1" />
                                                                 <Skeleton className="h-3 w-1/2 rounded" />
                                                            </div>
                                                            <div className="w-10 flex justify-center">
                                                                 <Skeleton className="w-6 h-6 rounded-full" />
                                                            </div>
                                                       </div>
                                                  </div>
                                             ))
                                        ) : filteredPatients.length > 0 ? (
                                             // Render actual patient data
                                             filteredPatients.map((patient, index) => (
                                                  <div
                                                       data-test-id={
                                                            "patient-entry"
                                                       }
                                                       onClick={() =>
                                                            handleViewPatient(
                                                                 String(
                                                                      patient.patient_id
                                                                 )
                                                            )
                                                       }
                                                       key={patient.patient_id || `patient-${index}`}
                                                       className="flex flex-row items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-0"
                                                  >
                                                       {/* Desktop view */}
                                                       <div className="hidden sm:flex items-center w-full">
                                                            <div className="flex-1 pl-2">
                                                                 <span
                                                                      data-test-id="patient-name"
                                                                      className="font-medium text-sm sm:text-base"
                                                                 >
                                                                      {patient.first_name &&
                                                                           patient.first_name}{" "}
                                                                      {patient.last_name &&
                                                                           patient.last_name}
                                                                 </span>
                                                            </div>
                                                            <div className="w-32 text-center text-xs text-gray-500">
                                                                 {formatDate(
                                                                      patient.date_of_birth
                                                                 )}
                                                            </div>
                                                            <div className="w-10 flex justify-center">
                                                                 <button
                                                                      className="p-1 text-gray-400 hover:text-red-600 rounded-full"
                                                                      onClick={(
                                                                           e
                                                                      ) => {
                                                                           e.stopPropagation();
                                                                           handleDelete(
                                                                                patient.patient_id
                                                                           );
                                                                      }}
                                                                 >
                                                                      <Trash2
                                                                           data-test-id="delete-patient-button"
                                                                           className="w-4 h-4"
                                                                      />
                                                                 </button>
                                                            </div>
                                                       </div>

                                                       {/* Mobile view */}
                                                       <div className="sm:hidden flex w-full justify-between items-center">
                                                            <div className="flex-1">
                                                                 <div className="font-medium text-sm">
                                                                      {patient.first_name &&
                                                                           patient.first_name}{" "}
                                                                      {patient.last_name &&
                                                                           patient.last_name}
                                                                 </div>
                                                                 <div className="text-xs text-gray-500 mt-1">
                                                                      {formatDate(
                                                                           patient.date_of_birth
                                                                      )}
                                                                 </div>
                                                            </div>
                                                            <div className="ml-2">
                                                                 <button
                                                                      className="p-1 text-gray-400 hover:text-red-600 rounded-full"
                                                                      onClick={(
                                                                           e
                                                                      ) => {
                                                                           e.stopPropagation();
                                                                           handleDelete(
                                                                                patient.patient_id
                                                                           );
                                                                      }}
                                                                 >
                                                                      <Trash2 className="w-4 h-4" />
                                                                 </button>
                                                            </div>
                                                       </div>
                                                  </div>
                                             ))
                                        ) : (
                                             <div className="p-6 text-center text-gray-500">
                                                  {searchQuery
                                                       ? "No patients match your search"
                                                       : "No patients available"}
                                             </div>
                                        )}
                                   </div>
                              </ScrollArea>
                         </CardContent>
                    </Card>
               </div>

               {/* Add Patient Dialog */}
               <AddPatientDialog
                    open={isAddPatientDialogOpen}
                    setOpen={setIsAddPatientDialogOpen}
                    onPatientAdded={handleAddPatient}
                    parentDialogOpen={false}
                    setParentDialogOpen={() => { }}
               />

               {/* Patient Info Dialog */}
               <PatientInfoDialog
                    open={isPatientInfoOpen}
                    setOpen={setIsPatientInfoOpen}
                    patientId={selectedPatientId}
                    onPatientUpdated={handlePatientUpdated}
               />
          </div>
     );
};

export default PatientsList;
