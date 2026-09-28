'use client'

import React from 'react';
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Provider } from '@/shared/types/provider.type';

interface ProfileModalProps {
    isProfileModalOpen: boolean;
    setIsProfileModalOpen: (open: boolean) => void;
    profile: Provider | null;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isProfileModalOpen, setIsProfileModalOpen, profile }) => {

    return (
        <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Your Profile</DialogTitle>
                    <DialogDescription>
                        Your profile information.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        {profile?.vName}
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                            Email
                        </Label>
                        {profile?.vEmail}
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="specialty" className="text-right">
                            NPI
                        </Label>
                        {profile?.iNPI}

                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="specialty" className="text-right">
                            Speciality
                        </Label>
                        {profile?.vSpeciality}

                    </div>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsProfileModalOpen(false)}
                    >
                        Cancel
                    </Button>

                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}