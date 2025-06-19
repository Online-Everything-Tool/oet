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
        });
      }
      initialLoadComplete.current = true;
    }
  }, [
    urlParamsLoaded,
    isLoadingState,
    urlProvidedAnyValue,
    urlState,
    setToolState,
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
        setToolState({ markdownInput: text, lastLoadedFilename: loadedFilename });
        await saveStateNow({ ...toolState, markdownInput: text, lastLoadedFilename: loadedFilename });
      } catch (e) {
        setClientError(`Error reading received data: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    },
    [getToolMetadata, setToolState, saveStateNow, toolState]
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
      setToolState({ markdownInput: text, lastLoadedFilename: file.filename });
    } catch (e) {
      setClientError(`Error reading file: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }, [setToolState]);

  const handleClear = () => {
    setToolState({ markdownInput: '', lastLoadedFilename: null });
  };

  if (isLoadingState && !initialLoadComplete.current) {
    return <div className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Loading Markdown Previewer...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <style>{`
        .markdown-preview {
          padding: 1rem;
          border-radius: 0.375rem;
          border: 1px solid rgb(var(--color-border-base));
          background-color: rgb(var(--color-bg-subtle));
          min-height: 20rem;
          color: rgb(var(--color-text-base));
          overflow-wrap: break-word;
        }
        .markdown-preview > *:first-child { margin-top: 0; }
        .markdown-preview > *:last-child { margin-bottom: 0; }
        .markdown-preview h1, .markdown-preview h2, .markdown-preview h3, .markdown-preview h4, .markdown-preview h5, .markdown-preview h6 {
          font-weight: 600;
          line-height: 1.25;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          border-bottom: 1px solid rgb(var(--color-border-soft));
          padding-bottom: 0.3em;
        }
        .markdown-preview h1 { font-size: 2em; }
        .markdown-preview h2 { font-size: 1.5em; }
        .markdown-preview h3 { font-size: 1.25em; }
        .markdown-preview p { margin-bottom: 1em; line-height: 1.6; }
        .markdown-preview ul, .markdown-preview ol { margin-left: 1.5rem; margin-bottom: 1em; }
        .markdown-preview li { margin-bottom: 0.25em; }
        .markdown-preview blockquote {
          border-left: 4px solid rgb(var(--color-border-soft));
          padding-left: 1rem;
          color: rgb(var(--color-text-muted));
          margin: 1em 0;
        }
        .markdown-preview code {
          font-family: var(--font-geist-mono);
          background-color: rgb(var(--color-bg-neutral));
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-size: 85%;
        }
        .markdown-preview pre {
          background-color: rgb(var(--color-bg-neutral));
          padding: 1rem;
          border-radius: 0.375rem;
          overflow-x: auto;
          margin-bottom: 1em;
        }
        .markdown-preview pre code {
          background-color: transparent;
          padding: 0;
          font-size: 100%;
        }
        .markdown-preview table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 1em;
        }
        .markdown-preview th, .markdown-preview td {
          border: 1px solid rgb(var(--color-border-soft));
          padding: 0.5rem;
        }
        .markdown-preview th {
          background-color: rgb(var(--color-bg-subtle));
        }
        .markdown-preview a {
          color: rgb(var(--color-text-link));
          text-decoration: underline;
        }
      `}</style>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label htmlFor="markdown-input" className="font-medium text-[rgb(var(--color-text-muted))]">
              Markdown Input
              {toolState.lastLoadedFilename && (
                <span className="ml-2 text-xs italic">({toolState.lastLoadedFilename})</span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <ReceiveItdeDataTrigger
                hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
                pendingSignalCount={itdeTarget.pendingSignals.length}
                onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
              />
              <Button
                variant="neutral-outline"
                size="sm"
                onClick={() => setIsLoadFileModalOpen(true)}
                iconLeft={<ArrowUpTrayIcon className="h-4 w-4" />}
              >
                Load
              </Button>
            </div>
          </div>
          <Textarea
            id="markdown-input"
            value={toolState.markdownInput}
            onChange={handleInputChange}
            placeholder="Type your Markdown here..."
            rows={20}
            className="h-full"
            textareaClassName="h-full resize-y text-base"
            spellCheck="false"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="font-medium text-[rgb(var(--color-text-muted))]">HTML Preview</label>
          <div
            className="markdown-preview h-full"
            dangerouslySetInnerHTML={{ __html: toolState.outputHtml }}
          />
        </div>
      </div>
      <div className="flex justify-end items-center gap-3 p-2 border-t border-[rgb(var(--color-border-base))]">
        <Button
          variant="neutral"
          onClick={handleClear}
          disabled={!toolState.markdownInput}
          iconLeft={<XCircleIcon className="h-5 w-5" />}
        >
          Clear
        </Button>
        <SendToToolButton
          currentToolDirective={directiveName}
          currentToolOutputConfig={metadata.outputConfig}
          onBeforeSignal={() => saveStateNow()}
        />
      </div>

      <FileSelectionModal
        isOpen={isLoadFileModalOpen}
        onClose={() => setIsLoadFileModalOpen(false)}
        onFilesSelected={handleFileSelected}
        accept="text/plain,text/markdown,.md,.txt"
        selectionMode="single"
        mode="selectExistingOrUploadNew"
        libraryFilter={{ category: 'text' }}
        initialTab="upload"
      />
      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={itdeTarget.acceptSignal}
        onIgnore={itdeTarget.ignoreSignal}
        onDeferAll={() => {
          setUserDeferredAutoPopup(true);
          itdeTarget.closeModal();
        }}
        onIgnoreAll={itdeTarget.ignoreAllSignals}
      />
    </div>
  );
}