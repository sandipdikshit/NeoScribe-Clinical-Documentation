// SoapNotePanel.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import dynamic from 'next/dynamic';
import { CircleX, FileText, Plus, Loader2, Keyboard } from "lucide-react";
import CollapsibleSection from '@/shared/components/notes/Section';
import { createSection, updateSection } from '@/services/notesApis';
import { useToast } from "@/shared/hooks/use-toast";
import { KeyboardShortcut } from '@/shared/types/shortcuts.type';
import { Button } from '../ui/button';
import { Note } from '@/shared/types/note.type';

const ExportPDFButton = dynamic(() => import('@/shared/components/notes/ExportPDFButton'), { ssr: false });



interface SoapNotePanelProps {
  soapData: {
    sections: {
      section_id: string;
      sequence_number: number;
      [key: string]: any;
    }[];
  };
  isLoading: boolean;
  noteType?: string;
  onPlayAudio?: () => void; // Callback for playing audio
  note?: Note;
}

const SoapNotePanel: React.FC<SoapNotePanelProps> = ({
  soapData,
  isLoading,
  noteType,
  onPlayAudio,
  note
}) => {
  const { toast } = useToast();
  const [sections, setSections] = useState(
    soapData?.sections.map(section => ({
      section_name: "",
      section_type: "",
      content: "",
      is_like: false,
      is_dislike: false,
      ...section,
    })) || []
  );

  // State for adding new section
  const [showModal, setShowModal] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [sectionContent, setSectionContent] = useState("");
  const [isAddingSection, setIsAddingSection] = useState(false);
  const sectionRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});
  const [isCopied, setIsCopied] = useState(false);

  // State for note ID
  const [noteId, setNoteId] = useState<string | null>(null);

  // State for showing shortcuts help
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Update sections when soapData changes
  useEffect(() => {
    if (soapData?.sections) {
      setSections(
        soapData.sections.map(section => ({
          section_name: "",
          section_type: "",
          content: "",
          is_like: false,
          is_dislike: false,
          ...section,
        }))
      );
    }
  }, [soapData]);

  // Get note ID from URL
  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const id = pathParts[pathParts.length - 1];
    setNoteId(id);
  }, []);

  // Callback function for updating a section after editing or reaction
  const handleSectionUpdate = (updatedSection: { section_id: any; }) => {
    setSections((prevSections: any[]) =>
      prevSections.map(section =>
        section.section_id === updatedSection.section_id ? updatedSection : section
      )
    );
  };

  // Sort sections by their sequence number
  const sortedSections = [...sections].sort((a, b) => a.sequence_number - b.sequence_number);

  // Add new section function
  const addNewSection = async () => {
    setIsAddingSection(true);

    try {
      const newSection = {
        content: sectionContent,
        note_id: noteId,
        section_name: sectionName,
        section_type: sectionName.toUpperCase(),
        sequence_number: sortedSections.length + 1,
        is_like: false,
        is_dislike: false,
      };

      const addSectionDB = await createSection(newSection);

      if (addSectionDB) {
        // Create complete section object with all necessary fields
        const completeSection = {
          ...newSection,
          section_id: addSectionDB.section_id || Math.random().toString(36).substr(2, 9),
          ...addSectionDB
        };

        // Update sections immediately
        setSections(prev => [...prev, completeSection]);

        // Show success toast
        toast({
          title: "Success!",
          description: `Section "${sectionName}" has been added successfully.`,
          variant: "success",
        });

        // Reset form and close modal
        setSectionName("");
        setSectionContent("");
        setShowModal(false);

        // Focus on the new section after a brief delay
        setTimeout(() => {
          if (completeSection.section_id) {
            sectionRefs.current[completeSection.section_id]?.focus();
          }
        }, 100);
      } else {
        throw new Error("Failed to create section");
      }
    } catch (error) {
      console.error("Error creating section:", error);
      toast({
        title: "Error",
        description: "Failed to create section. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAddingSection(false);
    }
  };

  // Copy entire note to clipboard
  const copyNoteToClipboard = async () => {
    try {
      // Format the note content
      const noteContent = sortedSections
        .map(section => {
          const header = section.section_name || section.section_type || 'Untitled Section';
          const content = section.content || '';
          return `${header}\n${content}`;
        })
        .join('\n\n');

      // Copy to clipboard
      await navigator.clipboard.writeText(noteContent);

      // Show success feedback
      setIsCopied(true);
      toast({
        title: "Copied!",
        description: "Note content has been copied to clipboard.",
        variant: "success",
      });

      // Reset copy icon after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy note:", error);
      toast({
        title: "Error",
        description: "Failed to copy note content. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Close modal handler
  const handleCloseModal = () => {
    if (!isAddingSection) {
      setShowModal(false);
      setSectionName("");
      setSectionContent("");
    }
  };

  // Define keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'n',
      altKey: true,
      description: 'Add new section',
      action: () => {
        if (!showModal) {
          setShowModal(true);
        }
      }
    },
    // {
    //   key: ' ', // Space key
    //   description: 'Play/Pause audio',
    //   action: () => {
    //     if (onPlayAudio && !showModal) {
    //       onPlayAudio();
    //     }
    //   }
    // },
    {
      key: 'Escape',
      description: 'Close modal',
      action: () => {
        if (showModal && !isAddingSection) {
          handleCloseModal();
        }
      }
    },
    {
      key: '?',
      shiftKey: true,
      description: 'Show keyboard shortcuts',
      action: () => {
        setShowShortcutsHelp(!showShortcutsHelp);
      }
    }
  ];

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in input fields
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true';

    // Allow Escape key even in input fields to close modal
    if (event.key === 'Escape' && showModal) {
      event.preventDefault();
      handleCloseModal();
      return;
    }

    // Skip other shortcuts if in input field
    if (isInputField && event.key !== 'Escape') {
      return;
    }

    // Check each shortcut
    shortcuts.forEach(shortcut => {
      const keyMatch = event.key === shortcut.key;
      const ctrlMatch = !shortcut.ctrlKey || event.ctrlKey;
      const altMatch = !shortcut.altKey || event.altKey;
      const shiftMatch = !shortcut.shiftKey || event.shiftKey;

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        event.preventDefault();
        shortcut.action();
      }
    });
  }, [showModal, isAddingSection, onPlayAudio, showShortcutsHelp]);

  // Set up keyboard event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Shortcuts help tooltip
  const ShortcutsHelp = () => (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-lg z-50 max-w-xs animate-in fade-in-0 slide-in-from-bottom-5 duration-200">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-sm">Keyboard Shortcuts</h3>
        <Button
          onClick={() => setShowShortcutsHelp(false)}
          className="text-gray-400 hover:text-white"
        >
          <CircleX className="w-4 h-4" />
        </Button>
      </div>
      <div className="space-y-1 text-xs">
        {shortcuts.map((shortcut, index) => (
          <div key={index} className="flex justify-between">
            <span className="text-gray-300">
              {shortcut.description}
            </span>
            <kbd className="bg-gray-800 px-2 py-1 rounded text-xs">
              {shortcut.ctrlKey && 'Ctrl+'}
              {shortcut.altKey && 'Alt+'}
              {shortcut.shiftKey && 'Shift+'}
              {shortcut.key === ' ' ? 'Space' : shortcut.key}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );

  // Show loading skeleton if data is loading
  if (isLoading) {
    return (
      <Card className="h-full flex flex-col overflow-hidden">
        <CardHeader className="pb-2 px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            <span>{noteType} Note</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-auto space-y-4 p-3 sm:p-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // No sections available
  if ((!sections || sections.length === 0) && note?.status !== 'FAILED') {
    return (
      <Card className="h-full flex flex-col overflow-hidden">
        <CardHeader className="pb-2 px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center text-gray-700">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            <span className='text-xl md:text-2xl'>Note Preview</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-auto p-3 sm:p-4">
          <div className="h-full flex flex-col items-center justify-center text-gray-400 relative z-10">
            <p className="text-sm sm:text-base text-center px-4 mb-4">
              No SOAP sections available for this note.
            </p>
            <Button
              onClick={(e) => {
                setShowModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Section
            </Button>
            <p className="text-xs mt-2">
              Press <kbd className="bg-gray-200 px-1 rounded">Alt+N</kbd> to add section
            </p>
          </div>
        </CardContent>
        {/* Add Section Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative rounded-lg bg-white w-full max-w-md mx-auto shadow-xl animate-in fade-in-0 zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="flex justify-between items-center p-4 sm:p-6 pb-2 sm:pb-4 border-b">
                <CardTitle className="text-lg sm:text-xl md:text-2xl">
                  Add New Section
                </CardTitle>
                <Button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                  disabled={isAddingSection}
                  aria-label="Close modal"
                >
                  <CircleX className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
              </div>

              {/* Modal Body */}
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Section Heading
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Chief Complaint, Review of Systems"
                      className="w-full p-3 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      value={sectionName}
                      onChange={(e) => setSectionName(e.target.value)}
                      disabled={isAddingSection}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Section Content
                    </label>
                    <textarea
                      placeholder="Enter the content for this section..."
                      className="w-full p-3 text-sm sm:text-base border h-32 sm:h-40 md:h-48 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      value={sectionContent}
                      onChange={(e) => setSectionContent(e.target.value)}
                      disabled={isAddingSection}
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <p className="text-xs text-gray-500">
                      Press <kbd className="bg-gray-100 px-1 rounded">Esc</kbd> to close
                    </p>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleCloseModal}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm sm:text-base font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isAddingSection}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={addNewSection}
                        className="bg-blue-500 hover:bg-blue-600 px-6 py-2 text-white rounded-md text-sm sm:text-base font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[100px] justify-center"
                        disabled={!sectionName || !sectionContent || isAddingSection}
                      >
                        {isAddingSection ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          'Add Section'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

    );
  } else if (note?.status === 'FAILED') {
    return (
      <Card className="h-full flex flex-col overflow-hidden">
        <CardHeader className="pb-2 px-3 sm:px-6 border-b border-gray-100">
          <CardTitle className="text-base sm:text-lg text-gray-700 flex items-center">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            <span className='text-xl md:text-2xl'>Note Preview</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-auto justify-items-center content-center p-3 sm:p-4">
          <div className="flex flex-col lg:flex-row items-center justify-items-center lg:items-start gap-8 text-gray-700">
            {/* Icon Section */}
            <div className="flex-shrink-0">
              <div className="w-40 h-40 rounded-3xl flex items-center justify-center">
                <FileText className="w-20 h-20 text-gray-600" strokeWidth={1} />
              </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 text-center lg:text-left space-y-6 max-w-2xl">
              {/* Header */}
              <div>
                <h2 className="text-xl font-semibold text-gray-700 mb-3">
                  SOAP Note Cannot Be Generated
                </h2>
                <p className="text-gray-400 text-sm">
                  No medical information was found in the transcript to create a SOAP note.
                </p>
              </div>

              {/* Tips List */}
              <div className="space-y-3 text-left">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    1
                  </span>
                  <p className="text-gray-400 text-sm leading-relaxed pt-1">
                    Record a complete patient encounter including symptoms and examination
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    2
                  </span>
                  <p className="text-gray-400 text-sm leading-relaxed pt-1">
                    Speak clearly and mention medical terms, diagnoses, and treatment plans
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                    3
                  </span>
                  <p className="text-gray-400 text-sm leading-relaxed pt-1">
                    Ensure minimum 30 seconds of clinical conversation for best results
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="h-full flex flex-col overflow-hidden">
        <CardHeader className="pb-2 px-3 sm:px-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-5">
              <CardTitle className="text-gray-700 text-base sm:text-lg flex items-center">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                <span className="text-xl md:text-2xl">Note Preview</span>
              </CardTitle>
              <Button
                onClick={() => setShowModal(true)}
                className="p-1 flex shadow-none bg-transparent justify-center items-center text-xs sm:text-sm px-3 py-1 text-gray-500 hover:text-blue-600 hover:bg-slate-100 rounded-md self-start transition-all"
              >
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                Add section
              </Button>
              {note ? (
                <ExportPDFButton
                  note={note}
                  sections={sortedSections.map((s) => ({
                    sectionId: s.section_id,
                    sectionName: s.section_name,
                    content: s.content,
                    sequenceNumber: s.sequence_number,
                  }))}
                />
              ) : null}

            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
                className="bg-transparent shadow-none text-gray-400 hover:text-blue-400 transition-colors p-2 hover:bg-gray-100 rounded-md hidden sm:block"
                title="Keyboard shortcuts (Shift+?)"
              >
                <Keyboard className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-grow overflow-auto p-3 sm:p-4">
          <div className="flex flex-col justify-between">
            {sortedSections.map((section) => (
              <CollapsibleSection
                key={section.section_id}
                section={section}
                onSectionUpdate={handleSectionUpdate}
                ref={(el) => {
                  sectionRefs.current[section.section_id] = el;
                }}
              />
            ))}
          </div>
        </CardContent>

        {/* Add Section Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative rounded-lg bg-white w-full max-w-md mx-auto shadow-xl animate-in fade-in-0 zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="flex justify-between items-center p-4 sm:p-6 pb-2 sm:pb-4 border-b">
                <CardTitle className="text-lg sm:text-xl md:text-2xl">
                  Add New Section
                </CardTitle>
                <Button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                  disabled={isAddingSection}
                  aria-label="Close modal"
                >
                  <CircleX className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
              </div>

              {/* Modal Body */}
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Section Heading
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Chief Complaint, Review of Systems"
                      className="w-full p-3 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      value={sectionName}
                      onChange={(e) => setSectionName(e.target.value)}
                      disabled={isAddingSection}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Section Content
                    </label>
                    <textarea
                      placeholder="Enter the content for this section..."
                      className="w-full p-3 text-sm sm:text-base border h-32 sm:h-40 md:h-48 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      value={sectionContent}
                      onChange={(e) => setSectionContent(e.target.value)}
                      disabled={isAddingSection}
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <p className="text-xs text-gray-500">
                      Press <kbd className="bg-gray-100 px-1 rounded">Esc</kbd> to close
                    </p>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleCloseModal}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm sm:text-base font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isAddingSection}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={addNewSection}
                        className="bg-blue-500 hover:bg-blue-600 px-6 py-2 text-white rounded-md text-sm sm:text-base font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[100px] justify-center"
                        disabled={!sectionName || !sectionContent || isAddingSection}
                      >
                        {isAddingSection ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          'Add Section'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Shortcuts Help */}
      {showShortcutsHelp && <ShortcutsHelp />}
    </>
  );
};

export default SoapNotePanel;
