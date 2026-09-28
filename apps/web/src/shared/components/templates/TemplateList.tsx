'use client'

import React, { useEffect, useState } from 'react';
import {
    Search, Calendar, Star, ChevronLeft, ChevronRight, Clock,
    CheckCircle, XCircle, HelpCircle, Trash2, Plus
} from 'lucide-react';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useRouter } from 'next/navigation';
import { getTemplates, deleteTemplate } from '@/services/templateApis';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/components/ui/card";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Skeleton } from "@/shared/components/ui/skeleton";
import CreateTemplateDialog from '@/shared/components/templates/CreateTemplate';
import { useToast } from '@/shared/hooks/use-toast';
import { Template } from '@/shared/types/template.type';

interface TemplatesListProps {
    isMobile: boolean;
    isTablet: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
}

const TemplatesList: React.FC<TemplatesListProps> = ({
    isMobile,
    isTablet,
    setIsSidebarOpen
}) => {
    const router = useRouter();
    const { toast } = useToast();

    const [templates, setTemplates] = useState<Template[]>([]);
    const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [limit, setLimit] = useState(12);
    const [skip, setSkip] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddTemplateDialogOpen, setIsAddTemplateDialogOpen] = useState(false);
    const [isTemplateInfoOpen, setIsTemplateInfoOpen] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const data = await getTemplates();
                setTemplates(data);
                setFilteredTemplates(data);
                setIsLoading(false);
            } catch (error) {
                console.error('Error fetching data:', error);
                setIsLoading(false);
            }
        };
        fetchData();
    }, [page, limit, skip]);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredTemplates(templates);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = templates.filter(template =>
                (template.name && template.name.toLowerCase().includes(query)) ||
                (template.description && template.description.toLowerCase().includes(query)) ||
                (template.structure && template.structure.toLowerCase().includes(query))
            );
            setFilteredTemplates(filtered);
        }
    }, [searchQuery, templates]);

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
            await deleteTemplate(id);
            const data = await getTemplates();
            setTemplates(data);
            setFilteredTemplates(data);
            toast({
                description: 'Template deleted successfully',
                variant: 'success',
            });
        } catch (error) {
            console.error('Error deleting template:', error);
        }
    };

    const handleViewTemplate = (id: string) => {
        const template = templates.find(t => t.template_id === id);
        if (template) {
            setEditingTemplate(template);
            setIsAddTemplateDialogOpen(true);
        }
    };

    const handleTemplateCreated = (newTemplate: Template) => {
        const updatedTemplates = [newTemplate, ...templates];
        setTemplates(updatedTemplates);
        setFilteredTemplates(updatedTemplates);
    };

    const handleTemplateUpdated = (updatedTemplate: Template) => {
        const updatedTemplates = templates.map(template =>
            template.template_id === updatedTemplate.template_id ? updatedTemplate : template
        );
        setTemplates(updatedTemplates);
        setFilteredTemplates(updatedTemplates);
    };

    const TemplateSkeleton = () => (
        <div className="flex flex-col sm:flex-row items-start sm:items-center p-3 border-b">
            <div className="hidden sm:flex items-center w-full">
                <div className="w-8 justify-center">
                    <Skeleton className="w-4 h-4 rounded" />
                </div>
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
    );

    return (
        <div className="h-full flex-1 p-2 sm:p-4 lg:p-6 overflow-hidden">
            <div className="h-full flex flex-col">
                <Card className="flex-1 flex flex-col overflow-hidden">
                    <CardHeader className="p-3 sm:p-4 lg:p-6 flex-shrink-0">
                        <div className="flex flex-col justify-between items-start space-y-3 sm:space-y-4">
                            <CardTitle className="text-xl sm:text-2xl">Your Templates</CardTitle>
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 lg:gap-4 w-full">
                                <div className="relative flex-grow">
                                    <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                    <Input
                                        className="pl-8 sm:pl-10 w-full"
                                        placeholder="Search templates..."
                                        value={searchQuery}
                                        onChange={handleSearchChange}
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                    onClick={() => {
                                        setEditingTemplate(null);
                                        setIsAddTemplateDialogOpen(true);
                                    }}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Template
                                </Button>
                            </div>
                        </div>
                        <CardDescription className="mt-2 sm:mt-3">
                            <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0'>
                                <div>
                                    {isLoading ? (
                                        <Skeleton className="h-4 w-40 rounded" />
                                    ) : (
                                        `You have ${filteredTemplates.length} templates in total`
                                    )}
                                </div>
                                <div className="flex justify-between items-center text-xs sm:text-sm text-gray-500">
                                    {isLoading ? (
                                        <Skeleton className="h-4 w-16 rounded" />
                                    ) : (
                                        <div>
                                            {filteredTemplates.length > 0 ? `${skip + 1} - ${skip + filteredTemplates.length}` : '0 - 0'}
                                        </div>
                                    )}
                                    <div className="flex gap-1 sm:gap-2 ml-2">
                                        <Button onClick={handlePrevPage} variant="ghost" size="sm" disabled={page === 1 || isLoading}>
                                            <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                                        </Button>
                                        <Button onClick={handleNextPage} variant="ghost" size="sm" disabled={filteredTemplates.length < limit || isLoading}>
                                            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="divide-y">
                                <div className="hidden sm:flex items-center p-3 bg-gray-50 text-xs font-medium text-gray-500">
                                    <div className="w-8 flex justify-center">
                                        <input type="checkbox" className="accent-blue-600" />
                                    </div>
                                    <div className="flex-1 pl-2">Template Title</div>
                                    <div className="w-24 text-center">Category</div>
                                    <div className="w-10"></div>
                                </div>

                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, index) => (
                                        <TemplateSkeleton key={`skeleton-${index}`} />
                                    ))
                                ) : filteredTemplates.length > 0 ? (
                                    filteredTemplates.map((template) => (
                                        <div
                                            onClick={() => handleViewTemplate(String(template.template_id))}
                                            key={template.template_id}
                                            className="flex flex-row items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-0"
                                        >
                                            <div className="hidden sm:flex items-center w-full">
                                                <div className="w-8 flex justify-center">
                                                    <input
                                                        type="checkbox"
                                                        className="accent-blue-600"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                                <div className="flex-1 pl-2">
                                                    <span className="font-medium text-sm sm:text-base">
                                                        {template.name}
                                                    </span>
                                                </div>
                                                <div className="w-24 text-center text-xs text-gray-500">
                                                    {template.structure}
                                                </div>
                                                <div className="w-10 flex justify-center">
                                                    <button
                                                        className="p-1 text-gray-400 hover:text-red-600 rounded-full"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(template.template_id);
                                                        }}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="sm:hidden flex w-full justify-between items-center">
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm">
                                                        {template.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {template.structure}
                                                    </div>
                                                </div>
                                                <div className="ml-2">
                                                    <button
                                                        className="p-1 text-gray-400 hover:text-red-600 rounded-full"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(template.template_id);
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
                                        {searchQuery ? 'No templates match your search' : 'No templates available'}
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Create Template Dialog */}
            <CreateTemplateDialog
                open={isAddTemplateDialogOpen}
                onOpenChange={(isOpen: any) => {
                    setIsAddTemplateDialogOpen(isOpen);
                    if (!isOpen) {
                        setEditingTemplate(null);
                    }
                }}
                onTemplateCreated={handleTemplateCreated}
                onTemplateUpdated={handleTemplateUpdated}
                editingTemplate={editingTemplate}
            />
        </div>
    );
};

export default TemplatesList;