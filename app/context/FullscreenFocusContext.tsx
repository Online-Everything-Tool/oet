// FILE: app/context/FullscreenFocusContext.tsx
'use client';
import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useCallback,
} from 'react';

interface FullscreenFocusContextType {
  isFocusMode: boolean;

  requestFocusMode: (id: string) => void;
  releaseFocusMode: (id: string) => void;
}

const FullscreenFocusContext = createContext<
  FullscreenFocusContextType | undefined
>(undefined);

export const useFullscreenFocus = () => {
  const context = useContext(FullscreenFocusContext);
  if (!context) {
    throw new Error(
      'useFullscreenFocus must be used within a FullscreenFocusProvider'
    );
  }
  return context;
};

export const FullscreenFocusProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [focusRequesters, setFocusRequesters] = useState<Set<string>>(
    new Set()
  );

  const requestFocusMode = useCallback((id: string) => {
    setFocusRequesters((prev) => new Set(prev).add(id));
  }, []);

  const releaseFocusMode = useCallback((id: string) => {
    setFocusRequesters((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isFocusMode = focusRequesters.size > 0;

  return (
    <FullscreenFocusContext.Provider
      value={{ isFocusMode, requestFocusMode, releaseFocusMode }}
    >
      {children}
    </FullscreenFocusContext.Provider>
  );
};
