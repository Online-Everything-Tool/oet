'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

import useToolState from '@/app/tool/_hooks/useToolState';
import useToolUrlState from '@/app/tool/_hooks/useToolUrlState';
import useItdeTargetHandler, {
  IncomingSignal,
} from '@/app/tool/_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import { useMetadata } from '@/app/context/MetadataContext';

import Textarea from '@/app/tool/_components/form/Textarea';
import Button from '@/app/tool/_components/form/Button';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '@/app/tool/_components/shared/ReceiveItdeDataTrigger';
import SendToToolButton from '@/app/tool/_components/shared/SendToToolButton';

import type { StoredFile } from '@/src/types/storage';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import importedMetadata from '../metadata.json';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { XCircleIcon } from '@heroicons/react/24/solid';

const metadata = importedMetadata as ToolMetadata;
const AUTO_PROCESS_DEBOUNCE_MS = 250;

interface ToolState {
  markdownInput: string;
  outputHtml: string;
  lastLoadedFilename?: string | null;
}

const DEFAULT_STATE: ToolState = {
  markdownInput: '# Hello, Markdown!\n\nThis is a real-time preview.\n\n- Type on the left.\n- See the result on the right.',
  outputHtml: '',
  lastLoadedFilename: null,
};

interface MarkdownHtmlPreviewClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function MarkdownHtmlPreviewClient({
  urlStateParams,
  toolRoute,
}: MarkdownHtmlPreviewClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    saveStateNow,
  } = useToolState<ToolState>(toolRoute, DEFAULT_STATE);

  const { urlState, urlParamsLoaded, urlProvidedAnyValue } =
    useToolUrlState(urlStateParams);

  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const { getToolMetadata } = useMetadata();
  const directiveName = metadata.directive;
  const initialLoadComplete = useRef(false);

  const processMarkdown = useCallback(
    (markdown: string) => {
      if (typeof window === 'undefined') return;
      try {
        const rawHtml = marked.parse(markdown, { gfm: true, breaks: true });
        const sanitizedHtml = DOMPurify.sanitize(rawHtml);
        setToolState((prev) => ({ ...prev, outputHtml: sanitizedHtml }));
        if (clientError) setClientError(null);
      } catch (error) {
        console.error('Markdown processing error:', error);
        setClientError(
          `Error processing Markdown: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    [setToolState, clientError]
  );

  const debouncedProcessMarkdown = useDebouncedCallback(
    processMarkdown,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  useEffect(() => {
    if (!isLoadingState) {
      debouncedProcessMarkdown(toolState.markdownInput);
    }
  }, [toolState.markdownInput, isLoadingState, debouncedProcessMarkdown]);

  useEffect(() => {
    if (urlParamsLoaded && !isLoadingState && !initialLoadComplete.current) {
      if (urlProvidedAnyValue && typeof urlState.markdown === 'string') {
        setToolState({
          markdownInput: urlState.markdown,
          lastLoadedFilename: '(from URL)',
          outputHtml: '', // Initialize outputHtml
        });
        processMarkdown(urlState.markdown); // Process markdown immediately after setting state
      }
      initialLoadComplete.current = true;
    }
  }, [
    urlParamsLoaded,
    isLoadingState,
    urlProvidedAnyValue,
    urlState,
    setToolState,
    processMarkdown, // Add processMarkdown to the dependency array
  ]);

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      setClientError(null);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setClientError(`Metadata not found for source: ${signal.sourceToolTitle}`);
        return;
      }

      const resolvedPayload: ResolvedItdeData = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );

      if (resolvedPayload.type !== 'itemList' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
        setClientError(resolvedPayload.errorMessage || 'No data received.');
        return;
      }

      const firstTextItem = resolvedPayload.data.find(item => item.type.startsWith('text/'));
      if (!firstTextItem) {
        setClientError('Received data is not compatible text.');
        return;
      }

      try {
        const text = await firstTextItem.blob.text();
        const loadedFilename = 'filename' in firstTextItem ? (firstTextItem as StoredFile).filename : '(from tool)';
        setToolState({ markdownInput: text, lastLoadedFilename: loadedFilename, outputHtml: '' });
        await saveStateNow({ ...toolState, markdownInput: text, lastLoadedFilename: loadedFilename, outputHtml: '' });
        processMarkdown(text);
      } catch (e) {
        setClientError(`Error reading received data: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    },
    [getToolMetadata, setToolState, saveStateNow, toolState, processMarkdown]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingState && initialLoadComplete.current && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredAutoPopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingState, itdeTarget, userDeferredAutoPopup]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({
      markdownInput: event.target.value,
      lastLoadedFilename: null,
    });
  };

  const handleFileSelected = useCallback(async (files: StoredFile[]) => {
    setIsLoadFileModalOpen(false);
    if (files.length === 0) return;
    const file = files[0];
    try {
      const text = await file.blob.text();
      setToolState({ markdownInput: text, lastLoadedFilename: file.filename, outputHtml: '' });
      processMarkdown(text);
    } catch (e) {
      setClientError(`Error reading file: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }, [setToolState, processMarkdown]);

  const handleClear = () => {
    setToolState({ markdownInput: '', lastLoadedFilename: null, outputHtml: '' });
  };

  if (isLoadingState && !initialLoadComplete.current) {
    return <div className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Loading Markdown Previewer...</div>;
  }

  return (
    // ... rest of the component
  );
}
