'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useToolState from '../../_hooks/useToolState';
import useImageEyeDropperLogic, { PickedColorData } from '../_hooks/useImageEyeDropperLogic';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata } from '@/src/types/tools';

import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import Button from '@/app/tool/_components/form/Button';
import SendToToolButton from '../../_components/shared/SendToToolButton';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';

import { PhotoIcon, XCircleIcon, ClipboardDocumentIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

import importedMetadata from '../metadata.json';

const metadata = importedMetadata as ToolMetadata;

interface ImageEyeDropperToolState {
  selectedFileId: string | null;
  pickedColorHex: string | null;
  pickedColorRgb: string | null;
}

const DEFAULT_TOOL_STATE: ImageEyeDropperToolState = {
  selectedFileId: null,
  pickedColorHex: null,
  pickedColorRgb: null,
};

interface ImageEyeDropperClientProps {
  toolRoute: string;
}

export default function ImageEyeDropperClient({ toolRoute }: ImageEyeDropperClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    clearStateAndPersist,
    saveStateNow,
  } = useToolState<ImageEyeDropperToolState>(toolRoute, DEFAULT_TOOL_STATE);

  const {
    canvasRef,
    isLoadingImage: isLoadingHookImage,
    imageError: hookImageError,
    pickedColorData: hookPickedColorData,
    handleCanvasClick,
    clearLogicState: clearHookLogicState,
    imageNaturalDimensions,
  } = useImageEyeDropperLogic(toolState.selectedFileId);

  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [copiedStatus, setCopiedStatus] = useState<'hex' | 'rgb' | null>(null);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);

  const { getFile, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  useEffect(() => {
    if (hookImageError) {
      setUiError(hookImageError);
    } else {
      setUiError(null); // Clear UI error if hook error resolves
    }
  }, [hookImageError]);

  useEffect(() => {
    if (hookPickedColorData) {
      setToolState(prev => ({
        ...prev,
        pickedColorHex: hookPickedColorData.hex,
        pickedColorRgb: hookPickedColorData.rgbString,
      }));
    } else if (toolState.pickedColorHex || toolState.pickedColorRgb) {
      // If hook clears color, clear it in toolState too
      setToolState(prev => ({
        ...prev,
        pickedColorHex: null,
        pickedColorRgb: null,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hookPickedColorData]); // Only react to hookPickedColorData, setToolState is stable

  const handleFilesSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsLibraryModalOpen(false);
    setUiError(null);
    if (files?.[0]?.id && files[0].type?.startsWith('image/')) {
      const oldSelectedId = toolState.selectedFileId;
      const newSelectedId = files[0].id;

      if (oldSelectedId === newSelectedId) return;

      const newState: ImageEyeDropperToolState = {
        ...DEFAULT_TOOL_STATE, // Reset colors when new image is selected
        selectedFileId: newSelectedId,
      };
      setToolState(newState);
      await saveStateNow(newState); // Persist immediately
      clearHookLogicState(); // Ensure hook resets its internal state for the new image

      if (oldSelectedId && oldSelectedId !== newSelectedId) {
        const oldFile = await getFile(oldSelectedId);
        if (oldFile?.isTemporary) {
          cleanupOrphanedTemporaryFiles([oldSelectedId]).catch(e => console.error("Cleanup failed:", e));
        }
      }
    } else if (files?.length) {
      setUiError(`Selected file "${files[0].filename}" is not a valid image.`);
    }
  }, [toolState.selectedFileId, setToolState, saveStateNow, clearHookLogicState, getFile, cleanupOrphanedTemporaryFiles]);

  const handleClear = useCallback(async () => {
    await clearStateAndPersist(); // This resets toolState to DEFAULT_TOOL_STATE and persists
    clearHookLogicState();
    setUiError(null);
    setCopiedStatus(null);
  }, [clearStateAndPersist, clearHookLogicState]);

  const handleCopy = useCallback(async (type: 'hex' | 'rgb') => {
    const textToCopy = type === 'hex' ? toolState.pickedColorHex : toolState.pickedColorRgb;
    if (!textToCopy) {
      setUiError(`No ${type.toUpperCase()} color to copy.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedStatus(type);
      setUiError(null);
      setTimeout(() => setCopiedStatus(null), 2000);
    } catch (err) {
      setUiError(`Failed to copy ${type.toUpperCase()} color.`);
      console.error('Copy failed:', err);
    }
  }, [toolState.pickedColorHex, toolState.pickedColorRgb]);

  const handleProcessIncomingSignal = useCallback(async (signal: IncomingSignal) => {
    setUiError(null);
    const sourceMeta = getToolMetadata(signal.sourceDirective);
    if (!sourceMeta) {
      setUiError('Metadata not found for source tool.');
      return;
    }
    const resolvedPayload: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);

    if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
      setUiError(resolvedPayload.errorMessage || 'No transferable data received.');
      return;
    }

    const firstImageFile = resolvedPayload.data.find(item => item.type?.startsWith('image/') && 'id' in item) as StoredFile | undefined;

    if (firstImageFile?.id) {
      const oldSelectedId = toolState.selectedFileId;
      const newSelectedId = firstImageFile.id;

      if (oldSelectedId === newSelectedId) return;

      const newState: ImageEyeDropperToolState = {
        ...DEFAULT_TOOL_STATE,
        selectedFileId: newSelectedId,
      };
      setToolState(newState);
      await saveStateNow(newState);
      clearHookLogicState();

      if (oldSelectedId && oldSelectedId !== newSelectedId) {
         const oldFile = await getFile(oldSelectedId);
        if (oldFile?.isTemporary) {
          cleanupOrphanedTemporaryFiles([oldSelectedId]).catch(e => console.error("Cleanup failed:", e));
        }
      }
      setUserDeferredAutoPopup(false); // Processed signal, so allow auto-popup for next ones
    } else {
      setUiError('Received data does not contain a usable image file.');
    }
  }, [getToolMetadata, toolState.selectedFileId, setToolState, saveStateNow, clearHookLogicState, getFile, cleanupOrphanedTemporaryFiles]);

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: metadata.directive,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingToolState && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredAutoPopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingToolState, itdeTarget, userDeferredAutoPopup]);
  
  const imageFilter = useMemo(() => ({ category: 'image' as const }), []);

  const onBeforeSignalSend = useCallback(async () => {
    if (!toolState.pickedColorHex) {
      setUiError('Please pick a color first before sending.');
      return false;
    }
    setUiError(null);
    return true;
  }, [toolState.pickedColorHex]);

  const isLoading = isLoadingToolState || isLoadingHookImage;

  if (isLoadingToolState && !toolState.selectedFileId) { // Show loading only on initial full state load
     return <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Loading Image Eye Dropper...</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <Button
          variant="primary"
          iconLeft={<PhotoIcon className="h-5 w-5" />}
          onClick={() => setIsLibraryModalOpen(true)}
          disabled={isLoadingHookImage}
        >
          {toolState.selectedFileId ? 'Change Image' : 'Select Image'}
        </Button>
        <div className="flex items-center gap-2">
           <ReceiveItdeDataTrigger
              hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
          {toolState.selectedFileId && (
            <Button
              variant="neutral"
              onClick={handleClear}
              iconLeft={<XCircleIcon className="h-5 w-5" />}
              disabled={isLoadingHookImage}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {uiError && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm">
          <strong>Error:</strong> {uiError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div className="md:col-span-2 border border-[rgb(var(--color-border-base))] rounded-md p-2 bg-[rgb(var(--color-bg-page))] min-h-[200px] flex items-center justify-center overflow-auto max-h-[70vh]">
          {isLoadingHookImage && <ArrowPathIcon className="h-8 w-8 animate-spin text-[rgb(var(--color-text-link))]" />}
          {!isLoadingHookImage && !toolState.selectedFileId && !uiError && (
            <p className="text-center text-[rgb(var(--color-text-muted))]">Upload an image to start picking colors.</p>
          )}
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={`${toolState.selectedFileId && !isLoadingHookImage && !hookImageError ? 'cursor-crosshair' : 'cursor-default'} max-w-full max-h-full block`}
            style={{ display: (toolState.selectedFileId && !isLoadingHookImage && !hookImageError) ? 'block' : 'none' }}
          />
        </div>

        <div className="space-y-4 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
          <h3 className="text-lg font-semibold text-[rgb(var(--color-text-base))]">Picked Color</h3>
          {toolState.pickedColorHex ? (
            <>
              <div
                className="w-full h-24 rounded border border-[rgb(var(--color-border-base))]"
                style={{ backgroundColor: toolState.pickedColorHex }}
                title={`Color Preview: ${toolState.pickedColorHex}`}
              ></div>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">HEX</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={toolState.pickedColorHex}
                      className="w-full p-2 border rounded-md bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] font-mono text-sm"
                      aria-label="Picked HEX color"
                    />
                    <Button
                      variant="neutral"
                      size="sm"
                      onClick={() => handleCopy('hex')}
                      iconLeft={copiedStatus === 'hex' ? <CheckIcon className="h-4 w-4" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
                      title={copiedStatus === 'hex' ? 'Copied!' : 'Copy HEX'}
                    >
                      {copiedStatus === 'hex' ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">RGB</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={toolState.pickedColorRgb || ''}
                      className="w-full p-2 border rounded-md bg-[rgb(var(--color-input-bg))] text-[rgb(var(--color-input-text))] font-mono text-sm"
                      aria-label="Picked RGB color"
                    />
                    <Button
                      variant="neutral"
                      size="sm"
                      onClick={() => handleCopy('rgb')}
                      iconLeft={copiedStatus === 'rgb' ? <CheckIcon className="h-4 w-4" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
                      title={copiedStatus === 'rgb' ? 'Copied!' : 'Copy RGB'}
                    >
                      {copiedStatus === 'rgb' ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
              </div>
              <SendToToolButton
                currentToolDirective={metadata.directive}
                currentToolOutputConfig={metadata.outputConfig}
                onBeforeSignal={onBeforeSignalSend}
                buttonText="Send Color To..."
                className="w-full"
              />
            </>
          ) : (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">
              {toolState.selectedFileId ? 'Click on the image to pick a color.' : 'No color picked yet.'}
            </p>
          )}
        </div>
      </div>

      <FileSelectionModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        onFilesSelected={handleFilesSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept="image/*"
        selectionMode="single"
        libraryFilter={imageFilter}
      />
      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={itdeTarget.acceptSignal}
        onIgnore={itdeTarget.ignoreSignal}
        onDeferAll={() => { setUserDeferredAutoPopup(true); itdeTarget.closeModal(); }}
        onIgnoreAll={() => { setUserDeferredAutoPopup(false); itdeTarget.ignoreAllSignals(); }}
      />
    </div>
  );
}