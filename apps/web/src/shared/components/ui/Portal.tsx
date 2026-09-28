'use client';

import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
  rootId?: string;
}

/**
 * A component that renders its children in a portal at the document body level
 * This ensures the content is rendered at the root DOM level
 * and avoids z-index issues from nested components
 */
const Portal: React.FC<PortalProps> = ({ children, rootId = 'dialog-portal' }) => {
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null);
  
  useEffect(() => {
    // Check if the portal element already exists
    let element = document.getElementById(rootId);
    
    // If it doesn't exist, create it
    if (!element) {
      element = document.createElement('div');
      element.setAttribute('id', rootId);
      document.body.appendChild(element);
    }
    
    setPortalElement(element);
    
    // Cleanup function - only remove if we created it
    return () => {
      if (element && element.parentNode && element.getAttribute('data-created') === 'true') {
        element.parentNode.removeChild(element);
      }
    };
  }, [rootId]);
  
  // Only render once the portal element is available
  if (!portalElement) return null;
  
  return createPortal(children, portalElement);
};

export default Portal;