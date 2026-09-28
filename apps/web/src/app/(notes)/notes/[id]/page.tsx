'use client'

import React, { useEffect, useRef, useState } from 'react';
import {
    Search, Upload, Calendar, Clock, User, Star, ChevronLeft, ChevronRight, Lock,
    CheckCircle, XCircle, HelpCircle, Menu, X, Activity, Settings, Grid,
    User2,
    Mail,
    Bell,
    ChevronDown,
    LogOut
} from 'lucide-react';
import { Button } from "@/shared/components/ui/button";
import { useRouter } from 'next/navigation';
import { getNotes, getNoteWithID } from '@/services/notesApis';
import SoapNoteView from "@/shared/components/notes/NoteView"
import { ScrollArea } from "@/shared/components/ui/scroll-area"
import { cn } from "@/shared/lib/utils";
import authService from '@/services/authApis';
import Image from 'next/image';
import Sidebar from '@/shared/components/layout/Sidebar';
import Navbar from '@/shared/components/layout/Navbar';
import { Provider } from '@/shared/types/provider.type';


const Dashboard = ({ params }: { params: Promise<{ id: string }> }) => {

    const router = useRouter();
    const [selectedNote, setSelectedNote] = useState<string>('');
    const [isTablet, setIsTablet] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isMobileProfileMenuOpen, setIsMobileProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const mobileProfileMenuRef = useRef<HTMLDivElement>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeNavItem, setActiveNavItem] = useState('Notes');
    const [isMobile, setIsMobile] = useState(false);
    const [profile, setProfile] = useState<Provider | null>({
        vName: '',
        iUserId: 0,
        iOTP: null,
        isVerified: false,
        iCreatedAt: 0,
        vEmail: '',
        txPassword: '',
        vSpeciality: '',
        tiStatus: 0,
        iUpdatedAt: 0,
        iNPI: 0
    } as Provider);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if we're on mobile
        const fetchParams = async () => {
            const resolvedParams = await params;
            setSelectedNote(resolvedParams.id); // Set the selected note ID
        };

        fetchParams();
        const checkIfMobile = () => {
            setIsMobile(window.innerWidth < 768);
            // Close sidebar by default on mobile
            if (window.innerWidth < 768) {
                setIsSidebarOpen(false);
            } else {
                setIsSidebarOpen(true);
            }
        };

        // Initial check
        checkIfMobile();

        // Listen for window resize
        window.addEventListener('resize', checkIfMobile);

        // Cleanup
        return () => window.removeEventListener('resize', checkIfMobile);
    }, []);





    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setIsProfileMenuOpen(false);
            }
            if (mobileProfileMenuRef.current && !mobileProfileMenuRef.current.contains(event.target as Node)) {
                setIsMobileProfileMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Check viewport size and adjust layout accordingly
    useEffect(() => {
        const getProfile = async () => {
            try {
                const user = await authService.getCurrentProvider();
                if (user) {
                    setProfile(user);
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setLoading(false); // Stop loading after fetching
            }
        };

        const checkViewportSize = () => {
            // Get the current viewport width
            const width = window.innerWidth;
            setIsMobile(width < 640);
            setIsTablet(width >= 640 && width < 1024);

            // Close sidebar by default on mobile
            if (width < 640) {
                setIsSidebarOpen(false);
            } else if (width >= 640 && width < 1024) {
                // On tablet, close sidebar by default but can be toggled
                setIsSidebarOpen(false);
            } else {
                // On desktop, open sidebar by default
                setIsSidebarOpen(true);
            }
        };

        // Initial check
        checkViewportSize();
        getProfile();

        // Listen for window resize
        window.addEventListener('resize', checkViewportSize);

        // Cleanup
        return () => window.removeEventListener('resize', checkViewportSize);
    }, []);

    const navItems = [
        { name: 'Overview', icon: Grid },
        { name: 'Notes', icon: Calendar },
        { name: 'Patients', icon: User2 },
        // { name: 'Calendar', icon: Calendar },
        // { name: 'Integration', icon: Link },

    ];

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const handleLogout = async () => {
        await authService.logout();
        router.push('/login');
    }

    const toggleProfileMenu = () => {
        setIsProfileMenuOpen(!isProfileMenuOpen);
    };

    const toggleMobileProfileMenu = () => {
        setIsMobileProfileMenuOpen(!isMobileProfileMenuOpen);
    };

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            {/* Navbar Component */}
            <Navbar
                toggleSidebar={toggleSidebar}
                isMobile={isMobile}
                isTablet={isTablet}
                profile={profile}
                loading={loading}
                handleLogout={handleLogout}
            />

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Component */}
                <Sidebar
                    isSidebarOpen={isSidebarOpen}
                    isMobile={isMobile}
                    isTablet={isTablet}
                    toggleSidebar={toggleSidebar}
                    activeNavItem={activeNavItem}
                    setActiveNavItem={setActiveNavItem}
                    profile={profile}
                    loading={loading}
                    handleLogout={handleLogout}
                />

                {/* Main Content */}
                <div className="h-full flex-1 pl-2 pt-2 overflow-y-auto">
                    <div>
                        <SoapNoteView noteId={selectedNote} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
