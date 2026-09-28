// CollapsibleSection.jsx
import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  ChevronDown,
  ChevronUp,
  Edit,
  Save,
  ThumbsUp,
  ThumbsDown,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { updateSection, reaction, getSection } from "@/services/notesApis";
import ReactMarkdown from "react-markdown";

/**
 * CollapsibleSection Component
 *
 * A collapsible section for SOAP notes with like/dislike and edit functionality
 */
interface CollapsibleSectionProps {
  section: {
    section_id: string;
    section_name: string;
    section_type: string;
    content: string;
    is_like?: boolean;
    is_dislike?: boolean;
  };
  onSectionUpdate?: (updatedSection: any) => void;
  className?: string;
}

const CollapsibleSection = React.forwardRef<
  HTMLTextAreaElement,
  CollapsibleSectionProps
>(
  (
    {
      section,
      onSectionUpdate,
      className,
    },
    ref
  ) => {
    // State management
    const [isExpanded, setIsExpanded] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(section.content);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Local state for section data
    const [sectionData, setSectionData] = useState(section);
    const [isLikeLoading, setIsLikeLoading] = useState(false);
    const [isDislikeLoading, setIsDislikeLoading] = useState(false);

    // Derived state from section data
    const isLiked = sectionData.is_like || false;
    const isDisliked = sectionData.is_dislike || false;

    // Update local state when section prop changes
    useEffect(() => {
      setSectionData(section);
      setEditedContent(section.content);
    }, [section]);

    // Toggle section expansion
    const toggleExpand = () => {
      setIsExpanded(!isExpanded);
    };

    // Begin editing section
    const handleEdit = () => {
      setIsEditing(true);
      setEditedContent(sectionData.content);
    };

    // Cancel editing and reset content
    const handleCancel = () => {
      setIsEditing(false);
      setEditedContent(sectionData.content);
      setError(null);
    };

    // Fetch updated section data
    const fetchSectionData = async () => {
      try {
        const updatedSection = await getSection(sectionData.section_id);
        if (updatedSection) {
          setSectionData(updatedSection);
          if (onSectionUpdate) {
            onSectionUpdate(updatedSection);
          }
        }
      } catch (error) {
        console.error("Failed to fetch section data:", error);
      }
    };

    // Handle like button click
    const handleLike = async (e: React.MouseEvent) => {
      e.stopPropagation();

      if (isLikeLoading || isDislikeLoading) return;

      setIsLikeLoading(true);
      try {
        // Optimistic update
        const newIsLiked = !isLiked;
        setSectionData(prev => ({
          ...prev,
          is_like: newIsLiked,
          is_dislike: false,
        }));

        // Make API call
        await reaction.like(sectionData.section_id);

        // Fetch fresh data from server
        await fetchSectionData();
      } catch (error) {
        console.error("Failed to like section:", error);
        // Revert optimistic update on error
        setSectionData(prev => ({
          ...prev,
          is_like: isLiked,
          is_dislike: isDisliked,
        }));
      } finally {
        setIsLikeLoading(false);
      }
    };

    // Handle dislike button click
    const handleDislike = async (e: React.MouseEvent) => {
      e.stopPropagation();

      if (isLikeLoading || isDislikeLoading) return;

      setIsDislikeLoading(true);
      try {
        // Optimistic update
        const newIsDisliked = !isDisliked;
        setSectionData(prev => ({
          ...prev,
          is_like: false,
          is_dislike: newIsDisliked,
        }));

        // Make API call
        await reaction.dislike(sectionData.section_id);

        // Fetch fresh data from server
        await fetchSectionData();
      } catch (error) {
        console.error("Failed to dislike section:", error);
        // Revert optimistic update on error
        setSectionData(prev => ({
          ...prev,
          is_like: isLiked,
          is_dislike: isDisliked,
        }));
      } finally {
        setIsDislikeLoading(false);
      }
    };

    // Save edited content
    const handleSave = async () => {
      if (!editedContent.trim()) {
        setError("Content cannot be empty");
        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        // Call the API to update the section
        await updateSection(sectionData.section_id, {
          content: editedContent,
          section_type: sectionData.section_type,
        });

        // Update local state
        setSectionData(prev => ({
          ...prev,
          content: editedContent,
        }));

        // Notify parent
        if (onSectionUpdate) {
          onSectionUpdate({
            ...sectionData,
            content: editedContent,
          });
        }

        setIsEditing(false);
      } catch (err) {
        console.error("Failed to save section:", err);
        setError("Failed to save changes. Please try again.");
      } finally {
        setIsSaving(false);
      }
    };

    // Determine section styling based on section type and like/dislike state
    const getSectionTypeStyles = () => {
      const typeMap: Record<
        string,
        { border: string; bg: string; text: string; lightBg: string }
      > = {
        // Original mappings
        s: {
          border: "border-l-blue-500",
          bg: "bg-blue-50",
          text: "text-blue-700",
          lightBg: "bg-blue-50/50",
        },
        o: {
          border: "border-l-green-500",
          bg: "bg-green-50",
          text: "text-green-700",
          lightBg: "bg-green-50/50",
        },
        a: {
          border: "border-l-amber-500",
          bg: "bg-amber-50",
          text: "text-amber-700",
          lightBg: "bg-amber-50/50",
        },
        p: {
          border: "border-l-purple-500",
          bg: "bg-purple-50",
          text: "text-purple-700",
          lightBg: "bg-purple-50/50",
        },
        administrative: {
          border: "border-l-slate-500",
          bg: "bg-slate-50",
          text: "text-slate-700",
          lightBg: "bg-slate-50/50",
        },
        allergies: {
          border: "border-l-red-500",
          bg: "bg-red-50",
          text: "text-red-700",
          lightBg: "bg-red-50/50",
        },
        assessment: {
          border: "border-l-amber-500",
          bg: "bg-amber-50",
          text: "text-amber-700",
          lightBg: "bg-amber-50/50",
        },
        demographics: {
          border: "border-l-indigo-500",
          bg: "bg-indigo-50",
          text: "text-indigo-700",
          lightBg: "bg-indigo-50/50",
        },
        diagnosis: {
          border: "border-l-rose-500",
          bg: "bg-rose-50",
          text: "text-rose-700",
          lightBg: "bg-rose-50/50",
        },
        diagnostic: {
          border: "border-l-teal-500",
          bg: "bg-teal-50",
          text: "text-teal-700",
          lightBg: "bg-teal-50/50",
        },
        diagnostics: {
          border: "border-l-teal-500",
          bg: "bg-teal-50",
          text: "text-teal-700",
          lightBg: "bg-teal-50/50",
        },
        documentation: {
          border: "border-l-gray-500",
          bg: "bg-gray-50",
          text: "text-gray-700",
          lightBg: "bg-gray-50/50",
        },
        exam: {
          border: "border-l-amber-500",
          bg: "bg-amber-50",
          text: "text-amber-700",
          lightBg: "bg-amber-50/50",
        },
        "follow-up": {
          border: "border-l-sky-500",
          bg: "bg-sky-50",
          text: "text-sky-700",
          lightBg: "bg-sky-50/50",
        },
        formulation: {
          border: "border-l-emerald-500",
          bg: "bg-emerald-50",
          text: "text-emerald-700",
          lightBg: "bg-emerald-50/50",
        },
        goals: {
          border: "border-l-lime-500",
          bg: "bg-lime-50",
          text: "text-lime-700",
          lightBg: "bg-lime-50/50",
        },
        history: {
          border: "border-l-blue-500",
          bg: "bg-blue-50",
          text: "text-blue-700",
          lightBg: "bg-blue-50/50",
        },
        intervention: {
          border: "border-l-violet-500",
          bg: "bg-violet-50",
          text: "text-violet-700",
          lightBg: "bg-violet-50/50",
        },
        interventions: {
          border: "border-l-violet-500",
          bg: "bg-violet-50",
          text: "text-violet-700",
          lightBg: "bg-violet-50/50",
        },
        medication: {
          border: "border-l-green-500",
          bg: "bg-green-50",
          text: "text-green-700",
          lightBg: "bg-green-50/50",
        },
        medications: {
          border: "border-l-green-500",
          bg: "bg-green-50",
          text: "text-green-700",
          lightBg: "bg-green-50/50",
        },
        "mental status": {
          border: "border-l-fuchsia-500",
          bg: "bg-fuchsia-50",
          text: "text-fuchsia-700",
          lightBg: "bg-fuchsia-50/50",
        },
        plan: {
          border: "border-l-purple-500",
          bg: "bg-purple-50",
          text: "text-purple-700",
          lightBg: "bg-purple-50/50",
        },
        procedure: {
          border: "border-l-cyan-500",
          bg: "bg-cyan-50",
          text: "text-cyan-700",
          lightBg: "bg-cyan-50/50",
        },
        response: {
          border: "border-l-orange-500",
          bg: "bg-orange-50",
          text: "text-orange-700",
          lightBg: "bg-orange-50/50",
        },
        results: {
          border: "border-l-yellow-500",
          bg: "bg-yellow-50",
          text: "text-yellow-700",
          lightBg: "bg-yellow-50/50",
        },
        status: {
          border: "border-l-pink-500",
          bg: "bg-pink-50",
          text: "text-pink-700",
          lightBg: "bg-pink-50/50",
        },
        symptoms: {
          border: "border-l-blue-400",
          bg: "bg-blue-50",
          text: "text-blue-700",
          lightBg: "bg-blue-50/50",
        },
        time: {
          border: "border-l-stone-500",
          bg: "bg-stone-50",
          text: "text-stone-700",
          lightBg: "bg-stone-50/50",
        },
        treatment: {
          border: "border-l-purple-500",
          bg: "bg-purple-50",
          text: "text-purple-700",
          lightBg: "bg-purple-50/50",
        },
        "vital signs": {
          border: "border-l-red-400",
          bg: "bg-red-50",
          text: "text-red-700",
          lightBg: "bg-red-50/50",
        },
      };

      // Default styling if type not found
      const defaultStyle = {
        border: "border-l-gray-500",
        bg: "bg-gray-50",
        text: "text-gray-700",
        lightBg: "bg-gray-50/50",
      };

      const sectionType = sectionData.section_type.toLowerCase();
      let baseStyles = typeMap[sectionType] || defaultStyle;

      // Override colors based on like/dislike state

      return baseStyles;
    };

    const typeStyles = getSectionTypeStyles();

    return (
      <Card
        className={cn(
          "mb-3 sm:mb-4 overflow-hidden border-l-4 shadow-sm hover:shadow-md transition-all duration-200",
          typeStyles.border,
          className
        )}
      >
        <CardHeader
          className={cn(
            "py-2 sm:py-3 px-3 sm:px-4 cursor-pointer select-none",
            typeStyles.bg,
            "transition-colors duration-200"
          )}
          onClick={toggleExpand}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            {/* Section Title with Chevron */}
            <div
              className={cn(
                "flex items-center font-semibold text-sm sm:text-base",
                typeStyles.text
              )}
            >
              {isExpanded ? (
                <ChevronUp className={cn("h-4 w-4 mr-1 sm:mr-2 flex-shrink-0", typeStyles.text)} />
              ) : (
                <ChevronDown className={cn("h-4 w-4 mr-1 sm:mr-2 flex-shrink-0", typeStyles.text)} />
              )}
              <span className="break-words">{sectionData.section_name}</span>
            </div>

            {/* Action Buttons */}
            <div
              className="flex items-center gap-1 sm:gap-2 ml-5 sm:ml-0"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Like/Dislike buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "p-1 h-7 w-7 sm:h-8 sm:w-8 rounded-full transition-all duration-200 text-gray-500 hover:bg-gray-100",
                    (isLikeLoading || isDislikeLoading) ? "opacity-70 cursor-not-allowed" : ""
                  )}
                  onClick={handleLike}
                  disabled={isEditing || isLikeLoading || isDislikeLoading}
                >
                  {isLikeLoading ? (
                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  ) : (
                    <ThumbsUp className={cn("h-3 w-3 sm:h-4 sm:w-4", isLiked && "text-blue-500 fill-current")} />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "p-1 h-7 w-7 sm:h-8 sm:w-8 rounded-full transition-all duration-200 text-gray-500 hover:bg-gray-100",
                    (isLikeLoading || isDislikeLoading) ? "opacity-70 cursor-not-allowed" : ""
                  )}
                  onClick={handleDislike}
                  disabled={isEditing || isLikeLoading || isDislikeLoading}
                >
                  {isDislikeLoading ? (
                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  ) : (
                    <ThumbsDown className={cn("h-3 w-3 sm:h-4 sm:w-4", isDisliked && "text-red-500 fill-current")} />
                  )}
                </Button>
              </div>

              {/* Edit/Save/Cancel buttons */}
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1 px-2 h-7 sm:h-8 text-blue-600 hover:bg-blue-50 rounded-md flex items-center"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    )}
                    <span className="text-xs sm:text-sm font-medium">Save</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1 px-2 h-7 sm:h-8 text-gray-600 hover:bg-gray-100 rounded-md flex items-center"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="text-xs sm:text-sm font-medium">Cancel</span>
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 px-2 h-7 sm:h-8 text-gray-600 hover:bg-gray-100 rounded-md flex items-center"
                  onClick={handleEdit}
                >
                  <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span className="text-xs sm:text-sm font-medium">Edit</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent
            className={cn(
              "py-3 px-3 sm:px-4 transition-all duration-200",
              isEditing ? typeStyles.lightBg : "bg-white"
            )}
          >
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  ref={ref}
                  className="min-h-[120px] sm:min-h-[100px] w-full text-sm sm:text-base resize-none focus:ring-2 focus:ring-blue-500"
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  placeholder="Enter section content..."
                />
                {error && (
                  <p className="text-red-500 text-xs sm:text-sm flex items-center gap-1">
                    <span className="inline-block w-1 h-1 bg-red-500 rounded-full"></span>
                    {error}
                  </p>
                )}
              </div>
            ) : (
              <div className="prose prose-sm sm:prose max-w-none">
                {sectionData.content ? (
                  <div className="whitespace-pre-wrap text-sm sm:text-base text-gray-700">
                    <ReactMarkdown
                      components={{
                        p: ({ node, ...props }) => <p className="mb-1.5 sm:mb-2 leading-relaxed" {...props} />,
                        h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-2" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="text-xl font-bold mb-1.5" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="text-lg font-bold" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc ml-5" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal ml-5 mb-2" {...props} />,
                        li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                        strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                        em: ({ node, ...props }) => <em className="italic" {...props} />,
                        code: ({ node, ...props }) => <code className="bg-gray-100 px-1 py-0.5 rounded-sm text-sm" {...props} />,
                        blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600" {...props} />,
                        a: ({ node, ...props }) => <a className="text-blue-600 underline" {...props} />,
                        hr: ({ node, ...props }) => <hr className="my-4 border-gray-200" {...props} />,
                        br: ({ node, ...props }) => <br {...props} />,
                        img: ({ node, ...props }) => <img className="max-w-full h-auto my-2" {...props} />,
                        pre: ({ node, ...props }) => <pre className="bg-gray-100 p-2 rounded-sm overflow-x-auto" {...props} />,
                        table: ({ node, ...props }) => <table className="border-collapse w-full my-2" {...props} />,
                        thead: ({ node, ...props }) => <thead className="bg-gray-100" {...props} />,
                        tbody: ({ node, ...props }) => <tbody {...props} />,
                        tr: ({ node, ...props }) => <tr {...props} />,
                        th: ({ node, ...props }) => <th className="border px-2 py-1 text-left" {...props} />,
                        td: ({ node, ...props }) => <td className="border px-2 py-1 text-left" {...props} />,
                      }}
                    >
                      {sectionData.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-gray-400 italic text-sm sm:text-base">
                    No content available
                  </p>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    );
  }
);

CollapsibleSection.displayName = "CollapsibleSection";

export default CollapsibleSection;