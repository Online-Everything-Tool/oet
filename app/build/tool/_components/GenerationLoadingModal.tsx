// FILE: app/build/tool/_components/GenerationLoadingModal.tsx
import React from 'react';
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid';
import type { ResourceGenerationEpic } from '@/src/types/tools';

interface GenerationLoadingModalProps {
  isOpen: boolean;
  onClose?: () => void;
  narrativeData: ResourceGenerationEpic | null;
  currentChapterIndex: number;
  toolDirective: string;
  isFetchingNarrative?: boolean;
}

const PreNarrativeContent = ({ toolDirective }: { toolDirective: string }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center flex-grow w-full py-8">
      <div className="mb-8">
        <PaperAirplaneIcon className="h-16 w-16 md:h-24 md:w-24 text-[rgb(var(--color-icon-brand))] animate-pulse-rocket transform -rotate-45" />
      </div>
      <p className="text-xl md:text-2xl font-semibold text-[rgb(var(--color-text-emphasis))] ext-[rgb(var(--color-text-inverted))] mb-2">
        OET Mission Control...
      </p>
      <p className="text-lg md:text-xl text-[rgb(var(--color-icon-brand))] mb-6">
        We&apos;re GO for launch on:{' '}
        <strong className="font-bold">{toolDirective}</strong>!
      </p>
      <p className="text-sm text-[rgb(var(--color-text-subtle))] ext-[rgb(var(--color-text-disabled))] italic px-4">
        You can almost feel Big Tool Corp starting to panic... their servers are
        probably &lsquo;requesting a comfort animal.&rsquo;
      </p>
    </div>
  );
};

export default function GenerationLoadingModal({
  isOpen,
  onClose,
  narrativeData,
  currentChapterIndex,
  toolDirective,
  isFetchingNarrative,
}: GenerationLoadingModalProps) {
  if (!isOpen) {
    return null;
  }

  const displayNarrative = narrativeData && !isFetchingNarrative;
  const currentChapter = displayNarrative
    ? narrativeData.epicNarrative[currentChapterIndex]
    : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loading-modal-title-actual"
    >
      <div
        className="bg-white rounded-lg shadow-2xl p-6 md:p-8 max-w-lg w-full relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ minHeight: '30rem' }}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 text-[rgb(var(--color-text-disabled))] ext-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-subtle))] over:text-[rgb(var(--color-text-muted))] rounded-full p-1 z-10"
            aria-label="Close modal"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        )}

        {displayNarrative && narrativeData && currentChapter ? (
          <>
            <div className="mb-4 flex items-start space-x-3 shrink-0">
              <span
                className="text-5xl leading-none"
                role="img"
                aria-label="Employee emoji"
              >
                {narrativeData.epicCompanyEmployeeEmoji}
              </span>
              <div className="flex-grow">
                <p className="text-lg font-semibold text-[rgb(var(--color-text-emphasis))] ext-[rgb(var(--color-text-inverted))] leading-tight">
                  {narrativeData.epicCompanyEmployeeName}
                </p>
                <p className="text-sm text-[rgb(var(--color-text-subtle))] ext-[rgb(var(--color-text-disabled))] italic leading-tight">
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
                  <p className="text-sm text-[rgb(var(--color-text-muted))] ext-[rgb(var(--color-text-disabled))] leading-tight">
                    {narrativeData.epicCompanyName}
                  </p>
                </div>
              </div>
            </div>
            <h2
              id="loading-modal-title-actual"
              className="text-sm font-semibold text-[rgb(var(--color-text-link))] mb-2 uppercase tracking-wider shrink-0"
            >
              Chapter {currentChapterIndex + 1} /{' '}
              {narrativeData.epicNarrative.length}
            </h2>
            <div
              className="flex items-start gap-x-4 mb-4 overflow-y-auto custom-scrollbar flex-grow"
              style={{ minHeight: '14rem' }}
            >
              <div className="text-4xl sm:text-5xl leading-none pt-1 shrink-0">
                {currentChapter.chapterEmoji}
              </div>
              <div className="text-md sm:text-lg text-[rgb(var(--color-text-emphasis))] leading-relaxed flex-grow pr-1">
                {currentChapter.chapterStory}
              </div>
            </div>
          </>
        ) : (
          <PreNarrativeContent toolDirective={toolDirective} />
        )}

        {/* Footer: Progress Bar & Tool Name */}
        <div className="mt-auto shrink-0 pt-4">
          {' '}
          {/* Added pt-4 for spacing from content above */}
          <div className="w-full bg-[rgb(var(--color-bg-neutral))] rounded-full h-2 mb-2">
            <div
              className="bg-[rgb(var(--color-button-primary-bg))] h-2 rounded-full transition-all duration-1000 ease-linear"
              style={{
                width:
                  displayNarrative && narrativeData
                    ? `${((currentChapterIndex + 1) / narrativeData.epicNarrative.length) * 100}%`
                    : '0%',
                transitionProperty: 'width',
              }}
              role="progressbar"
              aria-valuenow={
                displayNarrative && narrativeData
                  ? ((currentChapterIndex + 1) /
                      narrativeData.epicNarrative.length) *
                    100
                  : 0
              }
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Narrative progress"
            ></div>
          </div>
          <p className="text-xs text-center text-[rgb(var(--color-text-muted))] ext-[rgb(var(--color-text-disabled))]">
            {displayNarrative && narrativeData
              ? `OET AI is crafting your tool: `
              : `Preparing mission for: `}
            <strong className="text-[rgb(var(--color-text-subtle))] ext-[rgb(var(--color-text-muted))]">
              {toolDirective}
            </strong>
          </p>
        </div>
      </div>
    </div>
  );
}
