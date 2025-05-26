'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useImageBlender, BlenderImage } from '../_hooks/useImageBlender';
import ImageInputCard from './ImageInputCard';
import Button from '../../_components/form/Button';
import Input from '../../_components/form/Input';
import Checkbox from '../../_components/form/Checkbox';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import ItdeAcceptChoiceModal, { ItdeChoiceOption } from '../../_components/shared/ItdeAcceptChoiceModal';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata } from '@/src/types/tools';
import importedMetadata from '../metadata.json';
import { PhotoIcon, XCircleIcon, ArrowPathIcon, CheckBadgeIcon } from '@heroicons/react/20/solid';

const metadata = importedMetadata as ToolMetadata;

interface ImageBlenderClientProps {
  toolRoute: string;
}

export default function ImageBlenderClient({ toolRoute }: ImageBlenderClientProps) {
  const {
    state,
    isLoadingState,
    errorLoadingState,
    isBlending,
    isLoadingHtmlImages,
    htmlImageLoadingError,
    addImages,
    removeImage,
    updateImage,
    reorderImage,
    updateSetting,
    clearAll,
    saveStateNow,
    saveOutputPermanently,
    getBlenderImageWithPreviewUrl,
  } = useImageBlender(toolRoute);

  const { getFile } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const [isAddImagesModalOpen, setIsAddImagesModalOpen] = useState(false);
  const [isFilenamePromptOpen, setIsFilenamePromptOpen] = useState(false);
  const [filenamePromptAction, setFilenamePromptAction] = useState<'save' | 'download' | null>(null);
  const [filenamePromptInitialValue, setFilenamePromptInitialValue] = useState('');
  
  const [uiError, setUiError] = useState<string | null>(null);
  const [manualSaveSuccess, setManualSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [blendedPreviewUrl, setBlendedPreviewUrl] = useState<string | null>(null);
  const [processedFileIsPermanent, setProcessedFileIsPermanent] = useState(false);
  const [processedFilenameForDisplay, setProcessedFilenameForDisplay] = useState<string | null>(null);


  const [itdeActionChoiceModalOpen, setItdeActionChoiceModalOpen] = useState(false);
  const [incomingItdeFiles, setIncomingItdeFiles] = useState<StoredFile[] | null>(null);
  const [choiceModalToolTitle, setChoiceModalToolTitle] = useState<string | null>(null);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);


  useEffect(() => {
    if (!isLoadingState) {
      if (!initialToolStateLoadCompleteRef.current) initialToolStateLoadCompleteRef.current = true;
    } else {
      if (initialToolStateLoadCompleteRef.current) initialToolStateLoadCompleteRef.current = false;
    }
  }, [isLoadingState]);


  // Effect to update blended image preview
  useEffect(() => {
    let objectUrl: string | null = null;
    const updatePreview = async () => {
      if (state.processedFileId) {
        const file = await getFile(state.processedFileId);
        if (file?.blob) {
          objectUrl = URL.createObjectURL(file.blob);
          setBlendedPreviewUrl(objectUrl);
          setProcessedFileIsPermanent(file.isTemporary === false);
          setProcessedFilenameForDisplay(file.filename);
        } else {
          setBlendedPreviewUrl(null);
          setProcessedFileIsPermanent(false);
          setProcessedFilenameForDisplay(null);
        }
      } else {
        setBlendedPreviewUrl(null);
        setProcessedFileIsPermanent(false);
        setProcessedFilenameForDisplay(null);
      }
    };
    updatePreview();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [state.processedFileId, getFile]);

  const handleProcessIncomingSignal = useCallback(async (signal: IncomingSignal) => {
    setUiError(null);
    const sourceMeta = getToolMetadata(signal.sourceDirective);
    if (!sourceMeta) {
      setUiError(`Metadata for ${signal.sourceDirective} not found.`);
      return;
    }
    const resolvedPayload: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);
    
    if (resolvedPayload.type === 'error' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
      setUiError(resolvedPayload.errorMessage || `No data from ${signal.sourceToolTitle}.`);
      return;
    }
    const receivedImageItems = resolvedPayload.data.filter(item => item.type?.startsWith('image/') && 'id' in item) as StoredFile[];
    if (receivedImageItems.length === 0) {
      setUiError(`No images from ${signal.sourceToolTitle}.`);
      return;
    }
    
    setUserDeferredAutoPopup(false);
    if (state.inputImages.length === 0) {
      await addImages(receivedImageItems);
    } else {
      setChoiceModalToolTitle(signal.sourceToolTitle);
      setIncomingItdeFiles(receivedImageItems);
      setItdeActionChoiceModalOpen(true);
    }
  }, [getToolMetadata, state.inputImages.length, addImages]);

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: metadata.directive,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    const canProceed = !isLoadingState && initialToolStateLoadCompleteRef.current && !isBlending && !isLoadingHtmlImages;
    if (canProceed && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !itdeActionChoiceModalOpen && !userDeferredAutoPopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingState, isBlending, isLoadingHtmlImages, itdeTarget, userDeferredAutoPopup, itdeActionChoiceModalOpen]);


  const handleFilesSelectedForInput = useCallback((files: StoredFile[]) => {
    setIsAddImagesModalOpen(false);
    if (files?.length > 0) {
      const imageFiles = files.filter(f => f.type?.startsWith('image/'));
      if (imageFiles.length > 0) {
        addImages(imageFiles);
        setUiError(null);
      } else {
        setUiError('No valid image files selected.');
      }
    }
  }, [addImages]);

  const handleClearClient = useCallback(async () => {
    await clearAll();
    setUiError(null);
    setManualSaveSuccess(false);
    setDownloadSuccess(false);
  }, [clearAll]);

  const generateDefaultOutputFilename = useCallback(() => {
    return `blended-image-${Date.now()}.png`;
  }, []);

  const handleInitiateSave = useCallback(async () => {
    if (!state.processedFileId || isBlending) return;
    if (processedFileIsPermanent && state.lastUserGivenFilename) {
        setManualSaveSuccess(true); // Already saved with this name
        setTimeout(() => setManualSaveSuccess(false), 1500);
        return;
    }
    const filenameToUse = state.lastUserGivenFilename || generateDefaultOutputFilename();
    setFilenamePromptInitialValue(filenameToUse);
    setFilenamePromptAction('save');
    setIsFilenamePromptOpen(true);
  }, [state.processedFileId, isBlending, processedFileIsPermanent, state.lastUserGivenFilename, generateDefaultOutputFilename]);

  const handleInitiateDownload = useCallback(async () => {
    if (!blendedPreviewUrl || isBlending) return;
    const filenameToUse = state.lastUserGivenFilename || generateDefaultOutputFilename();
    setFilenamePromptInitialValue(filenameToUse);
    setFilenamePromptAction('download');
    setIsFilenamePromptOpen(true);
  }, [blendedPreviewUrl, isBlending, state.lastUserGivenFilename, generateDefaultOutputFilename]);

  const handleConfirmFilename = useCallback(async (confirmedFilename: string) => {
    setIsFilenamePromptOpen(false);
    setUiError(null);
    const action = filenamePromptAction;
    setFilenamePromptAction(null);

    if (action === 'save') {
      const savedId = await saveOutputPermanently(confirmedFilename);
      if (savedId) {
        setManualSaveSuccess(true);
        setTimeout(() => setManualSaveSuccess(false), 2500);
      } else {
        setUiError('Failed to save image to library.');
      }
    } else if (action === 'download') {
      if (blendedPreviewUrl) {
        const link = document.createElement('a');
        link.href = blendedPreviewUrl;
        link.download = confirmedFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 2000);
        // Persist last given filename if download is successful
        await saveStateNow({ ...state, lastUserGivenFilename: confirmedFilename });
      } else {
        setUiError('No image data to download.');
      }
    }
  }, [filenamePromptAction, saveOutputPermanently, blendedPreviewUrl, saveStateNow, state]);

  const itdeSendableItems = useMemo(() => {
    if (state.processedFileId) {
      return [{
        id: state.processedFileId,
        type: 'image/png', // Assuming PNG output
        filename: state.lastUserGivenFilename || generateDefaultOutputFilename(),
        size: 0, // Placeholder, actual size in DB
        blob: new Blob(), // Placeholder
        createdAt: new Date(),
        isTemporary: !processedFileIsPermanent,
      } as StoredFile];
    }
    return [];
  }, [state.processedFileId, state.lastUserGivenFilename, generateDefaultOutputFilename, processedFileIsPermanent]);

  const onBeforeSendToTool = useCallback(async () => {
    if (state.processedFileId && !processedFileIsPermanent) {
      const filename = state.lastUserGivenFilename || generateDefaultOutputFilename();
      const savedId = await saveOutputPermanently(filename);
      if (!savedId) {
        setUiError("Failed to make output permanent before sending. Please save manually.");
        return false; // Prevent ITDE signal
      }
    }
    return true; // Proceed with ITDE signal
  }, [state.processedFileId, processedFileIsPermanent, state.lastUserGivenFilename, generateDefaultOutputFilename, saveOutputPermanently]);

  const itdeChoiceModalOptions: ItdeChoiceOption[] = useMemo(() => [
    { label: 'Add to Current Blend', actionKey: 'add', variant: 'primary' },
    { label: 'Replace Current Images', actionKey: 'replace', variant: 'accent' },
  ], []);

  const handleActualItdeAccept = useCallback(async (actionKey: string) => {
    if (!incomingItdeFiles || incomingItdeFiles.length === 0) return;
    if (actionKey === 'replace') await clearAll(); // Clears existing input images
    await addImages(incomingItdeFiles);
    setChoiceModalToolTitle(null);
    setItdeActionChoiceModalOpen(false);
    setIncomingItdeFiles(null);
  }, [incomingItdeFiles, clearAll, addImages]);


  const combinedError = uiError || errorLoadingState || htmlImageLoadingError;
  const isLoadingOverall = isLoadingState || isBlending || isLoadingHtmlImages;

  if (isLoadingState && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Loading Image Blender...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Controls Section */}
      <div className="p-4 rounded-lg bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <Input
            label="Output Width (px)"
            type="number"
            id="outputWidth"
            value={state.outputWidth}
            onChange={(e) => updateSetting('outputWidth', parseInt(e.target.value, 10) || 0)}
            min={10}
            max={4096}
            disabled={isLoadingOverall}
          />
          <Input
            label="Output Height (px)"
            type="number"
            id="outputHeight"
            value={state.outputHeight}
            onChange={(e) => updateSetting('outputHeight', parseInt(e.target.value, 10) || 0)}
            min={10}
            max={4096}
            disabled={isLoadingOverall}
          />
          <div className="flex items-end gap-2">
            <Input
              label="Background Color"
              type="color"
              id="backgroundColor"
              value={state.backgroundColor}
              onChange={(e) => updateSetting('backgroundColor', e.target.value)}
              disabled={isLoadingOverall || state.transparentBackground}
              containerClassName="flex-grow"
            />
            <Checkbox
              label="Transparent"
              id="transparentBackground"
              checked={state.transparentBackground}
              onChange={(e) => updateSetting('transparentBackground', e.target.checked)}
              disabled={isLoadingOverall}
              className="pb-2"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center justify-between pt-3 border-t border-[rgb(var(--color-border-base))]">
          <Button
            variant="accent2"
            onClick={() => setIsAddImagesModalOpen(true)}
            isLoading={isLoadingHtmlImages && state.inputImages.length === 0}
            disabled={isLoadingOverall && !isLoadingState}
            iconLeft={<PhotoIcon className="h-5 w-5" />}
          >
            Add Images
          </Button>
          <div className="flex gap-2 items-center">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen && !itdeActionChoiceModalOpen}
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
            <OutputActionButtons
              canPerform={!!blendedPreviewUrl && !isLoadingOverall}
              isSaveSuccess={manualSaveSuccess || (processedFileIsPermanent && !!state.lastUserGivenFilename)}
              isDownloadSuccess={downloadSuccess}
              canInitiateSave={!!state.processedFileId && !processedFileIsPermanent}
              onInitiateSave={handleInitiateSave}
              onInitiateDownload={handleInitiateDownload}
              onClear={handleClearClient}
              directiveName={metadata.directive}
              outputConfig={metadata.outputConfig}
              selectedOutputItems={itdeSendableItems}
              onBeforeSignal={onBeforeSendToTool}
            />
          </div>
        </div>
      </div>

      {combinedError && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2">
          <XCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div><strong className="font-semibold">Error:</strong> {combinedError}</div>
        </div>
      )}

      {/* Input Images Area */}
      {state.inputImages.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[rgb(var(--color-text-muted))]">Input Images ({state.inputImages.length}) - Drag to reorder (not implemented yet)</h3>
          <div className="flex gap-4 overflow-x-auto pb-3">
            {state.inputImages.sort((a,b) => a.order - b.order).map((img, index) => {
              const hydratedImage = getBlenderImageWithPreviewUrl(img.instanceId);
              return hydratedImage ? (
                <ImageInputCard
                  key={img.instanceId}
                  image={hydratedImage}
                  onUpdate={updateImage}
                  onRemove={removeImage}
                  onReorder={reorderImage}
                  isLoading={isLoadingOverall}
                  isFirst={index === 0}
                  isLast={index === state.inputImages.length - 1}
                />
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* Output Preview Area */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Blended Output
            </label>
            {processedFileIsPermanent && processedFilenameForDisplay && (
                <div className="bg-green-100 text-green-700 px-2 py-0.5 text-xs rounded-full flex items-center gap-1 shadow">
                    <CheckBadgeIcon className="h-4 w-4" /> Saved: {processedFilenameForDisplay}
                </div>
            )}
        </div>
        <div className="w-full aspect-video border rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden relative">
          {isBlending && !blendedPreviewUrl && (
            <div className="flex flex-col items-center text-sm text-[rgb(var(--color-text-muted))]">
              <ArrowPathIcon className="animate-spin h-8 w-8 mb-2" />
              Blending...
            </div>
          )}
          {blendedPreviewUrl ? (
            <Image src={blendedPreviewUrl} alt="Blended Output" layout="fill" objectFit="contain" unoptimized />
          ) : (
            !isBlending && <span className="text-sm italic text-[rgb(var(--color-text-muted))]">
              {state.inputImages.length > 0 ? 'Output appears here' : 'Add images to start blending'}
            </span>
          )}
           {isBlending && blendedPreviewUrl && ( // Spinner overlay when re-blending
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                <ArrowPathIcon className="animate-spin h-8 w-8 text-[rgb(var(--color-text-link))]" />
            </div>
          )}
        </div>
      </div>

      <FileSelectionModal
        isOpen={isAddImagesModalOpen}
        onClose={() => setIsAddImagesModalOpen(false)}
        onFilesSelected={handleFilesSelectedForInput}
        mode="selectExistingOrUploadNew"
        accept="image/*"
        selectionMode="multiple"
        libraryFilter={{ category: 'image' }}
        initialTab="library"
      />
      <FilenamePromptModal
        isOpen={isFilenamePromptOpen}
        onClose={() => { setIsFilenamePromptOpen(false); setFilenamePromptAction(null); }}
        onConfirm={handleConfirmFilename}
        initialFilename={filenamePromptInitialValue}
        title={filenamePromptAction === 'save' ? 'Save Blended Image' : 'Download Blended Image'}
        confirmButtonText={filenamePromptAction === 'save' ? 'Save to Library' : 'Download'}
        filenameAction={filenamePromptAction || undefined}
      />
       <IncomingDataModal
        isOpen={itdeTarget.isModalOpen && !itdeActionChoiceModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={itdeTarget.acceptSignal}
        onIgnore={itdeTarget.ignoreSignal}
        onDeferAll={() => { setUserDeferredAutoPopup(true); itdeTarget.closeModal(); }}
        onIgnoreAll={() => { setUserDeferredAutoPopup(false); itdeTarget.ignoreAllSignals(); }}
      />
      <ItdeAcceptChoiceModal
        isOpen={itdeActionChoiceModalOpen}
        onClose={() => { setItdeActionChoiceModalOpen(false); setIncomingItdeFiles(null); setUserDeferredAutoPopup(true); }}
        sourceToolTitle={choiceModalToolTitle || 'Unknown Tool'}
        dataTypeReceived={incomingItdeFiles && incomingItdeFiles.length > 1 ? 'images' : 'image'}
        itemCount={incomingItdeFiles?.length || 0}
        options={itdeChoiceModalOptions}
        onOptionSelect={handleActualItdeAccept}
        title="Incoming Images for Blender"
      />
    </div>
  );
}