'use client'

import React, { useState, useRef, useEffect } from 'react';
import { User2, User, LogOut, X, ChevronDown, MessageCircleQuestion, MessageSquareShare, ShieldUser, ClipboardCheck, NotebookPen, Home } from 'lucide-react';
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useRouter } from 'next/navigation';
import FeedbackForm from '@/shared/components/feedback/Feedback';
import { Provider } from '@/shared/types/provider.type';
import { ProfileModal } from '@/shared/components/layout/ProfileModal';
import { Separator } from '../ui/separator';
import AudioControls from '../audio/AudioControl';

interface SidebarProps {
    isSidebarOpen: boolean;
    isMobile: boolean;
    isTablet: boolean;
    toggleSidebar: () => void;
    activeNavItem: string;
    setActiveNavItem: (item: string) => void;
    profile: Provider | null;
    loading: boolean;
    handleLogout: () => void;
    updateProfile?: (updatedProfile: Partial<Provider>) => Promise<void>;
}


const Sidebar: React.FC<SidebarProps> = ({
    isSidebarOpen,
    isMobile,
    isTablet,
    toggleSidebar,
    activeNavItem,
    setActiveNavItem,
    profile,
    loading,
    handleLogout,
    updateProfile: propUpdateProfile,
}) => {
    const [isMobileProfileMenuOpen, setIsMobileProfileMenuOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const mobileProfileMenuRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (mobileProfileMenuRef.current && !mobileProfileMenuRef.current.contains(event.target as Node)) {
                setIsMobileProfileMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const toggleMobileProfileMenu = () => {
        setIsMobileProfileMenuOpen(!isMobileProfileMenuOpen);
    };

    const openProfileModal = () => {
        setIsProfileModalOpen(true);
        setIsMobileProfileMenuOpen(false);
    };

    const openFeedbackModal = () => {
        setIsFeedbackModalOpen(true);
        setIsMobileProfileMenuOpen(false);
    };

    const navItems = [
        { name: 'Overview', icon: Home },
        { name: 'Notes', icon: NotebookPen },
        { name: 'Patients', icon: User2 },
        // { name: 'Templates', icon: FileText }, // template management
        // { name: 'Integration', icon: Link },
    ];

    return (
        <>
            {/* Sidebar overlay for mobile and tablet */}
            {(isMobile || isTablet) && isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar */}
            <div className={cn(
                "fixed z-50 bg-white transition-all duration-300 ease-in-out overflow-hidden",
                (isMobile || isTablet) ? "top-0 h-full" : "lg:relative h-screen",
                (isMobile || isTablet) ? (isSidebarOpen ? "left-0" : "-left-full") : "",
                isSidebarOpen ? "w-64" : "w-0 lg:w-20",
                "lg:block",
            )}>
                <div className="h-full border-r overflow-hidden flex flex-col">
                    {/* For mobile view - header at the top of sidebar */}
                    {(isMobile || isTablet) && isSidebarOpen && (
                        <div className="flex items-center justify-between p-3 bg-gray-200 border-b" ref={mobileProfileMenuRef}>
                            <div
                                className="flex items-center cursor-pointer"
                                onClick={toggleMobileProfileMenu}
                            >
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-2">
                                    <User className="h-5 w-5 text-gray-500" />
                                </div>
                                <div className="ml-2">
                                    {loading ? (
                                        <div className="text-sm font-medium">Loading...</div>
                                    ) : profile ? (
                                        <>
                                            <div className="text-sm font-medium">{profile.vName}</div>
                                            <div className="text-xs text-gray-500"><strong>NPI: </strong>{profile.iNPI}</div>
                                        </>
                                    ) : (
                                        <div className="text-sm font-medium text-red-500">Error loading profile</div>
                                    )}
                                </div>
                                <ChevronDown className="h-4 w-4 ml-1 text-gray-500" />
                            </div>
                            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                                <X className="h-6 w-6" />
                            </Button>

                            {/* Mobile Profile Dropdown Menu */}
                            {isMobileProfileMenuOpen && (
                                <div className="absolute left-4 top-16 w-48 bg-white rounded-md shadow-lg z-50 py-1">
                                    <div className="border-b pb-2 pt-2 px-4">
                                        <div className="text-sm font-medium">{profile?.vName}</div>
                                        <div className="text-xs text-gray-500">{profile?.vEmail}</div>
                                    </div>
                                    <div
                                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center cursor-pointer"
                                        onClick={openProfileModal}
                                    >
                                        <User className="h-4 w-4 mr-2" /> Profile
                                    </div>
                                    <div
                                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center cursor-pointer"
                                        onClick={() => {
                                            setIsMobileProfileMenuOpen(false);
                                            window.open('https://neoscribe.ai/support/', '_blank');
                                        }}
                                    >
                                        <MessageCircleQuestion className="h-4 w-4 mr-2" /> FAQ
                                    </div>
                                    <div
                                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center cursor-pointer"
                                        onClick={openFeedbackModal}
                                    >
                                        <MessageSquareShare className="h-4 w-4 mr-2" /> Feedback
                                    </div>
                                    <div
                                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center cursor-pointer"
                                        onClick={() => {
                                            setIsMobileProfileMenuOpen(false);
                                            window.open('https://neolytix.com/privacy-policy/', '_blank');
                                        }}
                                    >
                                        <ShieldUser className="h-4 w-4 mr-2" /> Privacy Policy
                                    </div>
                                    <div
                                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center cursor-pointer"
                                        onClick={() => {
                                            setIsMobileProfileMenuOpen(false);
                                            window.open('https://neoscribe.ai/terms-of-service/', '_blank');
                                        }}
                                    >
                                        <ClipboardCheck className="h-4 w-4 mr-2" /> Terms and Conditions
                                    </div>
                                    <div className="border-t pt-1">
                                        <div
                                            className="px-4 py-2 text-sm text-red-500 hover:bg-gray-100 flex items-center cursor-pointer"
                                            onClick={() => {
                                                setIsMobileProfileMenuOpen(false);
                                                handleLogout();
                                            }}
                                        >
                                            <LogOut className="h-4 w-4 mr-2" /> Logout
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col h-full p-4 justify-between">
                        {/* Navigation */}
                        <nav className="space-y-2 mt-2 flex-grow">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Button
                                        variant={'ghost'}
                                        key={item.name}
                                        onClick={() => {
                                            router.push('/dashboard?tab=' + item.name);
                                            setActiveNavItem(item.name);
                                            if (isMobile || isTablet) toggleSidebar();
                                        }}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg cursor-pointer transition-all duration-200",
                                            "hover:bg-gray-100 w-full justify-self-center",
                                            activeNavItem === item.name
                                                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                                                : ""
                                        )}
                                    >
                                        <Icon className={cn(
                                            "w-5 h-5",
                                            activeNavItem === item.name ? "text-white" : "text-gray-600"
                                        )} />
                                        {isSidebarOpen &&
                                            <span className="transition-opacity duration-300 text-sm">
                                                {item.name}
                                            </span>}
                                    </Button>
                                );
                            })}
                            <Separator />
                            <div >
                                {/* Right: Spacer for balance */}
                                <div>
                                    <AudioControls
                                        location="sidebar"
                                        sidebarOpen={isSidebarOpen}
                                    />
                                </div>
                            </div>

                        </nav>
                    </div>
                </div>
            </div>

            {/* Profile Modal (shared between mobile and desktop) */}
            <ProfileModal
                isProfileModalOpen={isProfileModalOpen}
                setIsProfileModalOpen={setIsProfileModalOpen}
                profile={profile}
            />

            {/* Feedback Modal */}
            {profile && (
                <FeedbackForm
                    isOpen={isFeedbackModalOpen}
                    onClose={() => setIsFeedbackModalOpen(false)}
                    providerId={profile.iUserId}
                />
            )}
        </>
    );
};

export default Sidebar;