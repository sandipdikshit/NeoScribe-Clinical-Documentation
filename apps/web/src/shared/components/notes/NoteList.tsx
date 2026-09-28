'use client'

import React, { useEffect, useState } from 'react';
import {
  Search, Clock,
  CheckCircle, XCircle, HelpCircle, Trash2,
  RefreshCcw,
  EarOff
} from 'lucide-react';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useRouter } from 'next/navigation';
import { getNotes, deleteNote } from '@/services/notesApis';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useToast } from "@/shared/hooks/use-toast";
import { Note } from '@/shared/types/note.type';

interface NotesListProps {
  isMobile: boolean;
  isTablet: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
}

// Skeleton component for loading states
const NoteSkeleton = () => (
  <div className="flex flex-wrap sm:flex-nowrap items-center p-3">
    {/* Title - Takes full width on mobile, flex-1 otherwise */}
    <div className="w-full sm:w-auto sm:flex-1 pl-2 pr-2 py-1 sm:py-0 order-1 sm:order-none">
      <Skeleton className="h-5 w-full sm:w-3/4 rounded" />
    </div>

    {/* Mobile row with date and status on same line */}
    <div className="flex w-full sm:hidden justify-between items-center mt-1 order-2">
      <Skeleton className="h-3 w-16 rounded" />
      <Skeleton className="h-3 w-16 rounded" />
    </div>

    {/* Date - Desktop only */}
    <div className="hidden sm:block w-20 text-center">
      <Skeleton className="h-4 w-16 mx-auto rounded" />
    </div>

    {/* Status - Desktop only */}
    <div className="hidden sm:flex w-24 items-center justify-center gap-1">
      <Skeleton className="h-4 w-16 rounded" />
    </div>

    {/* Action button */}
    <div className="ml-auto sm:w-10 flex justify-center">
      <Skeleton className="w-6 h-6 rounded-full" />
    </div>
  </div>
);

const NotesList: React.FC<NotesListProps> = ({
  isMobile,
  isTablet,
  setIsSidebarOpen
}) => {
  const router = useRouter();
  const { toast } = useToast();

  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefresh, setIsRefresh] = useState(false);
  const [limit, setLimit] = useState(12); //saved for future use, pagination handlers
  const [skip, setSkip] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch notes data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await getNotes();
        setNotes(data);
        setFilteredNotes(data);
        setIsLoading(false);
        setIsRefresh(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setIsLoading(false);
        setIsRefresh(false);
      }
    };
    fetchData();
  }, [page, limit, skip, isRefresh]);

  // Handle search functionality
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredNotes(notes);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = notes.filter(note =>
        (note.note_title?.toLowerCase().includes(query)) ||
        (note.chief_complaint?.toLowerCase().includes(query)) ||
        (note.status?.toLowerCase().includes(query))
      );
      setFilteredNotes(filtered);
    }
  }, [searchQuery, notes]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  //saved for future use, pagination handlers
  // const handleNextPage = () => {
  //   const newPage = page + 1;
  //   setPage(newPage);
  //   setSkip((newPage - 1) * limit);
  // };

  //saved for future use, pagination handlers
  // const handlePrevPage = () => {
  //   if (page > 1) {
  //     const newPage = page - 1;
  //     setPage(newPage);
  //     setSkip((newPage - 1) * limit);
  //   }
  // };

  const handleDelete = async (id: string) => {
    try {
      await deleteNote(id);
      // Refresh the notes list after deletion
      const data = await getNotes();
      setNotes(data);
      setFilteredNotes(data);
      toast({
        description: 'Note deleted successfully',
        variant: 'success',
      });
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleViewNote = async (id: string) => {
    try {
      router.push(`/notes/${id}`);
      // Close sidebar on mobile when viewing a note
      if (isMobile || isTablet) {
        setIsSidebarOpen(false);
      }
    } catch (error) {
      console.error('Error fetching note:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    // Handle undefined or null status values
    if (!status) return <HelpCircle className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />;

    const statusLower = status.toLowerCase().trim();

    switch (statusLower) {
      case 'completed':
      case 'complete':
      case 'signed':
        return <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />;

      case 'processing':
      case 'analyzing':
      case 'pending':
      case 'draft':
        return <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500" />;

      case 'failed':
        return <EarOff className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />

      case 'error':
        return <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />;

      default:
        return <HelpCircle className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />;
    }
  };



  return (
    <div className="h-full flex-1 p-2 sm:p-4 lg:p-6 overflow-y-auto">
      <ScrollArea className="h-full">
        <Card>
          <CardHeader className="p-3 sm:p-4 lg:p-6">
            <div className="flex flex-col justify-between items-start space-y-3 sm:space-y-4">
              <CardTitle className="text-xl sm:text-2xl">Your Notes</CardTitle>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 lg:gap-4 w-full">
                <div className="relative flex-grow">
                  <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    className="pl-8 sm:pl-10 w-full"
                    placeholder="Search notes..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                  />
                </div>
              </div>
            </div>
            <CardDescription className="mt-2 sm:mt-3">
              <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0'>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-4 w-32 rounded" />
                  ) : (
                    `You have ${filteredNotes.length} notes in total`
                  )}
                </div>
                <div className="flex jistify-end md:justify-between items-center text-xs sm:text-sm text-gray-500 ">
                  <div>
                    <Button
                      onClick={() => setIsRefresh(true)}
                      variant={'ghost'}
                      className='hover:bg-blue-100 rounded-full p-2'>
                      <RefreshCcw />
                    </Button>
                  </div>
                </div>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {/* Header row - hidden on mobile */}
              <div className="hidden sm:flex items-center p-3 bg-gray-50 text-xs font-medium text-gray-500">
                <div className="flex-1 pl-1">Title</div>
                <div className="w-20 text-center">Date</div>
                <div className="w-40 text-center">Status</div>
                <div className="w-10"></div> {/* Action space */}
              </div>

              {/* Skeleton or Content rows */}
              {(() => {
                if (isLoading) {
                  // Render skeleton rows during loading
                  return Array.from({ length: 5 }).map(() => (
                    <NoteSkeleton key={`skeleton-${Math.random().toString(36).slice(2, 9)}`} />
                  ));
                }
                if (filteredNotes.length > 0) {
                  // Render actual note data
                  return filteredNotes.map((note) => (
                    <button
                      type="button"
                      key={note.note_id}
                      className="flex flex-wrap sm:flex-nowrap items-center p-3 hover:bg-gray-50 cursor-pointer w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onClick={() => handleViewNote(String(note.note_id))}
                      tabIndex={0}
                      aria-label={`View note ${note.note_title || 'Untitled Transcript'}`}
                    >
                      {/* Title - Takes full width on mobile, flex-1 otherwise */}
                      <div className="w-full sm:w-auto sm:flex-1 pl-2 pr-2 py-1 sm:py-0 order-1 sm:order-none">
                        <span className="font-medium text-sm sm:text-base line-clamp-2 sm:line-clamp-1">
                          {note.note_title || 'Untitled Transcript'}
                        </span>
                      </div>

                      {/* Mobile row with date and status on same line */}
                      <div className="flex w-full sm:hidden justify-between items-center mt-1 order-2">
                        <div className="text-xs text-gray-500">
                          {new Date(note.created_at).toLocaleDateString()}
                        </div>

                        <div className="flex items-center">
                          <div className="flex-shrink-0 mr-1">
                            {getStatusIcon(note.status)}
                          </div>
                          <span className="text-xs text-gray-500 max-w-[80px] truncate">
                            {note.status}
                          </span>
                        </div>
                      </div>

                      {/* Date - Desktop only */}
                      <div className="hidden sm:block w-20 text-center text-xs text-gray-500">
                        {new Date(note.created_at).toLocaleDateString()}
                      </div>

                      {/* Status - Desktop only */}
                      <div className="hidden sm:flex w-40 items-center justify-center gap-1">
                        <div className="flex-shrink-0">
                          {getStatusIcon(note.status)}
                        </div>
                        <span className="text-xs text-gray-500 max-w-[60px]">
                          {note.status}
                        </span>
                      </div>

                      {/* Action button */}
                      <div className="ml-auto sm:w-10 flex justify-center">
                        <button
                          type="button"
                          className="p-1 text-gray-400 hover:text-red-600 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(note.note_id);
                          }}
                          aria-label={`Delete note ${note.note_title || 'Untitled Transcript'}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </button>
                  ));
                }
                // No notes found
                return (
                  <div className="p-6 text-center text-gray-500">
                    {searchQuery ? 'No notes match your search' : 'No notes available'}
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </ScrollArea>
    </div>
  );
};

export default NotesList;