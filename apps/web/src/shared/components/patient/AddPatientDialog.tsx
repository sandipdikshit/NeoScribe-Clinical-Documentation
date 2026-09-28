"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
     Dialog,
     DialogContent,
     DialogHeader,
     DialogTitle,
     DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Loader2, Calendar, User, Users } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import {
     Select,
     SelectContent,
     SelectItem,
     SelectTrigger,
     SelectValue,
} from "@/shared/components/ui/select";
import { createPatient } from "@/services/patientApis";
import { Patient } from "@/shared/types/patient.type";

interface AddPatientDialogProps {
     onPatientAdded: (newPatient: Patient) => void;
     open: boolean;
     setOpen: (open: boolean) => void;
     parentDialogOpen: boolean;
     setParentDialogOpen: (open: boolean) => void;
}

const AddPatientDialog: React.FC<AddPatientDialogProps> = ({
     onPatientAdded,
     open,
     setOpen,
     parentDialogOpen,
     setParentDialogOpen,
}) => {
     const [formData, setFormData] = useState({
          firstName: "",
          lastName: "",
          day: "",
          month: "",
          year: "",
          gender: "",
     });

     const [touched, setTouched] = useState({
          firstName: false,
          lastName: false,
          day: false,
          month: false,
          year: false,
          gender: false,
     });

     const { toast } = useToast();

     const [isSubmitting, setIsSubmitting] = useState(false);

     // Generate static arrays for select options
     const currentYear = new Date().getFullYear();

     const months = useMemo(
          () => [
               { value: "0", label: "January" },
               { value: "1", label: "February" },
               { value: "2", label: "March" },
               { value: "3", label: "April" },
               { value: "4", label: "May" },
               { value: "5", label: "June" },
               { value: "6", label: "July" },
               { value: "7", label: "August" },
               { value: "8", label: "September" },
               { value: "9", label: "October" },
               { value: "10", label: "November" },
               { value: "11", label: "December" },
          ],
          []
     );

     const years = useMemo(
          () => Array.from({ length: 120 }, (_, i) => String(currentYear - i)),
          [currentYear]
     );

     // Memoized days calculation based on month and year
     const availableDays = useMemo(() => {
          const { month, year } = formData;

          if (!month || !year) {
               return Array.from({ length: 31 }, (_, i) => String(i + 1));
          }

          const monthNum = parseInt(month);
          const yearNum = parseInt(year);

          // February
          if (monthNum === 1) {
               const isLeapYear =
                    (yearNum % 4 === 0 && yearNum % 100 !== 0) ||
                    yearNum % 400 === 0;
               return Array.from({ length: isLeapYear ? 29 : 28 }, (_, i) =>
                    String(i + 1)
               );
          }

          // April, June, September, November
          if ([3, 5, 8, 10].includes(monthNum)) {
               return Array.from({ length: 30 }, (_, i) => String(i + 1));
          }

          // Other months
          return Array.from({ length: 31 }, (_, i) => String(i + 1));
     }, [formData.month, formData.year]);

     // Reset day if it becomes invalid with new month/year selection
     useEffect(() => {
          if (formData.day && parseInt(formData.day) > availableDays.length) {
               setFormData((prev) => ({ ...prev, day: "" }));
          }
     }, [availableDays, formData.day]);

     // Validation logic
     const errors = useMemo(() => {
          const newErrors = {
               firstName: "",
               lastName: "",
               dateOfBirth: "",
               gender: "",
          };

          // Only validate fields that have been touched
          if (touched.firstName && !formData.firstName.trim()) {
               newErrors.firstName = "First name is required";
          }

          if (touched.lastName && !formData.lastName.trim()) {
               newErrors.lastName = "Last name is required";
          }

          if (
               (touched.day || touched.month || touched.year) &&
               (!formData.day || !formData.month || !formData.year)
          ) {
               newErrors.dateOfBirth = "Complete date of birth is required";
          } else if (formData.day && formData.month && formData.year) {
               const yearNum = parseInt(formData.year);
               const monthNum = parseInt(formData.month);
               const dayNum = parseInt(formData.day);

               // Create date object to check validity
               const dateObj = new Date(yearNum, monthNum, dayNum);

               if (
                    dateObj.getFullYear() !== yearNum ||
                    dateObj.getMonth() !== monthNum ||
                    dateObj.getDate() !== dayNum
               ) {
                    newErrors.dateOfBirth = "Invalid date";
               } else {
                    // Check if date is in the future
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (dateObj > today) {
                         newErrors.dateOfBirth =
                              "Date of birth cannot be in the future";
                    }
               }
          }

          if (touched.gender && !formData.gender) {
               newErrors.gender = "Gender is required";
          }

          return newErrors;
     }, [formData, touched]);

     // Form is valid when all required fields have values and there are no errors
     const isFormValid = useMemo(() => {
          return (
               formData.firstName.trim() !== "" &&
               formData.lastName.trim() !== "" &&
               formData.day !== "" &&
               formData.month !== "" &&
               formData.year !== "" &&
               formData.gender !== "" &&
               Object.values(errors).every((error) => error === "")
          );
     }, [formData, errors]);

     const resetForm = () => {
          setFormData({
               firstName: "",
               lastName: "",
               day: "",
               month: "",
               year: "",
               gender: "",
          });

          setTouched({
               firstName: false,
               lastName: false,
               day: false,
               month: false,
               year: false,
               gender: false,
          });
     };

     const handleInputChange = (field: string, value: string) => {
          setFormData((prev) => ({ ...prev, [field]: value }));
          setTouched((prev) => ({ ...prev, [field]: true }));
     };

     const handleSubmit = async () => {
          if (!isFormValid) return;

          const yearNum = parseInt(formData.year);
          const monthNum = parseInt(formData.month);
          const dayNum = parseInt(formData.day);

          try {
               setIsSubmitting(true);

               // Format date as YYYY-MM-DD
               const dateObj = new Date(yearNum, monthNum, dayNum);
               const formattedDate = dateObj.toISOString().split("T")[0];

               const response = await createPatient({
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    date_of_birth: formattedDate,
                    gender: formData.gender,
               });

               if (!response) {
                    throw new Error("Failed to create patient");
               }

               toast({
                    title: "Patient Created",
                    description: `${formData.firstName} ${formData.lastName} has been added successfully.`,
                    variant: "success",
               });
               resetForm();
               setOpen(false);

               // Reopen parent dialog with slight delay
               setTimeout(() => {
                    if (!parentDialogOpen) {
                         setParentDialogOpen(true);
                    }
                    onPatientAdded(response);
               }, 100);
          } catch (error) {
               console.error("Error creating patient:", error);
               toast({
                    title: "Error",
                    description:
                         "There was an error creating the patient. Please try again.",
                    variant: "destructive",
               });
          } finally {
               setIsSubmitting(false);
          }
     };

     const handleCancel = () => {
          setOpen(false);
          // Reopen parent dialog if needed
          setTimeout(() => {
               if (parentDialogOpen) {
                    setParentDialogOpen(true);
               }
          }, 100);
     };

     return (
          <Dialog
               open={open}
               onOpenChange={(newState) => {
                    if (!newState && isSubmitting) return; // Prevent closing while submitting

                    setOpen(newState);
                    if (!newState && parentDialogOpen) {
                         setTimeout(() => setParentDialogOpen(true), 100);
                    }

                    if (!newState) {
                         resetForm();
                    }
               }}
               modal={true}
          >
               <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 shadow-lg border-slate-200 dark:border-slate-700">
                    <DialogHeader>
                         <DialogTitle className="text-xl font-semibold flex items-center">
                              <User className="mr-2 h-5 w-5 text-blue-600" />
                              Add New Patient
                         </DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-5 py-4">
                         {/* Personal Information Section */}
                         <div className="space-y-1 mb-1">
                              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center">
                                   <Users className="mr-1 h-4 w-4 text-blue-500" />
                                   Personal Information
                              </h3>
                              <div className="h-px bg-slate-200 dark:bg-slate-700"></div>
                         </div>

                         {/* Name Fields */}
                         <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                   <Label
                                        htmlFor="first-name"
                                        className="font-medium"
                                   >
                                        First Name
                                   </Label>
                                   <Input
                                        data-test-id="first-name-input"
                                        id="first-name"
                                        value={formData.firstName}
                                        onChange={(e) =>
                                             handleInputChange(
                                                  "firstName",
                                                  e.target.value
                                             )
                                        }
                                        onBlur={() =>
                                             setTouched((prev) => ({
                                                  ...prev,
                                                  firstName: true,
                                             }))
                                        }
                                        placeholder="Enter first name"
                                        className={`border ${
                                             errors.firstName
                                                  ? "border-red-400 focus:ring-red-400"
                                                  : "border-slate-300 dark:border-slate-600"
                                        }`}
                                        required
                                   />
                                   {errors.firstName && (
                                        <p className="text-red-500 text-sm mt-1">
                                             {errors.firstName}
                                        </p>
                                   )}
                              </div>
                              <div className="space-y-2">
                                   <Label
                                        htmlFor="last-name"
                                        className="font-medium"
                                   >
                                        Last Name
                                   </Label>
                                   <Input
                                        id="last-name"
                                        data-test-id="last-name-input"
                                        value={formData.lastName}
                                        onChange={(e) =>
                                             handleInputChange(
                                                  "lastName",
                                                  e.target.value
                                             )
                                        }
                                        onBlur={() =>
                                             setTouched((prev) => ({
                                                  ...prev,
                                                  lastName: true,
                                             }))
                                        }
                                        placeholder="Enter last name"
                                        className={`border ${
                                             errors.lastName
                                                  ? "border-red-400 focus:ring-red-400"
                                                  : "border-slate-300 dark:border-slate-600"
                                        }`}
                                        required
                                   />
                                   {errors.lastName && (
                                        <p className="text-red-500 text-sm mt-1">
                                             {errors.lastName}
                                        </p>
                                   )}
                              </div>
                         </div>

                         {/* Date of Birth Section */}
                         <div className="space-y-1 mb-1 mt-2">
                              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center">
                                   <Calendar className="mr-1 h-4 w-4 text-blue-500" />
                                   Date of Birth
                              </h3>
                              <div className="h-px bg-slate-200 dark:bg-slate-700"></div>
                         </div>

                         <div className="space-y-2">
                              <div className="grid grid-cols-3 gap-3">
                                   {/* Year Dropdown */}
                                   <div>
                                        <Label
                                             htmlFor="year"
                                             className="text-sm mb-1 block"
                                        >
                                             Year
                                        </Label>
                                        <Select
                                             value={formData.year}
                                             onValueChange={(value) =>
                                                  handleInputChange(
                                                       "year",
                                                       value
                                                  )
                                             }
                                             onOpenChange={(open) => {
                                                  // Prevent body scroll on mobile when dropdown is open
                                                  if (
                                                       open &&
                                                       window.innerWidth < 768
                                                  ) {
                                                       document.body.classList.add(
                                                            "prevent-body-scroll"
                                                       );
                                                  } else {
                                                       document.body.classList.remove(
                                                            "prevent-body-scroll"
                                                       );
                                                  }
                                             }}
                                        >
                                             <SelectTrigger
                                                  data-test-id="year-select"
                                                  id="year"
                                                  className={`border ${
                                                       touched.year &&
                                                       !formData.year
                                                            ? "border-red-400"
                                                            : "border-slate-300 dark:border-slate-600"
                                                  }`}
                                             >
                                                  <SelectValue placeholder="Year" />
                                             </SelectTrigger>
                                             <SelectContent
                                                  className="max-h-60 mobile-scrollable"
                                                  onWheel={(e) =>
                                                       e.stopPropagation()
                                                  }
                                                  // Add touch event handlers for better mobile support
                                                  onTouchStart={(e) =>
                                                       e.stopPropagation()
                                                  }
                                                  onTouchMove={(e) =>
                                                       e.stopPropagation()
                                                  }
                                             >
                                                  {years.map((y) => (
                                                       <SelectItem
                                                            data-test-id={`year-${y}`}
                                                            key={y}
                                                            value={y}
                                                       >
                                                            {y}
                                                       </SelectItem>
                                                  ))}
                                             </SelectContent>
                                        </Select>
                                   </div>

                                   {/* Month Dropdown */}
                                   <div>
                                        <Label
                                             htmlFor="month"
                                             className="text-sm mb-1 block"
                                        >
                                             Month
                                        </Label>
                                        <Select
                                             value={formData.month}
                                             onValueChange={(value) =>
                                                  handleInputChange(
                                                       "month",
                                                       value
                                                  )
                                             }
                                             onOpenChange={(open) => {
                                                  if (
                                                       open &&
                                                       window.innerWidth < 768
                                                  ) {
                                                       document.body.classList.add(
                                                            "prevent-body-scroll"
                                                       );
                                                  } else {
                                                       document.body.classList.remove(
                                                            "prevent-body-scroll"
                                                       );
                                                  }
                                             }}
                                        >
                                             <SelectTrigger
                                                  id="month"
                                                  data-test-id="month-select"
                                                  className={`border ${
                                                       touched.month &&
                                                       !formData.month
                                                            ? "border-red-400"
                                                            : "border-slate-300 dark:border-slate-600"
                                                  }`}
                                             >
                                                  <SelectValue placeholder="Month" />
                                             </SelectTrigger>
                                             <SelectContent
                                                  className="max-h-60 mobile-scrollable"
                                                  onWheel={(e) =>
                                                       e.stopPropagation()
                                                  }
                                                  onTouchStart={(e) =>
                                                       e.stopPropagation()
                                                  }
                                                  onTouchMove={(e) =>
                                                       e.stopPropagation()
                                                  }
                                             >
                                                  {months.map((m) => (
                                                       <SelectItem
                                                            data-test-id={`month-${m.value}`}
                                                            key={m.value}
                                                            value={m.value}
                                                       >
                                                            {m.label}
                                                       </SelectItem>
                                                  ))}
                                             </SelectContent>
                                        </Select>
                                   </div>

                                   {/* Day Dropdown */}
                                   <div>
                                        <Label
                                             htmlFor="day"
                                             className="text-sm mb-1 block"
                                        >
                                             Day
                                        </Label>
                                        <Select
                                             value={formData.day}
                                             onValueChange={(value) =>
                                                  handleInputChange(
                                                       "day",
                                                       value
                                                  )
                                             }
                                             onOpenChange={(open) => {
                                                  if (
                                                       open &&
                                                       window.innerWidth < 768
                                                  ) {
                                                       document.body.classList.add(
                                                            "prevent-body-scroll"
                                                       );
                                                  } else {
                                                       document.body.classList.remove(
                                                            "prevent-body-scroll"
                                                       );
                                                  }
                                             }}
                                        >
                                             <SelectTrigger
                                                  data-test-id="day-select"
                                                  id="day"
                                                  className={`border ${
                                                       touched.day &&
                                                       !formData.day
                                                            ? "border-red-400"
                                                            : "border-slate-300 dark:border-slate-600"
                                                  }`}
                                             >
                                                  <SelectValue placeholder="Day" />
                                             </SelectTrigger>
                                             <SelectContent
                                                  className="max-h-60 mobile-scrollable"
                                                  onWheel={(e) =>
                                                       e.stopPropagation()
                                                  }
                                                  onTouchStart={(e) =>
                                                       e.stopPropagation()
                                                  }
                                                  onTouchMove={(e) =>
                                                       e.stopPropagation()
                                                  }
                                             >
                                                  {availableDays.map((d) => (
                                                       <SelectItem
                                                            data-test-id={`day-${d}`}
                                                            key={d}
                                                            value={d}
                                                       >
                                                            {d}
                                                       </SelectItem>
                                                  ))}
                                             </SelectContent>
                                        </Select>
                                   </div>
                              </div>
                         </div>

                         {/* Gender Section */}
                         <div className="space-y-2 mt-2">
                              <Label htmlFor="gender" className="font-medium">
                                   Gender
                              </Label>
                              <Select
                                   value={formData.gender}
                                   onValueChange={(value) =>
                                        handleInputChange("gender", value)
                                   }
                              >
                                   <SelectTrigger
                                        id="gender"
                                        data-test-id="gender-select"
                                        className={`border ${
                                             touched.gender && !formData.gender
                                                  ? "border-red-400"
                                                  : "border-slate-300 dark:border-slate-600"
                                        }`}
                                   >
                                        <SelectValue placeholder="Select gender" />
                                   </SelectTrigger>
                                   <SelectContent>
                                        <SelectItem
                                             data-test-id="gender-male"
                                             value="male"
                                        >
                                             Male
                                        </SelectItem>
                                        <SelectItem value="female">
                                             Female
                                        </SelectItem>
                                        <SelectItem value="unknown">
                                             Unknown
                                        </SelectItem>
                                        <SelectItem value="undisclosed">
                                             Choose not to disclose
                                        </SelectItem>
                                   </SelectContent>
                              </Select>
                              {errors.gender && (
                                   <p className="text-red-500 text-sm mt-1">
                                        {errors.gender}
                                   </p>
                              )}
                         </div>
                    </div>

                    <DialogFooter className="flex pt-2 border-t border-slate-200 dark:border-slate-700">
                         <Button
                              variant="outline"
                              onClick={handleCancel}
                              disabled={isSubmitting}
                              className="transition-colors mt-2 md:mt-0 mr-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                         >
                              Cancel
                         </Button>
                         <Button
                              data-test-id="create-patient-button"
                              onClick={() => {
                                   handleSubmit();
                                   setTimeout(() => {
                                        if (parentDialogOpen) {
                                             setParentDialogOpen(true);
                                        }
                                   }, 1000);
                              }}
                              disabled={isSubmitting || !isFormValid}
                              className={`bg-blue-600 hover:bg-blue-700 text-white transition-colors ${
                                   !isFormValid && !isSubmitting
                                        ? "opacity-70 cursor-not-allowed"
                                        : ""
                              }`}
                         >
                              {isSubmitting ? (
                                   <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Creating...
                                   </>
                              ) : (
                                   "Create Patient"
                              )}
                         </Button>
                    </DialogFooter>
               </DialogContent>
          </Dialog>
     );
};

export default AddPatientDialog;
