// FILE: app/tool/_components/ToolSettings.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import FeedbackModal from '@/app/_components/FeedbackModal';
import { useFavorites } from '@/app/context/FavoritesContext';

import {
  StarIcon as StarIconSolid,
  ChatBubbleBottomCenterTextIcon,
} from '@heroicons/react/24/solid';
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline';
import { ToolMetadata } from '@/src/types/tools';

interface ToolSettingsProps {
  toolMetadata: ToolMetadata;
}

export default function ToolSettings({ toolMetadata }: ToolSettingsProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const settingsDialogRef = useRef<HTMLDivElement>(null);
  const feedbackModalRef = useRef<HTMLDivElement>(null);

  const {
    isFavorite,
    toggleFavorite,
    isLoaded: favoritesLoaded,
  } = useFavorites();

  const handleFavoriteToggle = () => {
    if (toolMetadata.directive && favoritesLoaded)
      toggleFavorite(toolMetadata.directive);
  };
  const isCurrentlyFavorite = favoritesLoaded
    ? isFavorite(toolMetadata.directive)
    : false;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isSettingsOpen &&
        settingsDialogRef.current &&
        !settingsDialogRef.current.contains(event.target as Node)
      )
        setIsSettingsOpen(false);
      if (
        isFeedbackOpen &&
        feedbackModalRef.current &&
        !feedbackModalRef.current.contains(event.target as Node)
      )
        setIsFeedbackOpen(false);
    };
    if (isSettingsOpen || isFeedbackOpen)
      document.addEventListener('mousedown', handleClickOutside);
    else document.removeEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSettingsOpen, isFeedbackOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isSettingsOpen) setIsSettingsOpen(false);
        if (isFeedbackOpen) setIsFeedbackOpen(false);
      }
    };
    if (isSettingsOpen || isFeedbackOpen)
      window.addEventListener('keydown', handleKeyDown);
    else window.removeEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, isFeedbackOpen]);

  const openFeedback = () => {
    setIsSettingsOpen(false);
    setIsFeedbackOpen(true);
  };

  return (
    <div className="absolute top-0 right-0 mt-1 mr-1 z-10 flex items-center gap-1">
      {toolMetadata.directive && (
        <button
          type="button"
          onClick={handleFavoriteToggle}
          disabled={!favoritesLoaded}
          className={`p-1.5 rounded-full transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
            isCurrentlyFavorite
              ? 'text-[rgb(var(--color-icon-accent-yellow-hover))] hover:bg-[rgb(var(--color-icon-accent-yellow))]/10'
              : 'text-[rgb(var(--color-text-disabled))] hover:text-[rgb(var(--color-icon-accent-yellow-hover))] hover:bg-[rgba(var(--color-border-base)/0.2)]'
          }`}
          aria-label={
            isCurrentlyFavorite ? 'Remove from favorites' : 'Add to favorites'
          }
          title={
            isCurrentlyFavorite ? 'Remove from favorites' : 'Add to favorites'
          }
        >
          {isCurrentlyFavorite ? (
            <StarIconSolid className="h-6 w-6" aria-hidden="true" />
          ) : (
            <StarIconOutline className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      )}

      <button
        type="button"
        onClick={openFeedback}
        title="Provide Feedback or Report Issue"
        aria-label="Open Feedback Modal"
        className="p-1.5 text-[rgb(var(--color-text-disabled))] hover:text-[rgb(var(--color-text-base))] rounded-full hover:bg-[rgba(var(--color-border-base)/0.2)]"
      >
        <ChatBubbleBottomCenterTextIcon
          className="h-6 w-6"
          aria-hidden="true"
        />
      </button>

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        dialogRef={feedbackModalRef}
        toolMetadata={toolMetadata}
      />
    </div>
  );
}
