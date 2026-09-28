'use client'

import React, { useState, useEffect, useRef } from 'react';
import { GripVertical, X, Plus } from 'lucide-react';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/dialog";
import { createTemplate, updateTemplate } from '@/services/templateApis';
import { Template, DraggableSection } from '@/shared/types/template.type';

interface CreateTemplateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onTemplateCreated?: (template: any) => void;
    onTemplateUpdated?: (template: any) => void;
    editingTemplate?: Template | null;
}

const CreateTemplateDialog: React.FC<CreateTemplateDialogProps> = ({
    open,
    onOpenChange,
    onTemplateCreated,
    onTemplateUpdated,
    editingTemplate
}) => {
    // Predefined sections for different structures
    const structurePresets: Record<string, DraggableSection[]> = {
        SOAP: [
            { id: '1', name: 'Chief Complaint' },
            { id: '2', name: 'Subjective' },
            { id: '3', name: 'Objective' },
            { id: '4', name: 'Assessment' },
            { id: '5', name: 'Plan' }
        ],
        'Progress Note': [
            { id: '1', name: 'Date and Time' },
            { id: '2', name: 'Progress Summary' },
            { id: '3', name: 'Current Status' },
            { id: '4', name: 'Next Steps' }
        ],
        'Initial Assessment': [
            { id: '1', name: 'Patient Information' },
            { id: '2', name: 'Chief Complaint' },
            { id: '3', name: 'History' },
            { id: '4', name: 'Examination' },
            { id: '5', name: 'Diagnosis' },
            { id: '6', name: 'Treatment Plan' }
        ]
    };

    // Form states
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    const [templateStructure, setTemplateStructure] = useState('SOAP');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [specificInstructions, setSpecificInstructions] = useState('');
    const [sections, setSections] = useState<DraggableSection[]>(structurePresets['SOAP']);
    const [newSectionName, setNewSectionName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Drag and drop states
    const [draggedSection, setDraggedSection] = useState<DraggableSection | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Mouse position for drag preview
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    // Load template data when editing
    useEffect(() => {
        if (editingTemplate && open) {
            setTemplateName(editingTemplate.name);
            setTemplateDescription(editingTemplate.description);
            setTemplateStructure(editingTemplate.structure);
            setSystemPrompt(editingTemplate.system_prompt);
            setSpecificInstructions(editingTemplate.specific_instructions);
            setSections(editingTemplate.sections.map((section, index) => ({
                id: String(index + 1),
                name: section
            })));
        } else if (!open) {
            resetForm();
        }
    }, [editingTemplate, open]);

    // Track mouse position for drag preview
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setMousePosition({ x: e.clientX, y: e.clientY });
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (isDragging && e.touches.length > 0) {
                setMousePosition({
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                });
            }
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.body.style.cursor = 'grabbing';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('touchmove', handleTouchMove);
            document.body.style.cursor = 'auto';
        };
    }, [isDragging]);

    const handleStructureChange = (value: string) => {
        setTemplateStructure(value);
        if (structurePresets[value]) {
            setSections(structurePresets[value].map((section, index) => ({
                ...section,
                id: String(Date.now() + index) // Ensure unique IDs
            })));
        } else if (value === 'Custom') {
            setSections([]);
        }
    };

    const handleAddSection = () => {
        if (newSectionName.trim()) {
            const newSection = {
                id: String(Date.now()),
                name: newSectionName.trim()
            };
            setSections([...sections, newSection]);
            setNewSectionName('');
        }
    };

    const handleRemoveSection = (id: string) => {
        setSections(sections.filter(section => section.id !== id));
    };

    const handleDragStart = (e: React.DragEvent, section: DraggableSection) => {
        // Prevent keyboard on mobile
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement) {
            activeElement.blur();
        }

        setDraggedSection(section);
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'move';

        // Hide default drag image
        const dragImage = new Image();
        dragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
        e.dataTransfer.setDragImage(dragImage, 0, 0);
    };

    const handleDragEnd = () => {
        setDraggedSection(null);
        setDragOverIndex(null);
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedSection) {
            const draggedIndex = sections.findIndex(s => s.id === draggedSection.id);
            if (draggedIndex !== index) {
                setDragOverIndex(index);
            }
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (!relatedTarget || !relatedTarget.closest('.sections-container')) {
            setDragOverIndex(null);
        }
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();

        if (!draggedSection) return;

        const draggedIndex = sections.findIndex(s => s.id === draggedSection.id);

        // Calculate the actual drop position
        let actualDropIndex = dropIndex;

        // If we're dragging from above to below, we need to adjust
        if (draggedIndex < dropIndex) {
            actualDropIndex = dropIndex + 1;
        }

        // Don't do anything if dropping in the same position
        if (draggedIndex === actualDropIndex || draggedIndex + 1 === actualDropIndex) {
            setDraggedSection(null);
            setDragOverIndex(null);
            return;
        }

        const newSections = [...sections];
        const [removed] = newSections.splice(draggedIndex, 1);

        // Adjust index after removal
        if (draggedIndex < actualDropIndex) {
            actualDropIndex--;
        }

        newSections.splice(actualDropIndex, 0, removed);

        setSections(newSections);
        setDraggedSection(null);
        setDragOverIndex(null);
    };

    const handleCreateTemplate = async () => {
        if (!templateName || !templateDescription || sections.length === 0 || !systemPrompt || !specificInstructions) {
            alert('Please fill in all required fields and add at least one section.');
            return;
        }

        setIsCreating(true);
        const templateData = {
            name: templateName,
            description: templateDescription,
            structure: templateStructure,
            sections: sections.map(s => s.name),
            system_prompt: systemPrompt || 'Default system prompt for this template',
            specific_instructions: specificInstructions || 'Default instructions for this template'
        };

        try {
            if (editingTemplate) {
                const updatedTemplate = await updateTemplate(editingTemplate.template_id, templateData);
                onTemplateUpdated?.(updatedTemplate);
            } else {
                const newTemplate = await createTemplate(templateData);
                onTemplateCreated?.(newTemplate);
            }
            onOpenChange(false);
            resetForm();
        } catch (error) {
            console.error(`Error ${editingTemplate ? 'updating' : 'creating'} template:`, error);
            alert(`Failed to ${editingTemplate ? 'update' : 'create'} template. Please try again.`);
        } finally {
            setIsCreating(false);
        }
    };

    const resetForm = () => {
        setTemplateName('');
        setTemplateDescription('');
        setTemplateStructure('SOAP');
        setSystemPrompt('');
        setSpecificInstructions('');
        setSections(structurePresets['SOAP']);
        setNewSectionName('');
        setDraggedSection(null);
        setDragOverIndex(null);
        setIsDragging(false);
    };

    return (
        <>
            <style jsx>{`
                .section-item {
                    transition: all 0.15s ease;
                    -webkit-tap-highlight-color: transparent;
                    -webkit-touch-callout: none;
                    -webkit-user-select: none;
                    -moz-user-select: none;
                    -ms-user-select: none;
                    user-select: none;
                }
                
                .section-item:hover {
                    transform: translateY(-1px);
                }
                
                .section-item.dragging {
                    opacity: 0.3;
                    transform: scale(0.98);
                }
                
                .drag-indicator {
                    height: 3px;
                    background: #3b82f6;
                    border-radius: 2px;
                    transform: scaleX(0);
                    transition: transform 0.15s ease;
                    margin: 4px 0;
                }
                
                .drag-indicator.active {
                    transform: scaleX(1);
                }

                @media (hover: hover) {
                    .section-item:hover {
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    }
                }

                @media (max-width: 768px) {
                    .section-item {
                        -webkit-touch-callout: none;
                        -webkit-user-select: none;
                        touch-action: none;
                    }
                }
            `}</style>

            {/* Custom drag preview */}
            {isDragging && draggedSection && (
                <div
                    style={{
                        position: 'fixed',
                        left: mousePosition.x - 100,
                        top: mousePosition.y - 20,
                        pointerEvents: 'none',
                        zIndex: 9999,
                        opacity: 0.9,
                    }}
                    className="flex items-center gap-2 p-3 bg-white rounded-md shadow-lg border border-blue-300"
                >
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700">{draggedSection.name}</span>
                </div>
            )}

            <Dialog open={open} onOpenChange={(isOpen) => {
                onOpenChange(isOpen);
                if (!isOpen) resetForm();
            }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900">
                            {editingTemplate ? 'Edit Template' : 'Create New Template'}
                        </DialogTitle>
                        <DialogDescription className="text-gray-500">
                            {editingTemplate
                                ? 'Update your template by modifying sections and arranging them in your preferred order.'
                                : 'Customize your template by adding sections and arranging them in your preferred order.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-gray-700">Template Name *</Label>
                            <Input
                                id="name"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                placeholder="Enter template name"
                                className="border-gray-300 focus:border-blue-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description" className="text-gray-700">Description *</Label>
                            <Textarea
                                id="description"
                                value={templateDescription}
                                onChange={(e) => setTemplateDescription(e.target.value)}
                                placeholder="Enter template description"
                                rows={3}
                                className="border-gray-300 focus:border-blue-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="structure" className="text-gray-700">Structure Type *</Label>
                            <Select value={templateStructure} onValueChange={handleStructureChange}>
                                <SelectTrigger className="border-gray-300">
                                    <SelectValue placeholder="Select a structure" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SOAP">SOAP</SelectItem>
                                    <SelectItem value="Progress Note">Progress Note</SelectItem>
                                    <SelectItem value="Initial Assessment">Initial Assessment</SelectItem>
                                    <SelectItem value="Custom">Custom</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="system-prompt" className="text-gray-700">System Prompt *</Label>
                            <Textarea
                                id="system-prompt"
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                placeholder="Enter a detailed prompt for the AI to create this Note "
                                rows={3}
                                className="border-gray-300 focus:border-blue-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="instructions" className="text-gray-700">Note Specific Instructions *</Label>
                            <Textarea
                                id="instructions"
                                value={specificInstructions}
                                onChange={(e) => setSpecificInstructions(e.target.value)}
                                placeholder="Include Instructions about this note and its sections"
                                rows={3}
                                className="border-gray-300 focus:border-blue-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-gray-700">Template Sections *</Label>
                            <div className="border border-gray-200 rounded-lg p-4 space-y-2 bg-gray-50">
                                <div className="flex gap-2 mb-3">
                                    <Input
                                        value={newSectionName}
                                        onChange={(e) => setNewSectionName(e.target.value)}
                                        placeholder="Add new section"
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddSection()}
                                        className="border-gray-300 focus:border-blue-500"
                                    />
                                    <Button
                                        onClick={handleAddSection}
                                        size="sm"
                                        className="bg-blue-600 hover:bg-blue-700"
                                        type="button"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div
                                    className="sections-container space-y-2"
                                    onDragLeave={handleDragLeave}
                                >
                                    {sections.map((section, index) => (
                                        <div key={section.id} className="relative">
                                            {/* Drop indicator above */}
                                            <div
                                                className={`drag-indicator ${dragOverIndex === index &&
                                                    draggedSection &&
                                                    sections.findIndex(s => s.id === draggedSection.id) > index
                                                    ? 'active' : ''
                                                    }`}
                                                style={{ marginBottom: '4px' }}
                                            />

                                            <div
                                                id={`section-${section.id}`}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, section)}
                                                onDragEnd={handleDragEnd}
                                                onDragOver={(e) => handleDragOver(e, index)}
                                                onDrop={(e) => handleDrop(e, index)}
                                                className={`
                                                    section-item flex items-center gap-2 p-3 bg-white rounded-md
                                                    border border-gray-200 cursor-grab active:cursor-grabbing
                                                    hover:border-gray-300
                                                    ${draggedSection?.id === section.id ? 'dragging' : ''}
                                                `}
                                            >
                                                <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                <span className="flex-1 text-gray-700 select-none">{section.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSection(section.id)}
                                                    className="p-1 text-gray-400 hover:text-red-600 transition-colors rounded hover:bg-red-50"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>

                                            {/* Drop indicator below */}
                                            <div
                                                className={`drag-indicator ${dragOverIndex === index &&
                                                    draggedSection &&
                                                    sections.findIndex(s => s.id === draggedSection.id) < index
                                                    ? 'active' : ''
                                                    }`}
                                                style={{ marginTop: '4px' }}
                                            />
                                        </div>
                                    ))}

                                    {/* Drop zone after all items */}
                                    {sections.length > 0 && (
                                        <div
                                            onDragOver={(e) => handleDragOver(e, sections.length)}
                                            onDrop={(e) => handleDrop(e, sections.length)}
                                            className="h-8 flex items-center justify-center"
                                        >
                                            <div
                                                className={`drag-indicator w-full ${dragOverIndex === sections.length
                                                    ? 'active' : ''
                                                    }`}
                                            />
                                        </div>
                                    )}
                                </div>

                                {sections.length === 0 && (
                                    <p className="text-sm text-gray-500 text-center py-8">
                                        No sections added. Add at least one section to create the template.
                                    </p>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                <GripVertical className="h-3 w-3" />
                                Drag and drop sections to reorder them
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                onOpenChange(false);
                                resetForm();
                            }}
                            disabled={isCreating}
                            className="border-gray-300 text-gray-700 hover:bg-gray-50 mt-2 md:mt-0"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateTemplate}
                            disabled={isCreating || !templateName || !templateDescription || sections.length === 0}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {isCreating
                                ? (editingTemplate ? 'Updating...' : 'Creating...')
                                : (editingTemplate ? 'Update Template' : 'Create Template')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default CreateTemplateDialog;