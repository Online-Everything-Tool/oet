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

    if (homePersistentState.introModalDismissed !== shouldDismissForever) {
      const newState = {
        ...homePersistentState,
        introModalDismissed: shouldDismissForever,
      };
      setHomePersistentState(newState);
      saveStateNow(newState);
    }

    if (!shouldDismissForever) {
      sessionStorage.setItem(INTRO_MODAL_SESSION_KEY, 'true');
    }
  };

  const handleShowIntro = () => {
    sessionStorage.removeItem(INTRO_MODAL_SESSION_KEY);
    setIsIntroModalOpen(true);
  };

  if (isLoadingToolSavedState) {
    return <></>;
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
