// --- FILE: app/tool/image-montage/_components/ImageMontageClient.tsx ---
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import { useMontageState, MontageEffect } from '../_hooks/useMontageState';
import { useMontageCanvas } from '../_hooks/useMontageCanvas';
import ImageAdjustmentCard from './ImageAdjustmentCard';
import MontageControls from './MontageControls';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import FileSelectionModal from '../../_components/file-storage/FileSelectionModal';
import type { StoredFile } from '@/src/types/storage';
import RadioGroup from '../../_components/form/RadioGroup';
import {
  XCircleIcon,
  ArrowPathIcon,
  CheckBadgeIcon,
} from '@heroicons/react/20/solid';

interface ImageMontageClientProps {
  toolRoute: string;
}

export default function ImageMontageClient({
  toolRoute,
}: ImageMontageClientProps) {
  const {
    persistedImages,
    effect,
    montageImagesForCanvas,
    processedFileId,
    outputFilename,
    addStoredFiles,
    clearMontage,
    handleTiltChange,
    handleOverlapChange,
    handleMoveImageLeft,
    handleMoveImageRight,
    handleMoveUp,
    handleMoveDown,
    handleEffectChange,

    setProcessedFileIdInState,
    setOutputFilenameInState,
    isLoadingState,
    errorLoadingState,
    isLoadingImages,
    imageLoadingError,
  } = useMontageState(toolRoute);

  const { canvasRef, generateMontageBlob } = useMontageCanvas(
    montageImagesForCanvas,
    effect
  );

  const [isGeneratingForAction, setIsGeneratingForAction] = useState(false);
  const [manualSaveSuccessFeedback, setManualSaveSuccessFeedback] =
    useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [isAddImagesModalOpen, setIsAddImagesModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameActionContext, setFilenameActionContext] = useState<{
    type: 'save_new' | 'update_existing' | 'download';
    currentFilenameToPrompt: string | null;
    idToUpdate?: string | null;
  } | null>(null);

  const [isCurrentOutputPermanentInDb, setIsCurrentOutputPermanentInDb] =
    useState(false);

  const {
    addImage: addImageToLibrary,
    getImage,
    updateBlob,
    deleteImage,
  } = useImageLibrary();

  const isLoadingOverall =
    isLoadingState || isLoadingImages || isGeneratingForAction;
  const combinedError = uiError || errorLoadingState || imageLoadingError;
  const hasInputs = persistedImages.length > 0;

  useEffect(() => {
    let mounted = true;
    const checkProcessedFileStatus = async () => {
      if (processedFileId) {
        try {
          const file = await getImage(processedFileId);
          if (mounted && file) {
            setIsCurrentOutputPermanentInDb(file.isTemporary === false);
          } else if (mounted) {
            setIsCurrentOutputPermanentInDb(false);
          }
        } catch (_e) {
          if (mounted) setIsCurrentOutputPermanentInDb(false);
        }
      } else {
        setIsCurrentOutputPermanentInDb(false);
      }
    };
    if (!isLoadingState) checkProcessedFileStatus();
    return () => {
      mounted = false;
    };
  }, [processedFileId, getImage, isLoadingState]);

  const performSaveOrUpdateMontage = useCallback(
    async (
      chosenFilename: string,
      idToUpdateIfMatching?: string | null
    ): Promise<string | null> => {
      if (montageImagesForCanvas.length === 0) {
        setUiError('No images to create a montage.');
        return null;
      }
      setIsGeneratingForAction(true);
      setUiError(null);

      const blob = await generateMontageBlob();
      if (!blob) {
        setUiError('Failed to generate montage image data.');
        setIsGeneratingForAction(false);
        return null;
      }

      try {
        let finalFileId: string;

        if (
          idToUpdateIfMatching &&
          idToUpdateIfMatching === processedFileId &&
          isCurrentOutputPermanentInDb &&
          outputFilename === chosenFilename
        ) {
          await updateBlob(idToUpdateIfMatching, true, blob);
          finalFileId = idToUpdateIfMatching;
        } else {
          if (processedFileId && !isCurrentOutputPermanentInDb) {
            try {
              await deleteImage(processedFileId);
            } catch (delErr) {
              console.warn(
                `[MontageClient SaveOrUpdate] Could not delete old temporary file ${processedFileId}:`,
                delErr
              );
            }
          }
          const newId = await addImageToLibrary(
            blob,
            chosenFilename,
            'image/png',
            false
          );
          finalFileId = newId;
          setProcessedFileIdInState(newId);
          setOutputFilenameInState(chosenFilename);
        }

        setManualSaveSuccessFeedback(true);
        setTimeout(() => setManualSaveSuccessFeedback(false), 2500);
        setIsGeneratingForAction(false);
        return finalFileId;
      } catch (saveErr) {
        setUiError(
          saveErr instanceof Error
            ? saveErr.message
            : 'Failed to save/update montage'
        );
        setIsGeneratingForAction(false);
        return null;
      }
    },
    [
      montageImagesForCanvas.length,
      generateMontageBlob,
      addImageToLibrary,
      updateBlob,
      deleteImage,
      processedFileId,
      outputFilename,
      isCurrentOutputPermanentInDb,
      setProcessedFileIdInState,
      setOutputFilenameInState,
    ]
  );

  const handleFilesSelectedFromModal = useCallback(
    (files: StoredFile[]) => {
      setIsAddImagesModalOpen(false);
      if (files && files.length > 0) {
        addStoredFiles(files);
        setUiError(null);
        setManualSaveSuccessFeedback(false);
      }
    },
    [addStoredFiles]
  );

  const handleClearMontageAndState = useCallback(async () => {
    await clearMontage();
    setUiError(null);
    setManualSaveSuccessFeedback(false);
  }, [clearMontage]);

  const handleSaveOrUpdateClick = () => {
    if (!hasInputs) {
      setUiError('Add some images first.');
      return;
    }
    if (processedFileId && isCurrentOutputPermanentInDb && outputFilename) {
      performSaveOrUpdateMontage(outputFilename, processedFileId);
    } else {
      const suggestedName =
        outputFilename || `MyMontage-${effect}-${Date.now()}.png`;
      setFilenameActionContext({
        type: 'save_new',
        currentFilenameToPrompt: suggestedName,
        idToUpdate: processedFileId,
      });
      setIsFilenameModalOpen(true);
    }
  };

  const handleSaveAsNewClick = () => {
    if (!hasInputs) {
      setUiError("Add some images first to 'Save As New'.");
      return;
    }
    const suggestedName =
      outputFilename || `MyMontage-${effect}-${Date.now()}.png`;
    setFilenameActionContext({
      type: 'save_new',
      currentFilenameToPrompt: suggestedName,
      idToUpdate: null,
    });
    setIsFilenameModalOpen(true);
  };

  const handleDownloadClick = async () => {
    if (!hasInputs) {
      setUiError('No images to create a montage for download.');
      return;
    }
    setIsGeneratingForAction(true);
    setUiError(null);

    const blobToDownload = await generateMontageBlob();

    if (blobToDownload) {
      const suggestedDownloadName =
        outputFilename || `Montage-${effect}-${Date.now()}.png`;
      setFilenameActionContext({
        type: 'download',
        currentFilenameToPrompt: suggestedDownloadName,
      });
      setIsFilenameModalOpen(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any)._tempMontageBlobForDownload = blobToDownload;
    } else {
      setUiError('Failed to get montage image data for download.');
    }
    setIsGeneratingForAction(false);
  };

  const handleFilenameConfirm = async (chosenFilename: string) => {
    const actionContext = filenameActionContext;
    setIsFilenameModalOpen(false);
    setFilenameActionContext(null);
    if (!actionContext) return;

    if (
      actionContext.type === 'save_new' ||
      actionContext.type === 'update_existing'
    ) {
      await performSaveOrUpdateMontage(
        chosenFilename,
        actionContext.idToUpdate
      );
    } else if (actionContext.type === 'download') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blobToDownload = (window as any)
        ._tempMontageBlobForDownload as Blob | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any)._tempMontageBlobForDownload;

      if (blobToDownload) {
        const url = URL.createObjectURL(blobToDownload);
        const link = document.createElement('a');
        link.href = url;
        link.download = chosenFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        setUiError('Temporary blob for download was lost.');
      }
    }
  };

  const zIndexBounds = useMemo(() => {
    if (persistedImages.length === 0) return { min: 0, max: 0 };
    const zIndexes = persistedImages.map((img) => img.zIndex);
    const validZIndexes = zIndexes.filter(
      (z) => typeof z === 'number' && !isNaN(z)
    );
    if (validZIndexes.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...validZIndexes), max: Math.max(...validZIndexes) };
  }, [persistedImages]);

  const shouldShowSavedBadge = !!(
    processedFileId &&
    (isCurrentOutputPermanentInDb || manualSaveSuccessFeedback)
  );

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <MontageControls
        isLoading={isLoadingOverall}
        isGeneratingMontageForAction={isGeneratingForAction}
        isOutputPermanentAndSaved={
          isCurrentOutputPermanentInDb && !!processedFileId
        }
        canSaveOrUpdate={hasInputs}
        canDownload={hasInputs}
        imageCount={persistedImages.length}
        manualSaveSuccessFeedback={manualSaveSuccessFeedback}
        onAddClick={() => setIsAddImagesModalOpen(true)}
        onClear={handleClearMontageAndState}
        onSaveOrUpdateClick={handleSaveOrUpdateClick}
        onSaveAsNewClick={handleSaveAsNewClick}
        onDownloadClick={handleDownloadClick}
      />

      <div className="p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="flex flex-wrap gap-x-6 gap-y-3 items-center">
          <RadioGroup
            name="montageEffect"
            legend="Image Style:"
            options={[
              { value: 'polaroid', label: 'Polaroid' },
              { value: 'natural', label: 'Borderless' },
            ]}
            selectedValue={effect}
            onChange={(newEffectValue) =>
              handleEffectChange(newEffectValue as MontageEffect)
            }
            layout="horizontal"
            disabled={isLoadingOverall}
            radioClassName="text-sm"
          />
        </div>
      </div>

      {combinedError && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          <XCircleIcon
            className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-500"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong> {combinedError}
          </div>
        </div>
      )}

      {persistedImages.length > 0 && (
        <div className="flex-shrink-0 pb-4 border-b border-[rgb(var(--color-border-base))]">
          <h2 className="text-base font-semibold mb-2 text-[rgb(var(--color-text-muted))]">
            Adjust & Reorder Input Images ({persistedImages.length})
          </h2>
          <div className="flex space-x-4 overflow-x-auto py-2 px-1 justify-center">
            {persistedImages.map((imgData, index) => (
              <ImageAdjustmentCard
                key={imgData.imageId}
                image={{
                  id: index,
                  imageId: imgData.imageId,
                  image: montageImagesForCanvas.find(
                    (mi) => mi.imageId === imgData.imageId
                  )?.image as HTMLImageElement,
                  alt: imgData.name,
                  tilt: imgData.tilt,
                  overlapPercent: imgData.overlapPercent,
                  zIndex: imgData.zIndex,
                  originalWidth: imgData.originalWidth,
                  originalHeight: imgData.originalHeight,
                }}
                index={index}
                imageCount={persistedImages.length}
                isFirst={index === 0}
                isLast={index === persistedImages.length - 1}
                isTopZIndex={imgData.zIndex === zIndexBounds.max}
                isBottomZIndex={imgData.zIndex === zIndexBounds.min}
                isLoading={isLoadingOverall}
                onTiltChange={handleTiltChange}
                onOverlapChange={handleOverlapChange}
                onMoveLeft={handleMoveImageLeft}
                onMoveRight={handleMoveImageRight}
                onMoveUpZIndex={handleMoveUp}
                onMoveDownZIndex={handleMoveDown}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex-grow overflow-auto border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] p-2 min-h-[300px] flex items-center justify-center relative">
        {montageImagesForCanvas.length > 0 ? (
          <canvas
            ref={canvasRef}
            className="block max-w-full max-h-[calc(60vh-40px)] object-contain"
          >
            Your browser does not support the canvas element.
          </canvas>
        ) : (
          <div className="w-full text-[rgb(var(--color-text-muted))] text-center p-4 italic">
            {isLoadingState
              ? 'Loading state...'
              : isLoadingImages
                ? 'Loading images...'
                : 'Add images to create your montage.'}
          </div>
        )}
        {isGeneratingForAction && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-[rgb(var(--color-text-link))]" />
          </div>
        )}
        {shouldShowSavedBadge && outputFilename && (
          <div className="absolute top-2 right-2 bg-green-100 text-green-700 px-2 py-1 text-xs rounded-full flex items-center gap-1 shadow z-10">
            <CheckBadgeIcon className="h-4 w-4" /> Saved: {outputFilename}
          </div>
        )}
      </div>

      <FileSelectionModal
        isOpen={isAddImagesModalOpen}
        onClose={() => setIsAddImagesModalOpen(false)}
        onFilesSelected={handleFilesSelectedFromModal}
        mode="selectExistingOrUploadNew"
        accept="image/*"
        selectionMode="multiple"
        libraryFilter={{ category: 'image' }}
        initialTab="library"
        showFilterAfterUploadCheckbox={false}
      />
      <FilenamePromptModal
        isOpen={isFilenameModalOpen}
        onClose={() => {
          setIsFilenameModalOpen(false);
          setFilenameActionContext(null);
        }}
        onConfirm={handleFilenameConfirm}
        initialFilename={
          filenameActionContext?.currentFilenameToPrompt ||
          `MyMontage-${effect}-${Date.now()}.png`
        }
        title={
          filenameActionContext?.type?.startsWith('save')
            ? 'Save Montage to Library'
            : 'Download Montage'
        }
        promptMessage="Enter a filename for the montage:"
        confirmButtonText={
          filenameActionContext?.type?.startsWith('save') ? 'Save' : 'Download'
        }
      />
    </div>
  );
}
