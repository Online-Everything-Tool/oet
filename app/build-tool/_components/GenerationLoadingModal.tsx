// FILE: app/build-tool/_components/GenerationLoadingModal.tsx
import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import type { ResouceGenerationEpic } from '@/src/types/build';

interface GenerationLoadingModalProps {
  isOpen: boolean;
  onClose?: () => void;
  narrativeData: ResouceGenerationEpic | null;
  currentChapterIndex: number;
  toolDirective: string;
}

export default function GenerationLoadingModal({
  isOpen,
  onClose,
  narrativeData,
  currentChapterIndex,
  toolDirective,
}: GenerationLoadingModalProps) {
  if (!isOpen || !narrativeData) {
    return null;
  }

  const currentChapter = narrativeData.epicNarrative[currentChapterIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loading-modal-title"
      onClick={() => {}}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 md:p-8 max-w-md w-full relative"
        onClick={(e) => e.stopPropagation()}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Close modal"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}

        <div className="mb-4">
          <div className="flex flex-row gap-2 justify-between">
            <span className="text-4xl" role="img" aria-label="Employee emoji">
              {narrativeData.epicCompanyEmployeeEmoji}
            </span>
            <p className="mt-1">{narrativeData.epicCompanyEmployeeName}</p>
          </div>
          <p className="italic">
            {narrativeData.epicCompanyJobTitle} at{' '}
            {narrativeData.epicCompanyName}
          </p>
        </div>

        <h2
          id="loading-modal-title"
          className="font-semibold text-gray-800 mb-2"
        >
          Chapter {currentChapterIndex + 1} /{' '}
          {narrativeData.epicNarrative.length}:{' '}
          
        </h2>
        <div className="flex flew-wrap justify-start min-h-[4em] gap-4">
          <div className="text-2xl">{currentChapter.chapterEmoji}</div>
          <div className="text-lg text-gray-600">{currentChapter.chapterStory}</div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-4 mb-2 dark:bg-gray-700">
          <div
            className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${((currentChapterIndex + 1) / narrativeData.epicNarrative.length) * 100}%`,
            }}
          ></div>
        </div>
        <p className="text-xs text-gray-500">
          OET is working hard to build your tool:{' '}
          <strong>{toolDirective}</strong>
        </p>
      </div>
    </div>
  );
}
