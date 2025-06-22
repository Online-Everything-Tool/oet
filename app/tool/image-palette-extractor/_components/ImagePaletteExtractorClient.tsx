'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import useToolState from '@/app/tool/_hooks/useToolState';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata } from '@/src/types/tools';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import Button from '@/app/tool/_components/form/Button';
import Range from '@/app/tool/_components/form/Range';
import SendToToolButton from '@/app/tool/_components/shared/SendToToolButton';
import useItdeTargetHandler, {
  IncomingSignal,
} from '@/app/tool/_hooks/useItdeTargetHandler';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '@/app/tool/_components/shared/ReceiveItdeDataTrigger';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import { usePaletteExtractor, ColorInfo } from '../_hooks/usePaletteExtractor';
import {
  PhotoIcon,
  XCircleIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import importedMetadata from '../metadata.json';

const metadata = importedMetadata as ToolMetadata;

interface ImagePaletteExtractorToolState {
  selectedFileId: string | null;
  palette: ColorInfo[] | null;
  paletteJson: string | null;
  numColors: number;
  quality: number;
}

const DEFAULT_TOOL_STATE: ImagePaletteExtractorToolState = {
  selectedFileId: null,
  palette: null,
  paletteJson: null,
  numColors: 8,
  quality: 5,
};

export default function ImagePaletteExtractorClient({
  toolRoute,
}: {
  toolRoute: string;
}) {
  const {
    state: toolState,
    setState,
    isLoadingState,
    clearStateAndPersist,
    saveStateNow,
  } = useToolState<ImagePaletteExtractorToolState>(
    toolRoute,
    DEFAULT_TOOL_STATE
  );

  const { getFile, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const {
    isLoading: isExtracting,
    error: extractionError,
    extractPalette,
  } = usePaletteExtractor();

  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const directiveName = metadata.directive;

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      setUiError(null);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setUiError('Metadata not found for source tool.');
        return;
      }
      const resolvedPayload: ResolvedItdeData = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );
      if (
        resolvedPayload.type === 'error' ||
        !resolvedPayload.data ||
        resolvedPayload.data.length === 0
      ) {
        setUiError(
          resolvedPayload.errorMessage ||
            'No transferable data received from source.'
        );
        return;
      }
      const firstImageItem = resolvedPayload.data.find(
        (item) => item.type?.startsWith('image/') && 'id' in item
      ) as StoredFile | undefined;
      if (firstImageItem?.id) {
        const oldSelectedId = toolState.selectedFileId;
        const newState: Partial<ImagePaletteExtractorToolState> = {
          selectedFileId: firstImageItem.id,
          palette: null,
          paletteJson: null,
        };
        setState(newState);
        await saveStateNow({ ...toolState, ...newState });
        if (oldSelectedId && oldSelectedId !== firstImageItem.id) {
          cleanupOrphanedTemporaryFiles([oldSelectedId]).catch((e) =>
            console.error('[PaletteExtractor ITDE] Cleanup failed:', e)
          );
        }
      } else {
        setUiError('No valid image found in received ITDE data.');
      }
      setUserDeferredAutoPopup(false);
    },
    [
      getToolMetadata,
      setState,
      saveStateNow,
      toolState,
      cleanupOrphanedTemporaryFiles,
    ]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingState) {
      if (!initialToolStateLoadCompleteRef.current)
        initialToolStateLoadCompleteRef.current = true;
    } else {
      if (initialToolStateLoadCompleteRef.current)
        initialToolStateLoadCompleteRef.current = false;
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
  }, [isLoadingState, itdeTarget, userDeferredAutoPopup]);

  useEffect(() => {
    if (!toolState.selectedFileId) {
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
      setImageObjectUrl(null);
      return;
    }

    setIsImageLoading(true);
    setUiError(null);
    let newObjectUrl: string | null = null;

    getFile(toolState.selectedFileId)
      .then((file) => {
        if (!file?.blob)
          throw new Error('Selected file or its blob not found.');
        newObjectUrl = URL.createObjectURL(file.blob);
        setImageObjectUrl(newObjectUrl);
      })
      .catch((err) => {
        setUiError(
          err instanceof Error ? err.message : 'Error loading image file.'
        );
        if (newObjectUrl) URL.revokeObjectURL(newObjectUrl);
        setImageObjectUrl(null);
      })
      .finally(() => setIsImageLoading(false));

    return () => {
      if (newObjectUrl) URL.revokeObjectURL(newObjectUrl);
      if (imageObjectUrl && imageObjectUrl !== newObjectUrl)
        URL.revokeObjectURL(imageObjectUrl);
    };
  }, [toolState.selectedFileId, getFile]);

  const handleFilesSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLibraryModalOpen(false);
      setUiError(null);
      if (files?.[0]?.type?.startsWith('image/') && files[0].id) {
        const oldSelectedId = toolState.selectedFileId;
        const newState: Partial<ImagePaletteExtractorToolState> = {
          selectedFileId: files[0].id,
          palette: null,
          paletteJson: null,
        };
        setState(newState);
        await saveStateNow({ ...toolState, ...newState });
        if (oldSelectedId && oldSelectedId !== files[0].id) {
          cleanupOrphanedTemporaryFiles([oldSelectedId]).catch((e) =>
            console.error('[PaletteExtractor Select] Cleanup failed:', e)
          );
        }
      } else if (files?.length) {
        setUiError(
          `Selected file "${files[0].filename}" is not a recognized image type or has no ID.`
        );
      }
    },
    [toolState, setState, saveStateNow, cleanupOrphanedTemporaryFiles]
  );

  const handleGeneratePalette = useCallback(async () => {
    if (!toolState.selectedFileId) {
      setUiError('Please select an image first.');
      return;
    }
    const file = await getFile(toolState.selectedFileId);
    if (!file?.blob) {
      setUiError('Image data could not be loaded.');
      return;
    }
    const newPalette = await extractPalette(file.blob, {
      colorCount: toolState.numColors,
      quality: toolState.quality,
    });
    if (newPalette) {
      setState({
        palette: newPalette,
        paletteJson: JSON.stringify(newPalette, null, 2),
      });
    }
  }, [
    toolState.selectedFileId,
    toolState.numColors,
    toolState.quality,
    getFile,
    extractPalette,
    setState,
  ]);

  const handleCopy = useCallback(async (textToCopy: string, key: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedStates((prev) => ({ ...prev, [key]: true }));
      setTimeout(
        () => setCopiedStates((prev) => ({ ...prev, [key]: false })),
        2000
      );
    } catch (err) {
      setUiError('Failed to copy to clipboard.');
    }
  }, []);

  const handleClear = useCallback(async () => {
    const oldSelectedId = toolState.selectedFileId;
    await clearStateAndPersist();
    setUiError(null);
    setCopiedStates({});
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    setImageObjectUrl(null);
    if (oldSelectedId) {
      cleanupOrphanedTemporaryFiles([oldSelectedId]).catch((e) =>
        console.error('[PaletteExtractor Clear] Cleanup failed:', e)
      );
    }
  }, [
    clearStateAndPersist,
    imageObjectUrl,
    toolState.selectedFileId,
    cleanupOrphanedTemporaryFiles,
  ]);

  const onBeforeSignalSend = useCallback(async () => {
    if (!toolState.paletteJson) return false;
    await saveStateNow();
    return true;
  }, [toolState.paletteJson, saveStateNow]);

  const isLoading = isLoadingState || isImageLoading || isExtracting;
  const error = uiError || extractionError;

  if (isLoadingState && !initialToolStateLoadCompleteRef.current) {
    return (
      <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">
        Loading Palette Extractor...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="flex flex-col gap-4 p-4 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="lg:col-span-1">
            <Button
              variant="accent2"
              iconLeft={<PhotoIcon className="h-5 w-5" />}
              onClick={() => setIsLibraryModalOpen(true)}
              disabled={isLoading}
              fullWidth
            >
              {toolState.selectedFileId ? 'Change Image' : 'Select Image'}
            </Button>
          </div>
          <div className="lg:col-span-1">
            <Range
              label="Number of Colors"
              id="numColors"
              min={2}
              max={32}
              step={1}
              value={toolState.numColors}
              onChange={(e) => setState({ numColors: Number(e.target.value) })}
              disabled={isLoading}
            />
          </div>
          <div className="lg:col-span-1">
            <Range
              label="Quality / Speed"
              id="quality"
              min={1}
              max={10}
              step={1}
              value={toolState.quality}
              onChange={(e) => setState({ quality: Number(e.target.value) })}
              disabled={isLoading}
            />
          </div>
          <div className="lg:col-span-1">
            <Button
              variant="primary"
              onClick={handleGeneratePalette}
              disabled={!toolState.selectedFileId || isLoading}
              isLoading={isExtracting}
              iconLeft={<ArrowPathIcon className="h-5 w-5" />}
              fullWidth
            >
              Generate Palette
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center pt-3 border-t border-[rgb(var(--color-border-base))] mt-2">
          <ReceiveItdeDataTrigger
            hasDeferredSignals={
              itdeTarget.pendingSignals.length > 0 &&
              userDeferredAutoPopup &&
              !itdeTarget.isModalOpen
            }
            pendingSignalCount={itdeTarget.pendingSignals.length}
            onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
          />
          <div className="flex gap-2 ml-auto items-center">
            {toolState.palette && (
              <SendToToolButton
                currentToolDirective={directiveName}
                currentToolOutputConfig={metadata.outputConfig}
                onBeforeSignal={onBeforeSignalSend}
                buttonText="Send Palette"
              />
            )}
            <Button
              variant="neutral"
              onClick={handleClear}
              iconLeft={<XCircleIcon className="h-5 w-5" />}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong> {error}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Image Preview
          </h3>
          <div className="w-full aspect-video border rounded-md bg-[rgb(var(--color-bg-neutral))] flex items-center justify-center overflow-hidden">
            {isImageLoading ? (
              <p className="text-sm italic text-[rgb(var(--color-text-muted))]">
                Loading image...
              </p>
            ) : imageObjectUrl ? (
              <Image
                src={imageObjectUrl}
                alt="Selected image"
                width={400}
                height={300}
                className="max-w-full max-h-full object-contain"
                unoptimized
              />
            ) : (
              <p className="text-sm italic text-[rgb(var(--color-text-muted))]">
                No image selected
              </p>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Extracted Palette
          </h3>
          <div className="w-full aspect-video border rounded-md bg-[rgb(var(--color-bg-component))] p-3 overflow-y-auto">
            {isExtracting ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm italic text-[rgb(var(--color-text-muted))]">
                  Extracting colors...
                </p>
              </div>
            ) : toolState.palette ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {toolState.palette.map((color, index) => (
                    <div
                      key={index}
                      style={{ backgroundColor: color.hex }}
                      className="w-10 h-10 rounded border border-black/20"
                      title={color.hex}
                    ></div>
                  ))}
                </div>
                <div className="flex-grow space-y-1.5 pt-2 border-t border-[rgb(var(--color-border-base))]">
                  {toolState.palette.map((color, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-xs font-mono"
                    >
                      <div
                        style={{ backgroundColor: color.hex }}
                        className="w-4 h-4 rounded-sm border border-black/20 flex-shrink-0"
                      ></div>
                      <span className="w-16">{color.hex}</span>
                      <span className="w-32 text-[rgb(var(--color-text-muted))]">{`rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`}</span>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => handleCopy(color.hex, `hex-${index}`)}
                        className="!p-0.5"
                        title={
                          copiedStates[`hex-${index}`] ? 'Copied!' : 'Copy HEX'
                        }
                      >
                        {copiedStates[`hex-${index}`] ? (
                          <CheckIcon className="h-3 w-3 text-[rgb(var(--color-status-success))]" />
                        ) : (
                          <ClipboardDocumentIcon className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
                {toolState.paletteJson && (
                  <div className="pt-2 mt-auto">
                    <Button
                      variant="neutral-outline"
                      size="sm"
                      onClick={() => handleCopy(toolState.paletteJson!, 'json')}
                      iconLeft={
                        copiedStates['json'] ? (
                          <CheckIcon className="h-4 w-4" />
                        ) : (
                          <ClipboardDocumentIcon className="h-4 w-4" />
                        )
                      }
                    >
                      {copiedStates['json']
                        ? 'Copied JSON'
                        : 'Copy Palette as JSON'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm italic text-[rgb(var(--color-text-muted))]">
                  Palette will appear here
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <FileSelectionModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        onFilesSelected={handleFilesSelectedFromModal}
        mode="selectExistingOrUploadNew"
        initialTab="upload"
        accept="image/*"
        selectionMode="single"
        libraryFilter={{ category: 'image' }}
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
        onIgnoreAll={() => {
          setUserDeferredAutoPopup(false);
          itdeTarget.ignoreAllSignals();
        }}
      />
    </div>
  );
}
