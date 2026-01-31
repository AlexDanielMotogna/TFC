'use client';

import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
}

/**
 * Portal component that renders children at the document body level.
 * This ensures modals appear above all other content and are properly centered,
 * even when rendered from within containers that have CSS containment or overflow restrictions.
 */
export function Portal({ children }: PortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}
