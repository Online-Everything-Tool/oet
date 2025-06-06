// FILE: app/_components/HomePageClient.tsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import useToolState from '../tool/_hooks/useToolState';
import ToolListWidget, { ToolDisplayData } from './ToolListWidget';
import BuildToolWidget from './BuildToolWidget';
import IntroPromotionalModal from './IntroPromotionalModal';

interface HomeToolState {
  introModalDismissed?: boolean;
}

const DEFAULT_HOME_STATE: HomeToolState = {
  introModalDismissed: false,
};

const INTRO_MODAL_SESSION_KEY = 'oetIntroModalSessionDismissed';

interface HomePageClientProps {
  initialTools: ToolDisplayData[];
  projectAnalysis: {
    suggestedDirectives: string[];
    modelNameUsed: string | null;
  } | null;
}

export default function HomePageClient({
  initialTools,
  projectAnalysis,
}: HomePageClientProps) {
  const toolRouteForState = `/tool/home`;

  const {
    state: homePersistentState,
    setState: setHomePersistentState,
    isLoadingState: isLoadingToolSavedState,
    saveStateNow,
  } = useToolState<HomeToolState>(toolRouteForState, DEFAULT_HOME_STATE);

  const [isIntroModalOpen, setIsIntroModalOpen] = useState(false);

  useEffect(() => {
    if (isLoadingToolSavedState) {
      return;
    }

    const isPermanentlyDismissed = homePersistentState.introModalDismissed;
    const isSessionDismissed =
      sessionStorage.getItem(INTRO_MODAL_SESSION_KEY) === 'true';

    // Only open automatically if it's not permanently dismissed, not session dismissed,
    // and not already open (to prevent loops).
    if (!isPermanentlyDismissed && !isSessionDismissed && !isIntroModalOpen) {
      const timer = setTimeout(() => {
        setIsIntroModalOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    isLoadingToolSavedState,
    homePersistentState.introModalDismissed,
    isIntroModalOpen,
  ]);

  const handleModalDismiss = (shouldDismissForever: boolean) => {
    setIsIntroModalOpen(false);

    // Update persistent state only if it has changed.
    if (homePersistentState.introModalDismissed !== shouldDismissForever) {
      const newState = {
        ...homePersistentState,
        introModalDismissed: shouldDismissForever,
      };
      setHomePersistentState(newState);
      saveStateNow(newState);
    }

    // If not dismissing forever, set the session key.
    if (!shouldDismissForever) {
      sessionStorage.setItem(INTRO_MODAL_SESSION_KEY, 'true');
    }
  };

  const handleShowIntro = () => {
    // When the user explicitly asks to see it, clear the session dismissal first.
    sessionStorage.removeItem(INTRO_MODAL_SESSION_KEY);
    setIsIntroModalOpen(true);
  };

  if (isLoadingToolSavedState) {
    return (
      <div className="space-y-10 animate-pulse">
        <div className="p-4 md:p-6 border rounded-lg bg-[rgb(var(--color-bg-subtle-hover))] shadow-sm h-72">
          <div className="h-8 bg-[rgb(var(--color-bg-neutral))] rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-[rgb(var(--color-bg-neutral))] rounded w-full mb-2"></div>
          <div className="h-4 bg-[rgb(var(--color-bg-neutral))] rounded w-5/6"></div>
        </div>
        <div className="p-4 md:p-6 border rounded-lg bg-[rgb(var(--color-bg-subtle-hover))] shadow-sm h-56">
          <div className="h-8 bg-[rgb(var(--color-bg-neutral))] rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-[rgb(var(--color-bg-neutral))] rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ToolListWidget
        initialTools={initialTools}
        onShowIntro={handleShowIntro}
      />
      <BuildToolWidget
        suggestedDirectives={projectAnalysis?.suggestedDirectives || []}
        modelNameUsed={projectAnalysis?.modelNameUsed}
      />
      <IntroPromotionalModal
        isOpen={isIntroModalOpen}
        isDismissedForever={!!homePersistentState.introModalDismissed}
        onDismiss={handleModalDismiss}
      />
    </div>
  );
}
