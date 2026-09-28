'use client';

import React, { useEffect, useState } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { UserPlus, Loader2, FileText, Calendar, User } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/shared/components/ui/select";
import DatePicker from "@/shared/components/ui/DatePicker";
import { getTemplates } from '@/services/templateApis';
import { Template } from '@/shared/types/template.type';
import { Patient } from '@/shared/types/patient.type';

interface NoteInfoFormProps {
  chiefComplaint: string;
  setChiefComplaint: (value: string) => void;
  selectedPatient: string;
  setSelectedPatient: (value: string) => void;
  visitDate: Date | undefined;
  setVisitDate: (date: Date | undefined) => void;
  selectedTemplate: string;
  setSelectedTemplate: (value: string) => void;
  setNoteType: (type: string) => void;
  patients: Patient[];
  isLoading: boolean;
  onAddPatient: () => void;
}

const NoteInfoForm: React.FC<NoteInfoFormProps> = ({
  chiefComplaint,
  setChiefComplaint,
  selectedPatient,
  setSelectedPatient,
  visitDate,
  setVisitDate,
  selectedTemplate,
  setSelectedTemplate,
  setNoteType,
  patients,
  isLoading,
  onAddPatient
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Fetch templates when component mounts
  useEffect(() => {
    fetchTemplates();
  }, []);

  // Set default template when templates are loaded
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(templates[0].template_id);
      setNoteType(templates[0].name);
    }
  }, [templates, selectedTemplate, setSelectedTemplate, setNoteType]);

  // Update note type when template changes
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const selectedTemplateObj = templates.find(t => t.template_id === templateId);
    if (selectedTemplateObj) {
      setNoteType(selectedTemplateObj.name);
    }
  };

  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const data = await getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  return (
    <div className="grid gap-5 py-2">
      {/* Chief Complaint Section */}
      <div className="space-y-1 mb-1">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center">
          <FileText className="mr-1 h-4 w-4 text-blue-500" />
          Note Information
        </h3>
        <div className="h-px bg-slate-200 dark:bg-slate-700"></div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="chief-complaint" className="font-medium">Chief Complaint</Label>
        <Input
          id="chief-complaint"
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          placeholder="Enter chief complaint"
          className="border-slate-300 dark:border-slate-600 focus:ring-blue-500"
          data-test-id="chief-complaint-input"
        />
      </div>

      {/* Patient Section */}
      <div className="space-y-1 mb-1 mt-2">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center">
          <User className="mr-1 h-4 w-4 text-blue-500" />
          Patient Information
        </h3>
        <div className="h-px bg-slate-200 dark:bg-slate-700"></div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="patient-select" className="font-medium">Select Patient</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
            onClick={onAddPatient}
            data-test-id="add-new-patient-btn"
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Add New Patient
          </Button>
        </div>
        <Select value={selectedPatient} onValueChange={setSelectedPatient}>
          <SelectTrigger 
          id="patient-select" 
          className="w-full border-slate-300 dark:border-slate-600 focus:ring-blue-500"
          data-test-id="patient-select-trigger"
          >
            <SelectValue placeholder="Select patient" />
          </SelectTrigger>
          <SelectContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-500" />
                <span>Loading patients...</span>
              </div>
            ) : patients.length > 0 ? (
              patients.map((patient) => (
                <SelectItem 
                key={patient.patient_id} 
                value={patient.patient_id}
                data-test-id={`patient-option-${patient.patient_id}`}
                >
                  {`${patient.first_name} ${patient.last_name}`}
                </SelectItem>
              ))
            ) : (
              <div 
              className="py-2 px-2 text-sm text-slate-500"
              data-test-id="no-patient-msg"
              >No patients found</div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Visit Date Section */}
      <div className="space-y-1 mb-1 mt-2">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center">
          <Calendar className="mr-1 h-4 w-4 text-blue-500" />
          Visit Details
        </h3>
        <div className="h-px bg-slate-200 dark:bg-slate-700"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="visit-date" className="font-medium">Visit Date</Label>
          <div className="border-slate-300 dark:border-slate-600 focus:ring-blue-500"
          data-test-id="visit-date-picker"
          >
            <DatePicker
              selected={visitDate}
              onSelect={setVisitDate}
              disabled={(date) => {
                const today = new Date();
                const tenYearsAgo = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
                const tenYearsFromNow = new Date(today.getFullYear() + 10, today.getMonth(), today.getDate());
                return date < tenYearsAgo || date > tenYearsFromNow;
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="template-select" className="font-medium">Select Template</Label>
          <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
            <SelectTrigger 
            id="template-select" 
            className="w-full border-slate-300 dark:border-slate-600 focus:ring-blue-500"
            data-test-id="template-select-trigger"
            >
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent
              className='max-h-60 mobile-scrollable'
              onWheel={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              data-test-id="template-select-dropdown"
              >
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-500" />
                  <span>Loading templates...</span>
                </div>
              ) : templates.length > 0 ? (
                templates.map((template) => (
                  <SelectItem 
                  key={template.template_id} 
                  value={template.template_id}
                  data-test-id={`template-option-${template.template_id}`}
                  >
                    {template.name}
                  </SelectItem>
                ))
              ) : (
                <div 
                className="py-2 px-2 text-sm text-slate-500"
                data-test-id="no-templates-msg"
                >No templates found</div>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default NoteInfoForm;
