'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import {
  ClipboardDocumentIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useDebounce } from 'use-debounce';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import importedMetadata from '../metadata.json';
import { StoredFile } from '@/src/types/storage';


interface TextWhitespaceRemoverToolState {
  inputText: string;
  outputText: string;
  lastLoadedFilename?: string | null;
}

const DEFAULT_TEXT_WHITESPACE_REMOVER_STATE: TextWhitespaceRemoverToolState = {
  inputText: '',
  outputText: '',
  lastLoadedFilename: null,
};

const metadata = importedMetadata as ToolMetadata;

interface TextWhitespaceRemoverClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function TextWhitespaceRemoverClient({
  urlStateParams,
  toolRoute,
}: TextWhitespaceRemoverClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    errorLoadingState,
    saveStateNow,
  } = useToolState<TextWhitespaceRemoverToolState>(toolRoute, DEFAULT_TEXT_WHITESPACE_REMOVER_STATE);

  const [isCopied, setIsCopied] = useState(false);
  const [debouncedInputText] = useDebounce(toolState.inputText, 300);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialUrlLoadProcessedRef = useRef(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const { getToolMetadata } = useMetadata();
  const directiveName = metadata.directive;

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        return;
      }

      const resolvedPayload: ResolvedItdeData = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );

      if (
        resolvedPayload.type === 'error' ||
        resolvedPayload.type === 'none' ||
        !resolvedPayload.data ||
        resolvedPayload.data.length === 0
      ) {
        return;
      }

      let newText = '';
      const firstItem = resolvedPayload.data.find((item) => item.type?.startsWith('text/'));
      let loadedFilename: string | null = null;

      if (firstItem) {
        try {
          newText = await firstItem.blob.text();
          if ('id' in firstItem && 'name' in firstItem) {
            loadedFilename = (firstItem as StoredFile).filename;
          }
        } catch (e) {
          return;
        }
      } else {
        return;
      }

      setToolState({ inputText: newText, outputText: '', lastLoadedFilename: loadedFilename });
      setUserDeferredAutoPopup(false);
      setIsCopied(false);
    },
    [getToolMetadata, setToolState]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingState) {
      if (!initialToolStateLoadCompleteRef.current) {
        initialToolStateLoadCompleteRef.current = true;
      }
    } else {
      if (initialToolStateLoadCompleteRef.current) {
        initialToolStateLoadCompleteRef.current = false;
      }
    }
  }, [isLoadingState]);

  useEffect(() => {
    const canProceed =
      !isLoadingState && initialToolStateLoadCompleteRef.current;
    if (
      canProceed &&
      itdeTarget.pendingSignals.length > 0 &&
      !itdeTarget.isModalOpen &&
      !userDeferredAutoPopup
    ) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingState, itdeTarget, userDeferredAutoPopup, directiveName]);


  useEffect(() => {
    if (
      isLoadingState ||
      initialUrlLoadProcessedRef.current ||
      !urlStateParams ||
      urlStateParams.length === 0
    ) {
      if (!isLoadingState && !initialUrlLoadProcessedRef.current && initialToolStateLoadCompleteRef.current) {
        initialUrlLoadProcessedRef.current = true;
      }
      return;
    }

    initialUrlLoadProcessedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const textParam = params.get('text');

    if (textParam) {
      setToolState({ inputText: textParam, lastLoadedFilename: '(from URL)' });
    }
  }, [isLoadingState, urlStateParams, setToolState]);

  useEffect(() => {
    const result = debouncedInputText.replace(/\s+/g, ' ');
    setToolState((prev) => ({ ...prev, outputText: result }));
  }, [debouncedInputText, setToolState]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({ inputText: event.target.value, lastLoadedFilename: null });
    setIsCopied(false);
  };

  const handleCopy = useCallback(() => {
    if (!toolState.outputText || !navigator.clipboard) return;
    navigator.clipboard.writeText(toolState.outputText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1500);
    });
  }, [toolState.outputText]);

  const handleClear = useCallback(async () => {
    setToolState({ inputText: '', outputText: '', lastLoadedFilename: null });
    await saveStateNow({ inputText: '', outputText: '', lastLoadedFilename: null });
    setIsCopied(false);
  }, [setToolState, saveStateNow]);

  const handleModalDeferAll = () => {
    setUserDeferredAutoPopup(true);
    itdeTarget.closeModal();
  };
  const handleModalIgnoreAll = () => {
    setUserDeferredAutoPopup(false);
    itdeTarget.ignoreAllSignals();
  };
  const handleModalAccept = (sourceDirective: string) => {
    itdeTarget.acceptSignal(sourceDirective);
  };
  const handleModalIgnore = (sourceDirective: string) => {
    itdeTarget.ignoreSignal(sourceDirective);
    if (
      itdeTarget.pendingSignals.filter(
        (s) => s.sourceDirective !== sourceDirective
      ).length === 0
    )
      setUserDeferredAutoPopup(false);
  };

  const canPerformOutputActions = toolState.outputText.trim() !== '';

  if (isLoadingState && !initialToolStateLoadCompleteRef.current) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading...
      </p>
    );
  }

  const displayError = errorLoadingState;

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="flex justify-between items-center gap-2">
        <label htmlFor="text-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
          Input Text:{' '}
          {toolState.lastLoadedFilename && (
            <span className="ml-2 text-xs italic">
              ({toolState.lastLoadedFilename})
            </span>
          )}
        </label>
        <ReceiveItdeDataTrigger
          hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
          pendingSignalCount={itdeTarget.pendingSignals.length}
          onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
        />
      </div>
      <Textarea
        id="text-input"
        value={toolState.inputText}
        onChange={handleInputChange}
        placeholder="Enter text here..."
        aria-label="Input text area"
        textareaClassName="text-base font-mono"
      />
      {displayError && (
        <div
          role="alert"
          className="p-3 my-1 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm flex items-center gap-2"
        >
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {displayError}
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-center border border-[rgb(var(--color-border-base))] p-3 rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <OutputActionButtons
          canPerform={canPerformOutputActions}
          isSaveSuccess={false}
          isCopySuccess={isCopied}
          isDownloadSuccess={false}
          onInitiateSave={() => {}}
          onInitiateDownload={() => {}}
          onCopy={handleCopy}
          onClear={handleClear}
          directiveName={directiveName}
          outputConfig={metadata.outputConfig}
        />
      </div>

      <div className="gap-6 items-start">
        <div className="space-y-1 h-full flex flex-col">
          <label htmlFor="output-text" className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Output Text:
          </label>
          <Textarea
            id="output-text"
            value={toolState.outputText}
            readOnly
            placeholder="Output text will appear here..."
            textareaClassName="text-base font-mono bg-[rgb(var(--color-bg-subtle))]"
            aria-live="polite"
          />
        </div>
      </div>

      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={handleModalAccept}
        onIgnore={handleModalIgnore}
        onDeferAll={handleModalDeferAll}
        onIgnoreAll={handleModalIgnoreAll}
      />
    </div>
  );
}