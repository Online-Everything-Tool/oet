// --- FILE: app/tool/image-montage/_components/ImageMontageClient.tsx ---
'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
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

import { useMetadata } from '@/app/context/MetadataContext';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import ItdeAcceptChoiceModal, {
  ItdeChoiceOption,
} from '../../_components/shared/ItdeAcceptChoiceModal';

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

  const initialToolStateLoadCompleteRef = useRef(false);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const [incomingItdeFiles, setIncomingItdeFiles] = useState<
    StoredFile[] | null
  >(null);
  const [itdeActionChoiceModalOpen, setItdeActionChoiceModalOpen] =
    useState(false);

  const [currentItdeSignalForChoice, setCurrentItdeSignalForChoice] =
    useState<IncomingSignal | null>(null);

  const {
    addFile,
    getFile,
    updateFileBlob,
    markFileAsTemporary,
    cleanupOrphanedTemporaryFiles,
  } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const directiveName = useMemo(
    () => toolRoute.split('/').pop() || 'image-montage',
    [toolRoute]
  );

  const isLoadingOverall =
    isLoadingState || isLoadingImages || isGeneratingForAction;
  const combinedError = uiError || errorLoadingState || imageLoadingError;
  const hasInputs = persistedImages.length > 0;

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
    let mounted = true;
    const checkProcessedFileStatus = async () => {
      if (processedFileId) {
        try {
          const file = await getFile(processedFileId);
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
    if (!isLoadingState && initialToolStateLoadCompleteRef.current) {
      checkProcessedFileStatus();
    }
    return () => {
      mounted = false;
    };
  }, [processedFileId, getFile, isLoadingState]);

  const handleActualItdeAccept = useCallback(
    async (actionKey: string) => {
      if (
        !incomingItdeFiles ||
        incomingItdeFiles.length === 0 ||
        !currentItdeSignalForChoice
      )
        return;

      let oldPersistedImageIds: string[] = [];

      if (actionKey === 'replace') {
        oldPersistedImageIds = persistedImages.map((img) => img.imageId);
        await clearMontage();
      }

      if (actionKey === 'add' || actionKey === 'replace') {
        await addStoredFiles(incomingItdeFiles);
      }

      if (actionKey === 'replace' && oldPersistedImageIds.length > 0) {
        cleanupOrphanedTemporaryFiles(oldPersistedImageIds).catch((e) =>
          console.error(
            '[Montage ITDE Replace] Cleanup failed for old images:',
            e
          )
        );
      }

      setItdeActionChoiceModalOpen(false);
      setIncomingItdeFiles(null);
      setCurrentItdeSignalForChoice(null);
      setUserDeferredAutoPopup(false);
    },
    [
      addStoredFiles,
      clearMontage,
      incomingItdeFiles,
      persistedImages,
      cleanupOrphanedTemporaryFiles,
      currentItdeSignalForChoice,
    ]
  );

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      console.log(
        `[ImageMontage ITDE Accept] Processing signal from: ${signal.sourceDirective}`
      );
      setUiError(null);

      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setUiError(
          `Metadata not found for source tool: ${signal.sourceToolTitle}`
        );

        return;
      }

      const resolvedPayload = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );
      if (
        resolvedPayload.type === 'error' ||
        resolvedPayload.type === 'none' ||
        !resolvedPayload.data
      ) {
        setUiError(
          resolvedPayload.errorMessage ||
            'No transferable data received from source.'
        );
        return;
      }

      let imageFiles: StoredFile[] = [];
      if (
        resolvedPayload.type === 'fileReference' &&
        (resolvedPayload.data as StoredFile).type?.startsWith('image/')
      ) {
        imageFiles = [resolvedPayload.data as StoredFile];
      } else if (
        resolvedPayload.type === 'selectionReferenceList' &&
        Array.isArray(resolvedPayload.data)
      ) {
        imageFiles = (resolvedPayload.data as StoredFile[]).filter((f) =>
          f.type?.startsWith('image/')
        );
      }

      if (imageFiles.length === 0) {
        setUiError(`No usable images received from ${signal.sourceToolTitle}.`);
        return;
      }

      setUserDeferredAutoPopup(false);

      setIncomingItdeFiles(imageFiles);
      setCurrentItdeSignalForChoice(signal);

      if (persistedImages.length === 0) {
        handleActualItdeAccept('add');
      } else {
        setItdeActionChoiceModalOpen(true);
      }
    },
    [getToolMetadata, persistedImages.length, handleActualItdeAccept]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    const canProceed =
      !isLoadingState &&
      initialToolStateLoadCompleteRef.current &&
      !isLoadingImages &&
      !isGeneratingForAction;
    if (
      canProceed &&
      itdeTarget.pendingSignals.length > 0 &&
      !itdeTarget.isModalOpen &&
      !itdeActionChoiceModalOpen &&
      !userDeferredAutoPopup
    ) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [
    isLoadingState,
    initialToolStateLoadCompleteRef,
    isLoadingImages,
    isGeneratingForAction,
    itdeTarget.pendingSignals,
    itdeTarget.isModalOpen,
    itdeTarget.openModalIfSignalsExist,
    itdeActionChoiceModalOpen,
    userDeferredAutoPopup,
    itdeTarget,
  ]);

  const itdeChoiceModalOptions: ItdeChoiceOption[] = useMemo(
    () => [
      { label: 'Add to Current Montage', actionKey: 'add', variant: 'primary' },
      { label: 'Start New Montage', actionKey: 'replace', variant: 'accent' },
    ],
    []
  );

  const handleItdeChoiceModalClose = () => {
    setItdeActionChoiceModalOpen(false);
    setIncomingItdeFiles(null);

    if (currentItdeSignalForChoice) {
    }
    setCurrentItdeSignalForChoice(null);
    setUserDeferredAutoPopup(true);
  };

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
        const isUpdate =
          idToUpdateIfMatching &&
          idToUpdateIfMatching === processedFileId &&
          isCurrentOutputPermanentInDb &&
          outputFilename === chosenFilename;

        if (isUpdate && idToUpdateIfMatching) {
          await updateFileBlob(idToUpdateIfMatching, blob);
          finalFileId = idToUpdateIfMatching;
        } else {
          if (processedFileId && !isCurrentOutputPermanentInDb) {
            try {
              await markFileAsTemporary(processedFileId);
            } catch (delErr) {
              console.warn(
                `[MontageClient SaveOrUpdate] Could not delete old temporary file ${processedFileId}:`,
                delErr
              );
            }
          }
          const newId = await addFile(blob, chosenFilename, 'image/png', false);
          finalFileId = newId;
        }
        setProcessedFileIdInState(finalFileId);
        setOutputFilenameInState(chosenFilename);
        setIsCurrentOutputPermanentInDb(true);

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
      addFile,
      updateFileBlob,
      markFileAsTemporary,
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
        setUserDeferredAutoPopup(false);
      }
    },
    [addStoredFiles]
  );

  const handleClearMontageAndState = useCallback(async () => {
    const oldImageIds = persistedImages.map((p) => p.imageId);
    const oldProcessedId = processedFileId;

    await clearMontage();
    setUiError(null);
    setManualSaveSuccessFeedback(false);
    setUserDeferredAutoPopup(false);

    const idsToCleanup = [...oldImageIds];
    if (oldProcessedId) idsToCleanup.push(oldProcessedId);
    if (idsToCleanup.length > 0) {
      cleanupOrphanedTemporaryFiles(idsToCleanup).catch((e) =>
        console.error('[Montage Clear] Cleanup failed:', e)
      );
    }
  }, [
    clearMontage,
    persistedImages,
    processedFileId,
    cleanupOrphanedTemporaryFiles,
  ]);

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
    const suggestedName = `MyMontage-${effect}-${Date.now()}.png`;
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
    (isCurrentOutputPermanentInDb || manualSaveSuccessFeedback) &&
    outputFilename
  );

  const handleGenericItdeModalDeferAll = () => {
    setUserDeferredAutoPopup(true);
    itdeTarget.closeModal();
  };
  const handleGenericItdeModalIgnoreAll = () => {
    setUserDeferredAutoPopup(false);
    itdeTarget.ignoreAllSignals();
  };
  const handleGenericItdeModalAccept = (sourceDirective: string) => {
    itdeTarget.acceptSignal(sourceDirective);
  };
  const handleGenericItdeModalIgnore = (sourceDirective: string) => {
    itdeTarget.ignoreSignal(sourceDirective);
    if (
      itdeTarget.pendingSignals.filter(
        (s) => s.sourceDirective !== sourceDirective
      ).length === 0
    ) {
      setUserDeferredAutoPopup(false);
    }
  };

  if (isLoadingState && !initialToolStateLoadCompleteRef.current) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Montage Tool State...
      </p>
    );
  }

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
        <div className="flex flex-wrap gap-x-6 gap-y-3 items-center justify-between">
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
          <ReceiveItdeDataTrigger
            hasDeferredSignals={
              itdeTarget.pendingSignals.length > 0 &&
              userDeferredAutoPopup &&
              !itdeTarget.isModalOpen &&
              !itdeActionChoiceModalOpen
            }
            pendingSignalCount={itdeTarget.pendingSignals.length}
            onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            className="ml-auto"
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
          <div className="flex space-x-4 overflow-x-auto py-2 px-1 justify-start">
            {montageImagesForCanvas.map((imgData, index) => (
              <ImageAdjustmentCard
                key={imgData.id}
                image={imgData}
                index={index}
                imageCount={montageImagesForCanvas.length}
                isFirst={index === 0}
                isLast={index === montageImagesForCanvas.length - 1}
                isTopZIndex={
                  imgData.zIndex === zIndexBounds.max &&
                  montageImagesForCanvas.filter(
                    (p) => p.zIndex === zIndexBounds.max
                  ).length === 1
                }
                isBottomZIndex={
                  imgData.zIndex === zIndexBounds.min &&
                  montageImagesForCanvas.filter(
                    (p) => p.zIndex === zIndexBounds.min
                  ).length === 1
                }
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
        {shouldShowSavedBadge && (
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
      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen && !itdeActionChoiceModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={handleGenericItdeModalAccept}
        onIgnore={handleGenericItdeModalIgnore}
        onDeferAll={handleGenericItdeModalDeferAll}
        onIgnoreAll={handleGenericItdeModalIgnoreAll}
      />
      <ItdeAcceptChoiceModal
        isOpen={itdeActionChoiceModalOpen}
        onClose={handleItdeChoiceModalClose}
        sourceToolTitle={
          currentItdeSignalForChoice?.sourceToolTitle || 'Unknown Tool'
        }
        dataTypeReceived={
          incomingItdeFiles && incomingItdeFiles.length > 1 ? 'images' : 'image'
        }
        itemCount={incomingItdeFiles?.length || 0}
        options={itdeChoiceModalOptions}
        onOptionSelect={handleActualItdeAccept}
        title="Incoming Montage Images"
        message={`Received ${incomingItdeFiles?.length || 0} image(s) from "${currentItdeSignalForChoice?.sourceToolTitle || 'another tool'}".`}
      />
    </div>
  );
}
