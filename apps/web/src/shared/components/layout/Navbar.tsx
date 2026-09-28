'use client'

import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, ChevronDown, ShieldUser, MessageCircleQuestion, MessageSquareShare, ClipboardCheck, Menu } from 'lucide-react';
import { Button } from "@/shared/components/ui/button";
import Image from 'next/image';
import FeedbackForm from '@/shared/components/feedback/Feedback';
import { useRouter } from 'next/navigation';
import { Provider } from '@/shared/types/provider.type';
import { ProfileModal } from './ProfileModal';

interface NavbarProps {
    toggleSidebar: () => void;
    isMobile: boolean;
    isTablet: boolean;
    profile: Provider | null;
    loading: boolean;
    handleLogout: () => void;
    updateProfile?: (updatedProfile: Partial<Provider>) => Promise<void>;
}

// Mock API function to update profile
const mockUpdateProfileAPI = async (userId: number, profileData: Partial<Provider>): Promise<Provider> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simulate API response
    const updatedProfile = {
        ...profileData,
        iUpdatedAt: Date.now(),
    } as Provider;

    // Simulate success or failure (95% success rate)
    if (Math.random() > 0.05) {
        return updatedProfile;
    } else {
        throw new Error("Failed to update profile. Please try again.");
    }
};

const Navbar: React.FC<NavbarProps> = ({
    toggleSidebar,
    isMobile,
    isTablet,
    profile,
    loading,
    handleLogout,
    updateProfile: propUpdateProfile
}) => {
    const router = useRouter();
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setIsProfileMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const toggleProfileMenu = () => {
        setIsProfileMenuOpen(!isProfileMenuOpen);
    };

    const openProfileModal = () => {
        setIsProfileModalOpen(true);
        setIsProfileMenuOpen(false);
    };

    const openFeedbackModal = () => {
        setIsFeedbackModalOpen(true);
        setIsProfileMenuOpen(false);
    };

    // Mobile/Tablet header
    if (isMobile || isTablet) {
        return (
            <>
                <div className="lg:hidden flex items-center justify-between p-3 sm:p-4 bg-white border-b">
                    <div className="flex items-center justify-between w-full">
                        {/* Left: Menu Button */}
                        <div className="w-1/3 flex justify-start">
                            <Button variant="ghost" onClick={toggleSidebar}>
                                <Menu className="w-12 h-12" />
                            </Button>
                        </div>

                        {/* Center: Logo */}
                        <div className="w-1/3 flex justify-center">
                            <Button variant='ghost' className='w-24 p-0' onClick={() => router.push('/dashboard?tab=Overview')}>
                                <Image
                                    src="/name.png"
                                    alt="Neoscribe Logo"
                                    width={150}
                                    height={36}
                                />
                            </Button>
                        </div>
                    </div>


                    {/* Mobile notifications and settings buttons */}
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
    }

    // Desktop top navigation bar
    return (
        <>
            <div className="hidden lg:flex items-center justify-between p-2 bg-white border-b">
                <div className="flex items-center gap-3">
                    {/* NeoScribe logo in topbar */}
                    <div className="flex items-center gap-2 ml-4">
                        <Button
                            variant='ghost'
                            className='w-24 p-0'
                            onClick={toggleSidebar}>
                            <Image
                                src="/name.png"
                                alt="Neoscribe Logo"
                                width={150}
                                height={36}
                                className="m-2"
                            />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-4 mr-4">
                    {/* Desktop Profile Menu */}
                    <div className="relative" ref={profileMenuRef}>
                        <Button
                            variant={'ghost'}
                            className="flex items-center ml-2 cursor-pointer"
                            onClick={toggleProfileMenu}
                        >
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <User className="h-5 w-5 text-gray-500" />
                            </div>
                            <div className="ml-2">
                                {(() => {
                                    if (loading) {
                                        return <div className="text-sm font-medium">Loading...</div>;
                                    } else if (profile) {
                                        return (
                                            <>
                                                <div className="text-sm font-medium">{profile.vName}</div>
                                                <div className="text-xs text-gray-500"><strong>NPI: </strong>{profile.iNPI}</div>
                                            </>
                                        );
                                    } else {
                                        return <div className="text-sm font-medium text-red-500">Error loading profile</div>;
                                    }
                                })()}
                            </div>
                            <ChevronDown className="h-4 w-4 ml-1 text-gray-500" />
                        </Button>

                        {/* Profile Dropdown Menu */}
                        {isProfileMenuOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 py-1">
                                <div className="border-b pb-2 pt-2 px-4">
                                    <div className="text-sm font-medium">{profile?.vName}</div>
                                    <div className="text-xs text-gray-500">{profile?.vEmail}</div>
                                </div>
                                <Button
                                    variant={'ghost'}
                                    className="w-full text-sm text-gray-700 hover:bg-gray-100 flex justify-start items-center cursor-pointer"
                                    onClick={openProfileModal}
                                >
                                    <User className="h-4 w-4 mr-2" /> Profile
                                </Button>
                                <Button
                                    variant={'ghost'}
                                    className="w-full text-sm text-gray-700 hover:bg-gray-100 flex justify-start items-center cursor-pointer"
                                    onClick={() => {
                                        setIsProfileMenuOpen(false);
                                        window.open('https://neoscribe.ai/support/', '_blank');
                                    }}
                                >
                                    <MessageCircleQuestion className="h-4 w-4 mr-2" /> FAQ
                                </Button>
                                <Button
                                    variant={'ghost'}
                                    className="w-full text-sm text-gray-700 hover:bg-gray-100 flex justify-start items-center cursor-pointer"
                                    onClick={openFeedbackModal}
                                >
                                    <MessageSquareShare className="h-4 w-4 mr-2" /> Feedback
                                </Button>
                                <Button
                                    variant={'ghost'}
                                    className="w-full text-sm text-gray-700 hover:bg-gray-100 flex justify-start items-center cursor-pointer"
                                    onClick={() => {
                                        setIsProfileMenuOpen(false);
                                        window.open('https://neolytix.com/privacy-policy/', '_blank');
                                    }}
                                >
                                    <ShieldUser className="h-4 w-4 mr-2" /> Privacy Policy
                                </Button>
                                <Button
                                    variant={'ghost'}
                                    className="w-full text-sm text-gray-700 hover:bg-gray-100 flex justify-start items-center cursor-pointer"
                                    onClick={() => {
                                        setIsProfileMenuOpen(false);

                                        window.open('https://neoscribe.ai/terms-of-service/', '_blank');
                                    }}
                                >
                                    <ClipboardCheck className="h-4 w-4 mr-2" /> Terms of Service
                                </Button>
                                <div className="border-t pt-1">
                                    <Button
                                        variant={'ghost'}
                                        className="w-full text-sm text-red-500 hover:bg-gray-100 flex justify-start items-center cursor-pointer"
                                        onClick={() => {
                                            setIsProfileMenuOpen(false);
                                            handleLogout();
                                        }}
                                    >
                                        <LogOut className="h-4 w-4 mr-2" /> Logout
                                    </Button>
                                </div>
                            </div>
                        )}
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

export default Navbar;