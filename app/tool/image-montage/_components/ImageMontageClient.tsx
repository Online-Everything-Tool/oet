// --- FILE: app/tool/image-montage/_components/ImageMontageClient.tsx ---
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import { useMontageState } from '../_hooks/useMontageState';
import { useMontageCanvas } from '../_hooks/useMontageCanvas';
import ImageAdjustmentCard from './ImageAdjustmentCard';
import MontageControls from './MontageControls';
import FileSelectionModal from '../../_components/FileSelectionModal';
import type { StoredFile } from '@/src/types/storage';
import RadioGroup from '../../_components/form/RadioGroup';
import type { MontageEffect } from '../_hooks/useMontageState';
import { XCircleIcon } from '@heroicons/react/20/solid'; // Import for error display

interface ImageMontageClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function ImageMontageClient({
  toolTitle,
  toolRoute,
}: ImageMontageClientProps) {
  const {
    montageImages,
    effect,
    addStoredFiles,
    clearMontage,
    handleTiltChange,
    handleOverlapChange,
    handleMoveImageLeft,
    handleMoveImageRight,
    handleMoveUp,
    handleMoveDown,
    handleEffectChange,
    isLoading: isProcessingState,
    error: stateProcessingError,
  } = useMontageState(toolTitle, toolRoute);

  const { canvasRef, generateMontageBlob } = useMontageCanvas(
    montageImages,
    effect
  );

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { addHistoryEntry } = useHistory();
  const { addImage } = useImageLibrary();

  const isLoading = isProcessingState || isActionLoading;
  const error = actionError || stateProcessingError;

  const clearError = useCallback(() => {
    setActionError(null);
  }, []);

  const handleFilesSelectedFromModal = useCallback(
    (
      files: StoredFile[],
      source: 'library' | 'upload',
      saveUploadedToLibrary?: boolean
    ) => {
      addStoredFiles(files);
      setIsModalOpen(false);
    },
    [addStoredFiles]
  );

  const handleSaveToLibrary = useCallback(async () => {
    setIsActionLoading(true);
    clearError();
    setIsSaved(false);
    const blob = await generateMontageBlob();
    let historyOutput: Record<string, unknown> = {};
    let status: 'success' | 'error' = 'success';
    let newImageId: string | undefined;
    let outputFileIds: string[] = [];
    if (blob) {
      const outputFileName = `oet-montage-${effect}-save-${Date.now()}.png`;
      try {
        newImageId = await addImage(blob, outputFileName, 'image/png', false); // Permanent save
        historyOutput = {
          message: `Saved ${effect} montage (${montageImages.length} images) to library.`,
          imageId: newImageId,
          fileName: outputFileName,
          fileSize: blob.size,
        };
        outputFileIds = [newImageId];
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      } catch (saveErr) {
        status = 'error';
        const message =
          saveErr instanceof Error
            ? saveErr.message
            : 'Failed to save to library';
        setActionError(message);
        historyOutput = {
          action: 'save',
          error: message,
          imageCount: montageImages.length,
          effect: effect,
          fileNameAttempted: outputFileName,
        };
      }
    } else {
      status = 'error';
      const message = 'Failed to generate montage blob for saving.';
      setActionError(message);
      historyOutput = {
        action: 'save',
        error: message,
        imageCount: montageImages.length,
        effect: effect,
      };
    }
    setIsActionLoading(false);
    addHistoryEntry({
      toolName: toolTitle,
      toolRoute: toolRoute,
      trigger: 'click',
      input: {
        action: 'save',
        imageCount: montageImages.length,
        effect: effect,
      },
      output: historyOutput,
      status: status,
      eventTimestamp: Date.now(),
      outputFileIds: outputFileIds,
    });
  }, [
    generateMontageBlob,
    addImage,
    montageImages.length,
    effect,
    addHistoryEntry,
    toolTitle,
    toolRoute,
    clearError,
  ]);

  const handleDownload = useCallback(async () => {
    setIsActionLoading(true);
    clearError();
    const blob = await generateMontageBlob();
    let historyOutput: Record<string, unknown> = {};
    let status: 'success' | 'error' = 'success';
    let newImageId: string | undefined;
    let saveErrorMsg: string | undefined;
    let outputFileIds: string[] = [];
    if (blob) {
      const outputFileName = `oet-montage-${effect}-download-${Date.now()}.png`;
      try {
        newImageId = await addImage(blob, outputFileName, 'image/png', true); // Temporary save for history
        outputFileIds = [newImageId];
      } catch (saveErr) {
        saveErrorMsg =
          saveErr instanceof Error ? saveErr.message : String(saveErr);
        console.error(
          '[MontageDownload] Failed to save temporary montage:',
          saveErrorMsg
        );
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = outputFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      if (newImageId) {
        historyOutput = {
          message: `Downloaded ${effect} montage (${montageImages.length} images). Temp copy saved.`,
          imageId: newImageId,
          fileName: outputFileName,
          fileSize: blob.size,
        };
      } else {
        historyOutput = {
          message: `Downloaded ${effect} montage (${montageImages.length} images). Save to library failed.`,
          error: saveErrorMsg,
          fileName: outputFileName,
          fileSize: blob.size,
        };
      }
    } else {
      status = 'error';
      const message = 'Failed to generate montage blob for download.';
      setActionError(message);
      historyOutput = {
        action: 'download',
        error: message,
        imageCount: montageImages.length,
        effect: effect,
      };
    }
    setIsActionLoading(false);
    addHistoryEntry({
      toolName: toolTitle,
      toolRoute: toolRoute,
      trigger: 'click',
      input: {
        action: 'download',
        imageCount: montageImages.length,
        effect: effect,
      },
      output: historyOutput,
      status: status,
      eventTimestamp: Date.now(),
      outputFileIds: outputFileIds,
    });
  }, [
    generateMontageBlob,
    addImage,
    montageImages.length,
    effect,
    addHistoryEntry,
    toolTitle,
    toolRoute,
    clearError,
  ]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!navigator.clipboard?.write) {
      const errorMsg = 'Clipboard API (write) not available or not permitted.';
      setActionError(errorMsg);
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: 'click',
        input: {
          action: 'copy',
          imageCount: montageImages.length,
          effect: effect,
        },
        output: { action: 'copy', error: errorMsg },
        status: 'error',
        eventTimestamp: Date.now(),
        outputFileIds: [],
      });
      return;
    }
    setIsActionLoading(true);
    clearError();
    setIsCopied(false);
    const blob = await generateMontageBlob();
    let historyOutput: Record<string, unknown> = {};
    let status: 'success' | 'error' = 'success';
    let newImageId: string | undefined;
    let saveErrorMsg: string | undefined;
    let outputFileIds: string[] = [];
    if (blob) {
      const outputFileName = `oet-montage-${effect}-copy-${Date.now()}.png`;
      try {
        newImageId = await addImage(blob, outputFileName, 'image/png', true); // Temporary save for history
        outputFileIds = [newImageId];
      } catch (saveErr) {
        saveErrorMsg =
          saveErr instanceof Error ? saveErr.message : String(saveErr);
        console.error(
          '[MontageCopy] Failed to save temporary montage:',
          saveErrorMsg
        );
      }
      try {
        const clipboardItem = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([clipboardItem]);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        if (newImageId) {
          historyOutput = {
            message: `Copied ${effect} montage (${montageImages.length} images). Temp copy saved.`,
            imageId: newImageId,
            fileName: outputFileName,
            fileSize: blob.size,
          };
        } else {
          historyOutput = {
            message: `Copied ${effect} montage (${montageImages.length} images). Save to library failed.`,
            error: saveErrorMsg,
            fileNameAttempted: outputFileName,
            fileSize: blob.size,
          };
        }
      } catch (clipboardError) {
        status = 'error';
        const message =
          clipboardError instanceof Error
            ? clipboardError.message
            : 'Unknown clipboard write error';
        console.error('Failed write clipboard:', clipboardError);
        setActionError(`Copy failed: ${message}`);
        historyOutput = {
          action: 'copy',
          error: message,
          underlyingSaveError: saveErrorMsg,
          imageCount: montageImages.length,
          effect: effect,
        };
      }
    } else {
      status = 'error';
      const message = 'Failed to generate montage blob for copy.';
      setActionError(message);
      historyOutput = {
        action: 'copy',
        error: message,
        imageCount: montageImages.length,
        effect: effect,
      };
    }
    setIsActionLoading(false);
    addHistoryEntry({
      toolName: toolTitle,
      toolRoute: toolRoute,
      trigger: 'click',
      input: {
        action: 'copy',
        imageCount: montageImages.length,
        effect: effect,
      },
      output: historyOutput,
      status: status,
      eventTimestamp: Date.now(),
      outputFileIds: outputFileIds,
    });
  }, [
    generateMontageBlob,
    addImage,
    montageImages.length,
    effect,
    addHistoryEntry,
    toolTitle,
    toolRoute,
    clearError,
  ]);

  const handleAdjustment = useCallback(
    (action: (...args: unknown[]) => void) =>
      (...args: unknown[]) => {
        setIsSaved(false);
        setIsCopied(false);
        action(...args);
      },
    []
  );

  const zIndexBounds = useMemo(() => {
    if (montageImages.length === 0) return { min: 0, max: 0 };
    const zIndexes = montageImages.map((img) => img.zIndex);
    const validZIndexes = zIndexes.filter(
      (z) => typeof z === 'number' && !isNaN(z)
    );
    if (validZIndexes.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...validZIndexes), max: Math.max(...validZIndexes) };
  }, [montageImages]);

  console.log(
    '[MontageClient Render] Received montageImages for rendering. Order:',
    montageImages.map((img) => ({ id: img.imageId, z: img.zIndex }))
  );

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      {/* MontageControls */}
      <MontageControls
        isLoading={isLoading}
        isProcessingFiles={isProcessingState}
        isSaved={isSaved}
        isCopied={isCopied}
        imageCount={montageImages.length}
        onAddClick={() => setIsModalOpen(true)}
        onClear={() => {
          clearMontage();
          setIsSaved(false);
          setIsCopied(false);
        }}
        onSave={handleSaveToLibrary}
        onDownload={handleDownload}
        onCopy={handleCopyToClipboard}
      />

      {/* Effect Radio Group */}
      <div className="p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <RadioGroup
          name="montageEffect"
          legend="Image Style:"
          options={[
            { value: 'polaroid', label: 'Polaroid' },
            { value: 'natural', label: 'Borderless (Natural)' },
          ]}
          selectedValue={effect}
          onChange={(newEffectValue) =>
            handleEffectChange(newEffectValue as MontageEffect)
          }
          layout="horizontal"
          disabled={isLoading}
          radioClassName="text-sm"
        />
      </div>

      {/* Error display */}
      {error && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          <XCircleIcon
            className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Image Adjustment Section */}
      {montageImages.length > 0 && (
        <div className="flex-shrink-0 pb-4 border-b border-[rgb(var(--color-border-base))]">
          <h2 className="text-base font-semibold mb-2 text-[rgb(var(--color-text-muted))]">
            Adjust & Reorder Images ({montageImages.length})
          </h2>
          <div className="flex space-x-4 overflow-x-auto py-2 px-1">
            {montageImages
              .map((img, index) => ({ ...img, originalIndex: index }))
              .sort((a, b) => a.originalIndex - b.originalIndex) // Render cards in layout order
              .map((img) => (
                <ImageAdjustmentCard
                  key={img.imageId} // Use temporary render key
                  image={img}
                  index={img.originalIndex} // Display layout index
                  isFirst={img.originalIndex === 0}
                  isLast={img.originalIndex === montageImages.length - 1}
                  isTop={
                    img.zIndex === zIndexBounds.max && montageImages.length > 1
                  }
                  isBottom={
                    img.zIndex === zIndexBounds.min && montageImages.length > 1
                  }
                  isLoading={isLoading}
                  onTiltChange={handleAdjustment(handleTiltChange)}
                  onOverlapChange={handleAdjustment(handleOverlapChange)}
                  onMoveLeft={handleAdjustment(() =>
                    handleMoveImageLeft(img.imageId)
                  )}
                  onMoveRight={handleAdjustment(() =>
                    handleMoveImageRight(img.imageId)
                  )}
                  onMoveUp={handleAdjustment(() => handleMoveUp(img.imageId))}
                  onMoveDown={handleAdjustment(() =>
                    handleMoveDown(img.imageId)
                  )}
                />
              ))}
          </div>
        </div>
      )}

      {/* Canvas Display Area */}
      <div className="flex-grow overflow-auto border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] p-2 min-h-[300px] flex items-start justify-start relative">
        <canvas ref={canvasRef} className="block max-w-full max-h-full">
          Your browser does not support the canvas element.
        </canvas>
        {montageImages.length === 0 && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-[rgb(var(--color-text-muted))] text-center p-4 pointer-events-none text-sm italic">
            Add images to create your montage.
          </div>
        )}
        {isLoading && montageImages.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[rgb(var(--color-text-muted))] text-center p-4 pointer-events-none text-sm italic animate-pulse">
            Loading...
          </div>
        )}
      </div>

      {/* File Selection Modal */}
      <FileSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFilesSelected={handleFilesSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept="image/*"
        selectionMode="multiple"
        libraryFilter={{ category: 'image' }}
        initialTab="library"
        showFilterAfterUploadCheckbox={false}
      />
    </div>
  );
}
