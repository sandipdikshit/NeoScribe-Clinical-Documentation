'use client';

import { useEffect } from 'react';
import Clarity from '@microsoft/clarity';

export default function ClarityProvider({clarityId}: {clarityId: string}) {
  useEffect(() => {
    // Initialize Clarity
    Clarity.init(`${clarityId}`);
  }, []);
  
  return null; // This component doesn't render anything
}