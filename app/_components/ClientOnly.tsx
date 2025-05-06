// components/ClientOnly.tsx
'use client';

import React, { useState, useEffect } from 'react';

interface ClientOnlyProps {
  children: React.ReactNode;
}

export default function ClientOnly({ children }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    // Render nothing or a placeholder on the server / before hydration
    return null;
    // Or: return <div>Loading UI...</div>;
  }

  // Render the actual children only on the client after mount
  return <>{children}</>;
}
