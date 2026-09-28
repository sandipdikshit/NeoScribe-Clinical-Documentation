'use client'

import { Provider } from 'react-redux'
import { Toaster } from "@/shared/components/ui/toaster";
import RecordingIndicator from '@/shared/components/audio/RecordingIndicator'
import store from '@/app/store'

interface ReduxProviderProps {
    children: React.ReactNode;
}

export default function ReduxProvider({ children }: ReduxProviderProps) {
    return (
        <Provider store={store}>
            <Toaster />
            {children}
            <RecordingIndicator />
        </Provider>
    );
}
