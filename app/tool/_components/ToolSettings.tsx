// FILE: app/tool/_components/ToolSettings.tsx
'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import FeedbackModal from '@/app/_components/FeedbackModal';
import { useFavorites } from '@/app/context/FavoritesContext';

import {
  StarIcon as StarIconSolid,
  ChatBubbleBottomCenterTextIcon,
  ListBulletIcon,
} from '@heroicons/react/24/solid';
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline';

interface ToolSettingsProps {
  toolRoute: string;
}

export default function ToolSettings({ toolRoute }: ToolSettingsProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecentPanelOpen, setIsRecentPanelOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const settingsDialogRef = useRef<HTMLDivElement>(null);
  const recentPanelRef = useRef<HTMLDivElement>(null);
  const feedbackModalRef = useRef<HTMLDivElement>(null);

  const {
    isFavorite,
    toggleFavorite,
    isLoaded: favoritesLoaded,
  } = useFavorites();
  const directive = useMemo(() => {
    if (!toolRoute || !toolRoute.startsWith('/tool/')) return '';
    return toolRoute.substring('/tool/'.length).replace(/\/$/, '');
  }, [toolRoute]);
  const handleFavoriteToggle = () => {
    if (directive && favoritesLoaded) toggleFavorite(directive);
  };
  const isCurrentlyFavorite = favoritesLoaded ? isFavorite(directive) : false;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      /* ... */
      if (
        isSettingsOpen &&
        settingsDialogRef.current &&
        !settingsDialogRef.current.contains(event.target as Node)
      )
        setIsSettingsOpen(false);
      if (
        isRecentPanelOpen &&
        recentPanelRef.current &&
        !recentPanelRef.current.contains(event.target as Node)
      )
        setIsRecentPanelOpen(false);
      if (
        isFeedbackOpen &&
        feedbackModalRef.current &&
        !feedbackModalRef.current.contains(event.target as Node)
      )
        setIsFeedbackOpen(false);
    };
    if (isSettingsOpen || isRecentPanelOpen || isFeedbackOpen)
      document.addEventListener('mousedown', handleClickOutside);
    else document.removeEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSettingsOpen, isRecentPanelOpen, isFeedbackOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      /* ... */
      if (event.key === 'Escape') {
        if (isSettingsOpen) setIsSettingsOpen(false);
        if (isRecentPanelOpen) setIsRecentPanelOpen(false);
        if (isFeedbackOpen) setIsFeedbackOpen(false);
      }
    };
    if (isSettingsOpen || isRecentPanelOpen || isFeedbackOpen)
      window.addEventListener('keydown', handleKeyDown);
    else window.removeEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, isRecentPanelOpen, isFeedbackOpen]);

  const openSettings = () => {
    setIsRecentPanelOpen(false);
    setIsFeedbackOpen(false);
    setIsSettingsOpen(true);
  };
  const openRecentPanel = () => {
    setIsSettingsOpen(false);
    setIsFeedbackOpen(false);
    setIsRecentPanelOpen(true);
  };
  const openFeedback = () => {
    setIsSettingsOpen(false);
    setIsRecentPanelOpen(false);
    setIsFeedbackOpen(true);
  };

  return (
    <div className="absolute top-0 right-0 mt-1 mr-1 z-10 flex items-center gap-1">
      {/* --- Favorite Button --- */}
      {directive && (
        <button
          type="button"
          onClick={handleFavoriteToggle}
          disabled={!favoritesLoaded}
          className={`p-1.5 rounded-full transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
            isCurrentlyFavorite
              ? 'text-yellow-500 hover:bg-yellow-100'
              : 'text-gray-400 hover:text-yellow-500 hover:bg-[rgba(var(--color-border-base)/0.2)]'
          }`}
          aria-label={
            isCurrentlyFavorite ? 'Remove from favorites' : 'Add to favorites'
          }
          title={
            isCurrentlyFavorite ? 'Remove from favorites' : 'Add to favorites'
          }
        >
          {/* Conditional Icon */}
          {isCurrentlyFavorite ? (
            <StarIconSolid className="h-5 w-5" aria-hidden="true" />
          ) : (
            <StarIconOutline className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      )}
      {/* --- End Favorite Button --- */}

      {/* Feedback Button */}
      <button
        type="button"
        onClick={openFeedback}
        title="Provide Feedback or Report Issue"
        aria-label="Open Feedback Modal"
        className="p-1.5 text-gray-400 hover:text-[rgb(var(--color-text-base))] rounded-full hover:bg-[rgba(var(--color-border-base)/0.2)]"
      >
        <ChatBubbleBottomCenterTextIcon
          className="h-5 w-5"
          aria-hidden="true"
        />
      </button>

      {/* Recent Activity Button */}
      <button
        type="button"
        onClick={openRecentPanel}
        title="View Recent Activity for this Tool"
        aria-label="Open Recent Activity Panel"
        className="p-1.5 text-gray-400 hover:text-[rgb(var(--color-text-base))] rounded-full hover:bg-[rgba(var(--color-border-base)/0.2)]"
      >
        <ListBulletIcon className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Settings Modal (Structure unchanged) */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 flex items-center justify-center p-4"
          aria-labelledby="settings-dialog-title"
          role="dialog"
          aria-modal="true"
        >
          <div
            ref={settingsDialogRef}
            className="bg-[rgb(var(--color-bg-component))] rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center">
              <h2
                id="settings-dialog-title"
                className="text-lg font-semibold text-[rgb(var(--color-text-base))]"
              >
                History Settings
              </h2>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close Settings"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {/* Footer */}
            <div className="p-4 border-t border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] flex justify-end">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-md text-sm font-medium bg-[rgb(var(--color-button-primary-bg))] text-[rgb(var(--color-button-primary-text))] hover:bg-[rgb(var(--color-button-primary-hover-bg))]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity Panel/Modal (Structure unchanged) */}
      {isRecentPanelOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 flex items-center justify-center p-4"
          aria-labelledby="recent-panel-title"
          role="dialog"
          aria-modal="true"
        >
          <div
            ref={recentPanelRef}
            className="bg-[rgb(var(--color-bg-component))] rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="p-4 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center flex-shrink-0">
              <h2
                id="recent-panel-title"
                className="text-lg font-semibold text-[rgb(var(--color-text-base))]"
              >
                Recent Activity
              </h2>
              <button
                type="button"
                onClick={() => setIsRecentPanelOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close Recent Activity"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal (Structure unchanged) */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        dialogRef={feedbackModalRef}
      />
    </div>
  );
}
