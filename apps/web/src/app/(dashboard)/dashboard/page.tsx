'use client'

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import authService from '@/services/authApis';
import NotesList from '@/shared/components/notes/NoteList';
import PatientsList from '@/shared/components/patient/PatientList';
import Dash from '@/shared/components/dashboard/Dashboard';
import Navbar from '@/shared/components/layout/Navbar';  // Update path as needed
import Sidebar from '@/shared/components/layout/Sidebar';  // Update path as needed
import TemplatesList from '@/shared/components/templates/TemplateList';
import { Provider } from '@/shared/types/provider.type';
import { useViewport } from '@/shared/hooks/useViewport';

// This component will handle the parts that need search params
function DashboardContent() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState('Overview');
  const { isMobile, isTablet } = useViewport();

  const searchParams = useSearchParams();

  const [profile, setProfile] = useState<Provider | null>({
    vName: '',
    iUserId: 0,
    iOTP: null,
    isVerified: false,
    iCreatedAt: 0,
    vEmail: '',
    iNPI: 0,
    txPassword: '',
    vSpeciality: '',
    tiStatus: 0,
    iUpdatedAt: 0
  } as Provider);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get the query parameter
    const tabState = searchParams.get('tab');

    if (tabState) {
      setActiveNavItem(tabState);
    }
  }, [searchParams]);

  const handleProfileUpdate = async (updatedData: Partial<Provider>) => {
    if (!profile) return;

    try {
      // const updatedProfile = await updateUserProfile(profile.iUserId, updatedData);
      // setProfile(updatedProfile);
      // return updatedProfile;
    } catch (error) {
      console.error("Failed to update profile:", error);
      throw error; // Re-throw to let the component handle the error
    }
  };

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

    getProfile();
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = async () => {
    await authService.logout();
    router.push('/login');
  }

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
        updateProfile={handleProfileUpdate}
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
        <div className="flex-1 overflow-auto">
          {(() => {
            switch (activeNavItem) {
              case 'Notes':
                return (
                  <NotesList
                    isMobile={isMobile}
                    isTablet={isTablet}
                    setIsSidebarOpen={setIsSidebarOpen}
                  />
                );
              case 'Patients':
                return (
                  <PatientsList
                    isMobile={isMobile}
                    isTablet={isTablet}
                    setIsSidebarOpen={setIsSidebarOpen}
                  />
                );
              case 'Overview':
                return (
                  <Dash
                    isMobile={isMobile}
                    isTablet={isTablet}
                    setIsSidebarOpen={setIsSidebarOpen}
                  />
                );
              case 'Templates':
                return (
                  <TemplatesList
                    isMobile={isMobile}
                    isTablet={isTablet}
                    setIsSidebarOpen={setIsSidebarOpen}
                  />
                );
              case 'Calendar':
              case 'Integration':
                return (
                  <div className="p-6">
                    <h1 className="text-2xl font-bold mb-4">{activeNavItem}</h1>
                    <p>This section is under development.</p>
                  </div>
                );
              default:
                return <div>Select an option from the sidebar</div>;
            }
          })()}
        </div>
      </div>
    </div>
  );
}

// Main component that wraps DashboardContent with Suspense
const Dashboard = () => {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
};

export default Dashboard;