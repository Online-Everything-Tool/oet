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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loading-modal-title"
    >
      {/* Main modal card */}
      <div
        className="bg-white rounded-lg shadow-2xl p-6 md:p-8 max-w-lg w-full relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ minHeight: '30rem' }}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full p-1"
            aria-label="Close modal"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        )}

        {/* Header: Employee & Company Info */}
        <div className="mb-4 flex items-start space-x-3 shrink-0">
          <span
            className="text-5xl leading-none"
            role="img"
            aria-label="Employee emoji"
          >
            {narrativeData.epicCompanyEmployeeEmoji}
          </span>
          <div className="flex-grow">
            <p className="text-lg font-semibold text-gray-800 leading-tight">
              {narrativeData.epicCompanyEmployeeName}
            </p>
            <p className="text-sm text-gray-600 italic leading-tight">
              {narrativeData.epicCompanyJobTitle}
            </p>
            <div className="flex items-center mt-1">
              <span
                className="text-2xl mr-1.5"
                role="img"
                aria-label="Company emoji"
              >
                {narrativeData.epicCompanyEmoji}
              </span>
              <p className="text-sm text-gray-500 leading-tight">
                {narrativeData.epicCompanyName}
              </p>
            </div>
          </div>
        </div>

        {/* Chapter Title */}
        <h2
          id="loading-modal-title"
          className="text-sm font-semibold text-indigo-700 mb-2 uppercase tracking-wider shrink-0"
        >
          Chapter {currentChapterIndex + 1} /{' '}
          {narrativeData.epicNarrative.length}
        </h2>

        {/* Content Area: Emoji & Story */}
        <div
          className="flex items-start gap-x-4 mb-4 overflow-y-auto custom-scrollbar flex-grow"
          style={{ minHeight: '14rem' }}
        >
          <div className="text-4xl sm:text-5xl leading-none pt-1 shrink-0">
            {currentChapter.chapterEmoji}
          </div>
          <div className="text-md sm:text-lg text-gray-700 leading-relaxed flex-grow pr-1">
            {currentChapter.chapterStory}
          </div>
        </div>

        {/* Footer: Progress Bar & Tool Name - push to bottom */}
        <div className="mt-auto shrink-0">
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2 dark:bg-gray-700">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-1000 ease-linear"
              style={{
                width: `${((currentChapterIndex + 1) / narrativeData.epicNarrative.length) * 100}%`,
              }}
              aria-valuenow={
                ((currentChapterIndex + 1) /
                  narrativeData.epicNarrative.length) *
                100
              }
              aria-valuemin={0}
              aria-valuemax={100}
              role="progressbar"
              aria-label="Narrative progress"
            ></div>
          </div>
          <p className="text-xs text-center text-gray-500">
            OET AI is crafting your tool:{' '}
            <strong className="text-gray-600">{toolDirective}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
