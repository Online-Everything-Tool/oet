// --- FILE: app/tool/image-montage/_components/ImageMontageClient.tsx ---
'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
  useMontageState,
  MontageEffect,
  ImageMontageToolPersistedState,
} from '../_hooks/useMontageState';
import { useMontageCanvas } from '../_hooks/useMontageCanvas';
import ImageAdjustmentCard, {
  MontageImageForCard,
} from './ImageAdjustmentCard';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import Button from '../../_components/form/Button';

import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata } from '@/src/types/tools';
import RadioGroup from '../../_components/form/RadioGroup';
import {
  XCircleIcon,
  ArrowPathIcon,
  CheckBadgeIcon,
  PhotoIcon,
} from '@heroicons/react/20/solid';

import { useMetadata } from '@/app/context/MetadataContext';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import ItdeAcceptChoiceModal, {
  ItdeChoiceOption,
} from '../../_components/shared/ItdeAcceptChoiceModal';
import importedMetadata from '../metadata.json';
import { ResolvedItdeData, resolveItdeData } from '@/app/lib/itdeDataUtils';

interface ImageMontageClientProps {
  toolRoute: string;
}

const metadata = importedMetadata as ToolMetadata;

const AUTO_UPDATE_DEBOUNCE_MS_CLIENT = 1200;

type FilenameActionType = 'library_save' | 'download';

interface FilenameActionContextState {
  type: FilenameActionType;
  currentFilenameToPrompt: string;
  originalFileIdToActUpon?: string | null;
  wasOriginalFileTemporary?: boolean;
}

export default function ImageMontageClient({
  toolRoute,
}: ImageMontageClientProps) {
  const {
    persistedImages,
    montageEffect,
    montageImagesForCanvas,
    processedFileId: currentProcessedFileIdFromHook,
    lastUserGivenFilename,
    addStoredFiles,
    removePersistedImage,
    clearMontage,
    handleTiltChange,
    handleOverlapChange,
    handleMoveImageLeft,
    handleMoveImageRight,
    handleZIndexChange,
    handleEffectChange,
    handleSaveSuccess,
    setTemporaryMontageOutput,
    isLoadingState,
    errorLoadingState,
    isLoadingImages,
    imageLoadingError,
    saveStateNow,
  } = useMontageState({ toolRoute });

  const {
    canvasRef: actualCanvasRef,
    generateMontageBlob: actualGenerateMontageBlob,
  } = useMontageCanvas(montageImagesForCanvas, montageEffect);

  const [isGeneratingForAction, setIsGeneratingForAction] = useState(false);
  const [manualSaveSuccess, setManualSaveSuccess] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);

  const [isAddImagesModalOpen, setIsAddImagesModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);

  const [filenameActionContext, setFilenameActionContext] =
    useState<FilenameActionContextState | null>(null);

  const [currentProcessedFileInfo, setCurrentProcessedFileInfo] =
    useState<StoredFile | null>(null);
  const initialToolStateLoadCompleteRef = useRef(false);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);

  const [incomingItdeFiles, setIncomingItdeFiles] = useState<
    StoredFile[] | null
  >(null);
  const [itdeActionChoiceModalOpen, setItdeActionChoiceModalOpen] =
    useState(false);
  const [choiceModalToolTitle, setChoiceModalToolTitle] = useState<
    string | null
  >(null);

  const { addFile, getFile, updateFileBlob, makeFilePermanentAndUpdate } =
    useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const directiveName = metadata.directive;

  useEffect(() => {
    if (currentProcessedFileIdFromHook) {
      getFile(currentProcessedFileIdFromHook).then((file) => {
        setCurrentProcessedFileInfo(file || null);
      });
    } else {
      setCurrentProcessedFileInfo(null);
    }
  }, [currentProcessedFileIdFromHook, getFile]);

  const autoUpdateTemporaryMontageDebounced = useDebouncedCallback(async () => {
    if (
      !initialToolStateLoadCompleteRef.current ||
      isLoadingState ||
      isGeneratingForAction
    )
      return;
    if (persistedImages.length === 0) {
      await setTemporaryMontageOutput(null, 'auto');
      return;
    }
    const newBlob = await actualGenerateMontageBlob();
    await setTemporaryMontageOutput(newBlob, 'auto');
  }, AUTO_UPDATE_DEBOUNCE_MS_CLIENT);

  const prevPersistedImagesJsonRef = useRef<string | undefined>(undefined);
  const prevEffectRef = useRef<MontageEffect | undefined>(undefined);

  useEffect(() => {
    const currentPersistedImagesJson = JSON.stringify(persistedImages);
    let hasMeaningfulChange = false;

    if (
      prevPersistedImagesJsonRef.current === undefined &&
      prevEffectRef.current === undefined
    ) {
      if (persistedImages.length > 0 && !currentProcessedFileIdFromHook) {
        hasMeaningfulChange = true;
      }
    } else {
      if (prevPersistedImagesJsonRef.current !== currentPersistedImagesJson) {
        hasMeaningfulChange = true;
      }
      if (prevEffectRef.current !== montageEffect) {
        hasMeaningfulChange = true;
      }
    }

    if (
      !isLoadingState &&
      initialToolStateLoadCompleteRef.current &&
      !isGeneratingForAction
    ) {
      if (hasMeaningfulChange) {
        console.log(
          '[MontageClient AutoUpdate useEffect] Meaningful change detected, triggering auto-update.'
        );
        autoUpdateTemporaryMontageDebounced();
      }
    }

    prevPersistedImagesJsonRef.current = currentPersistedImagesJson;
    prevEffectRef.current = montageEffect;
  }, [
    persistedImages,
    montageEffect,
    currentProcessedFileIdFromHook,
    isLoadingState,
    isGeneratingForAction,
    autoUpdateTemporaryMontageDebounced,
  ]);

  const itdeSendableItems = useMemo(() => {
    if (currentProcessedFileInfo) return [currentProcessedFileInfo];
    if (currentProcessedFileIdFromHook) {
      return [
        {
          id: currentProcessedFileIdFromHook,
          type: 'image/png',
          filename: 'montage.png',
          size: 0,
          blob: new Blob(),
          createdAt: new Date(),
          isTemporary: true,
        },
      ];
    }
    return [];
  }, [currentProcessedFileInfo, currentProcessedFileIdFromHook]);

  const hasInputs = persistedImages.length > 0;
  const isLoadingOverall =
    isLoadingState || isLoadingImages || isGeneratingForAction;
  const combinedError = uiError || errorLoadingState || imageLoadingError;

  const canInitiateSaveToLibrary = useMemo(() => {
    console.log('canInitiateSaveToLibrary:', currentProcessedFileInfo);
    if (isGeneratingForAction) return false;
    if (!hasInputs && !currentProcessedFileIdFromHook) return false;

    if (
      currentProcessedFileInfo &&
      currentProcessedFileInfo.isTemporary === false
    ) {
      return false;
    }
    return true;
  }, [
    currentProcessedFileInfo,
    hasInputs,
    currentProcessedFileIdFromHook,
    isGeneratingForAction,
  ]);

  useEffect(() => {
    if (!isLoadingState && !initialToolStateLoadCompleteRef.current) {
      initialToolStateLoadCompleteRef.current = true;
    } else if (isLoadingState && initialToolStateLoadCompleteRef.current) {
      initialToolStateLoadCompleteRef.current = false;
    }
  }, [isLoadingState]);

  const handleActualItdeAccept = useCallback(
    async (actionKey: string, filesToProcess?: StoredFile[]) => {
      const filesToUse = incomingItdeFiles || filesToProcess;
      if (!filesToUse || filesToUse.length === 0) return;
      if (actionKey === 'replace') await clearMontage();
      await addStoredFiles(
        filesToUse.filter((f) => f.type?.startsWith('image/'))
      );
      setChoiceModalToolTitle(null);
      setItdeActionChoiceModalOpen(false);
      setIncomingItdeFiles(null);
    },
    [incomingItdeFiles, clearMontage, addStoredFiles]
  );

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      setUiError(null);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setUiError(`Metadata for ${signal.sourceDirective} not found.`);
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
            `No data from ${signal.sourceToolTitle}.`
        );
        return;
      }
      const receivedImageItems = resolvedPayload.data.filter(
        (item) => item.type?.startsWith('image/') && 'id' in item
      ) as StoredFile[];
      if (receivedImageItems.length === 0) {
        setUiError(`No images from ${signal.sourceToolTitle}.`);
        return;
      }
      setUserDeferredAutoPopup(false);
      if (persistedImages.length === 0) {
        await handleActualItdeAccept('replace', receivedImageItems);
      } else {
        setChoiceModalToolTitle(signal.sourceToolTitle);
        setIncomingItdeFiles(receivedImageItems);
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
    isLoadingImages,
    isGeneratingForAction,
    itdeTarget,
    userDeferredAutoPopup,
    itdeActionChoiceModalOpen,
  ]);

  const handleFilesSelectedFromModal = useCallback(
    (files: StoredFile[]) => {
      setIsAddImagesModalOpen(false);
      if (files?.length > 0) {
        const imageFiles = files.filter((f) => f.type?.startsWith('image/'));
        if (imageFiles.length > 0) {
          addStoredFiles(imageFiles);
          setUiError(null);
          setManualSaveSuccess(false);
        } else if (files.length > 0) {
          setUiError('No valid image files selected.');
        }
      }
    },
    [addStoredFiles]
  );

  const handleInitiateSaveToLibrary = useCallback(async () => {
    if (!canInitiateSaveToLibrary) return;
    if (!hasInputs && !currentProcessedFileIdFromHook) {
      setUiError('Nothing to save.');
      return;
    }
    setUiError(null);
    let suggestedFilename = lastUserGivenFilename;
    if (!suggestedFilename)
      suggestedFilename = `MyMontage-${montageEffect}-${Date.now()}.png`;

    const currentOutputIsTemporary =
      currentProcessedFileInfo?.isTemporary === true ||
      !currentProcessedFileIdFromHook;
    setFilenameActionContext({
      type: 'library_save',
      currentFilenameToPrompt: suggestedFilename,
      originalFileIdToActUpon: currentProcessedFileIdFromHook,
      wasOriginalFileTemporary: currentOutputIsTemporary,
    });
    setIsFilenameModalOpen(true);
    if (currentOutputIsTemporary && currentProcessedFileInfo?.blob) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any)._tempMontageBlobForSave = currentProcessedFileInfo.blob;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any)._tempMontageBlobForSave;
    }
  }, [
    canInitiateSaveToLibrary,
    hasInputs,
    currentProcessedFileIdFromHook,
    lastUserGivenFilename,
    montageEffect,
    currentProcessedFileInfo,
  ]);

  const handleDownloadClick = useCallback(async () => {
    if (!hasInputs && !currentProcessedFileIdFromHook) {
      setUiError('Nothing to download.');
      return;
    }
    setUiError(null);
    setIsGeneratingForAction(true);
    let blobToDownload: Blob | null = null;
    const filenameForDownloadPrompt =
      lastUserGivenFilename || `MyMontage-${montageEffect}-${Date.now()}.png`;

    if (
      currentProcessedFileInfo &&
      currentProcessedFileInfo.id === currentProcessedFileIdFromHook &&
      currentProcessedFileInfo.blob
    ) {
      blobToDownload = currentProcessedFileInfo.blob;
    } else if (currentProcessedFileIdFromHook) {
      const file = await getFile(currentProcessedFileIdFromHook);
      if (file?.blob) blobToDownload = file.blob;
    }
    if (!blobToDownload) blobToDownload = await actualGenerateMontageBlob();
    setIsGeneratingForAction(false);
    if (blobToDownload) {
      setFilenameActionContext({
        type: 'download',
        currentFilenameToPrompt: filenameForDownloadPrompt,
      });
      setIsFilenameModalOpen(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any)._tempMontageBlobForDownload = blobToDownload;
    } else {
      setUiError('Failed to get montage image data for download.');
    }
  }, [
    hasInputs,
    currentProcessedFileIdFromHook,
    lastUserGivenFilename,
    montageEffect,
    currentProcessedFileInfo,
    getFile,
    actualGenerateMontageBlob,
  ]);

  const handleFilenameConfirm = useCallback(
    async (chosenFilename: string) => {
      const actionCtx = filenameActionContext;
      setIsFilenameModalOpen(false);
      setFilenameActionContext(null);
      if (!actionCtx) return;
      autoUpdateTemporaryMontageDebounced.cancel();

      if (actionCtx.type === 'library_save') {
        setIsGeneratingForAction(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let blobToSave = (window as any)._tempMontageBlobForSave as Blob | null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (blobToSave) delete (window as any)._tempMontageBlobForSave;
        const originalFileId = actionCtx.originalFileIdToActUpon;
        const wasOriginalTemporary = actionCtx.wasOriginalFileTemporary;
        if (!blobToSave && originalFileId) {
          const originalFile = await getFile(originalFileId);
          if (originalFile?.blob) blobToSave = originalFile.blob;
        }
        if (!blobToSave) blobToSave = await actualGenerateMontageBlob();
        if (!blobToSave) {
          setUiError('Failed to get montage data for saving.');
          setIsGeneratingForAction(false);
          return;
        }

        try {
          let finalSavedId: string | null = null;
          if (originalFileId && wasOriginalTemporary) {
            const promoted = await makeFilePermanentAndUpdate(
              originalFileId,
              chosenFilename
            );
            if (promoted) {
              finalSavedId = originalFileId;
              const currentBlobInPromotedFile = (await getFile(originalFileId))
                ?.blob;
              if (currentBlobInPromotedFile !== blobToSave) {
                await updateFileBlob(originalFileId, blobToSave, true);
              }
            }
          }
          if (!finalSavedId) {
            finalSavedId = await addFile(
              blobToSave,
              chosenFilename,
              'image/png',
              false
            );
          }
          await handleSaveSuccess(finalSavedId, chosenFilename);
          setManualSaveSuccess(true);

          const updatedFileInfo = await getFile(finalSavedId);
          setCurrentProcessedFileInfo(updatedFileInfo || null);

          console.log(
            '[MontageClient Confirm Save] currentProcessedFileInfo updated after save:',
            updatedFileInfo
          );
          setTimeout(() => setManualSaveSuccess(false), 2500);
        } catch (err) {
          setUiError(
            `Save to library failed: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        } finally {
          setIsGeneratingForAction(false);
        }
      } else if (actionCtx.type === 'download') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blobToDownload = (window as any)
          ._tempMontageBlobForDownload as Blob | null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any)._tempMontageBlobForDownload)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (window as any)._tempMontageBlobForDownload;
        if (blobToDownload) {
          const newState: ImageMontageToolPersistedState = {
            persistedImages,
            montageEffect,
            processedFileId: currentProcessedFileIdFromHook,
            lastUserGivenFilename: chosenFilename,
          };
          await saveStateNow(newState);

          const url = URL.createObjectURL(blobToDownload);
          const link = document.createElement('a');
          link.href = url;
          link.download = chosenFilename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setDownloadSuccess(true);
          setTimeout(() => setDownloadSuccess(false), 2000);
        } else {
          setUiError('Temporary blob for download was lost.');
        }
      }
    },
    [
      filenameActionContext,
      actualGenerateMontageBlob,
      addFile,
      getFile,
      updateFileBlob,
      makeFilePermanentAndUpdate,
      handleSaveSuccess,
      autoUpdateTemporaryMontageDebounced,
      saveStateNow,
      currentProcessedFileIdFromHook,
      montageEffect,
      persistedImages,
    ]
  );

  const handleClearClient = useCallback(async () => {
    await clearMontage();
    setUiError(null);
    setManualSaveSuccess(false);
    setDownloadSuccess(false);
  }, [clearMontage]);

  const isOutputKnownPermanent =
    currentProcessedFileInfo?.isTemporary === false;
  const outputActionButtonsSaveSuccess =
    isOutputKnownPermanent || manualSaveSuccess;
  const canPerformOutputActionsOverall =
    (hasInputs || !!currentProcessedFileIdFromHook) && !isLoadingOverall;

  const itdeChoiceModalOptions: ItdeChoiceOption[] = useMemo(
    () => [
      { label: 'Add to Current Montage', actionKey: 'add', variant: 'primary' },
      {
        label: 'Start New Montage With These',
        actionKey: 'replace',
        variant: 'accent',
      },
    ],
    []
  );
  const handleItdeChoiceModalClose = () => {
    setItdeActionChoiceModalOpen(false);
    setIncomingItdeFiles(null);
    setUserDeferredAutoPopup(true);
  };
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
    )
      setUserDeferredAutoPopup(false);
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
      <div className="flex-shrink-0 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="flex flex-wrap gap-x-6 gap-y-3 items-center justify-between">
          <Button
            variant="accent2"
            onClick={() => setIsAddImagesModalOpen(true)}
            isLoading={isLoadingState && persistedImages.length === 0}
            disabled={isLoadingOverall && !isLoadingState}
            iconLeft={<PhotoIcon className="h-5 w-5" />}
          >
            Add Images
          </Button>
          <RadioGroup
            name="montageEffect"
            legend="Image Style:"
            options={[
              { value: 'polaroid', label: 'Polaroid' },
              { value: 'natural', label: 'Borderless' },
            ]}
            selectedValue={montageEffect}
            onChange={(newEffectValue) =>
              handleEffectChange(newEffectValue as MontageEffect)
            }
            layout="horizontal"
            disabled={isLoadingOverall}
            radioClassName="text-sm"
          />
          <div className="flex items-center gap-2 ml-auto">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={
                itdeTarget.pendingSignals.length > 0 &&
                userDeferredAutoPopup &&
                !itdeTarget.isModalOpen &&
                !itdeActionChoiceModalOpen
              }
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
            <OutputActionButtons
              canPerform={canPerformOutputActionsOverall}
              canInitiateSave={canInitiateSaveToLibrary}
              isSaveSuccess={outputActionButtonsSaveSuccess}
              isDownloadSuccess={downloadSuccess}
              onInitiateSave={handleInitiateSaveToLibrary}
              onInitiateDownload={handleDownloadClick}
              onClear={handleClearClient}
              directiveName={directiveName}
              outputConfig={metadata.outputConfig}
              selectedOutputItems={itdeSendableItems}
            />
          </div>
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
          <h2 className="text-base font-semibold text-[rgb(var(--color-text-muted))]">
            Adjust & Reorder Input Images ({persistedImages.length})
          </h2>
          <div className="flex space-x-4 overflow-x-auto py-2 px-1 justify-center items-stretch">
            {montageImagesForCanvas.map((imgData, index) => {
              const sourcePersistedImage = persistedImages.find(
                (p) => p.instanceId === imgData.instanceId
              );
              if (!sourcePersistedImage) return null;
              const cardImageProps: MontageImageForCard = {
                id: imgData.id,
                instanceId: imgData.instanceId,
                imageId: imgData.imageId,
                alt: imgData.alt,
                tilt: sourcePersistedImage.tilt,
                overlapPercent: sourcePersistedImage.overlapPercent,
                zIndex: sourcePersistedImage.zIndex,
              };
              return (
                <ImageAdjustmentCard
                  key={imgData.instanceId}
                  image={cardImageProps}
                  index={index}
                  imageCount={montageImagesForCanvas.length}
                  isFirst={index === 0}
                  isLast={index === montageImagesForCanvas.length - 1}
                  isTopZIndex={
                    sourcePersistedImage.zIndex ===
                    Math.max(...persistedImages.map((p) => p.zIndex))
                  }
                  isBottomZIndex={
                    sourcePersistedImage.zIndex ===
                    Math.min(...persistedImages.map((p) => p.zIndex))
                  }
                  isLoading={isLoadingOverall}
                  onTiltChange={handleTiltChange}
                  onOverlapChange={handleOverlapChange}
                  onMoveLeft={handleMoveImageLeft}
                  onMoveRight={handleMoveImageRight}
                  onMoveUpZIndex={(instanceId) =>
                    handleZIndexChange(instanceId, 'up')
                  }
                  onMoveDownZIndex={(instanceId) =>
                    handleZIndexChange(instanceId, 'down')
                  }
                  onRemoveImage={removePersistedImage}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-grow overflow-auto border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))] p-2 min-h-[300px] flex items-center justify-center relative">
        {montageImagesForCanvas.length > 0 ? (
          <canvas
            ref={actualCanvasRef}
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
        {(isLoadingImages || isGeneratingForAction) && !isLoadingState && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-[rgb(var(--color-text-link))]" />
          </div>
        )}
        {currentProcessedFileInfo &&
          currentProcessedFileInfo.isTemporary === false &&
          currentProcessedFileInfo.filename && (
            <div className="absolute top-2 right-2 bg-green-100 text-green-700 px-2 py-1 text-xs rounded-full flex items-center gap-1 shadow z-10">
              <CheckBadgeIcon className="h-4 w-4" /> Saved:{' '}
              {currentProcessedFileInfo.filename}
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
          `MyMontage-${montageEffect}-${Date.now()}.png`
        }
        title={
          filenameActionContext?.type === 'download'
            ? 'Download Montage'
            : 'Save Montage to Library'
        }
        promptMessage={
          filenameActionContext?.type === 'library_save' &&
          lastUserGivenFilename &&
          filenameActionContext.currentFilenameToPrompt ===
            lastUserGivenFilename ? (
            <>
              <p className="mb-1">
                You are re-saving “<strong>{lastUserGivenFilename}</strong>”.
              </p>
              <p>
                Keep this name to update it, or enter a new name for a copy.
              </p>
            </>
          ) : (
            'Enter a filename:'
          )
        }
        confirmButtonText={
          filenameActionContext?.type === 'download'
            ? 'Download'
            : 'Save to Library'
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
        sourceToolTitle={choiceModalToolTitle || 'Unknown Tool'}
        dataTypeReceived={
          incomingItdeFiles && incomingItdeFiles.length > 1 ? 'images' : 'image'
        }
        itemCount={incomingItdeFiles?.length || 0}
        options={itdeChoiceModalOptions}
        onOptionSelect={handleActualItdeAccept}
        title="Incoming Montage Images"
        message={`Received ${incomingItdeFiles?.length || 0} image(s) from "${choiceModalToolTitle || 'another tool'}". How to proceed?`}
      />
    </div>
  );
}
