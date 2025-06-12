'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import Image from 'next/image';
import { useDebouncedCallback } from 'use-debounce';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import useToolState from '@/app/tool/_hooks/useToolState';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata } from '@/src/types/tools';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import Button from '@/app/tool/_components/form/Button';
import Input from '@/app/tool/_components/form/Input';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import { OutputActionButtons } from '@/app/tool/_components/shared/OutputActionButtons';
import useItdeTargetHandler, {
  IncomingSignal,
} from '@/app/tool/_hooks/useItdeTargetHandler';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '@/app/tool/_components/shared/ReceiveItdeDataTrigger';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import importedMetadata from '../metadata.json';
import {
  PhotoIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/20/solid';

const metadata = importedMetadata as ToolMetadata;

interface ImageResizerToolState {
  selectedFileId: string | null;
  processedFileId: string | null;
  width: string;
  height: string;
  maintainAspectRatio: boolean;
  lastUserGivenFilename: string | null;
}

const DEFAULT_TOOL_STATE: ImageResizerToolState = {
  selectedFileId: null,
  processedFileId: null,
  width: '',
  height: '',
  maintainAspectRatio: true,
  lastUserGivenFilename: null,
};

interface ImageResizerClientProps {
  toolRoute: string;
}

export default function ImageResizerClient({
  toolRoute,
}: ImageResizerClientProps) {
  const {
    state: toolState,
    setState,
    isLoadingState,
    clearStateAndPersist,
    saveStateNow,
  } = useToolState<ImageResizerToolState>(toolRoute, DEFAULT_TOOL_STATE);

  const { getFile, addFile, makeFilePermanentAndUpdate, cleanupOrphanedTemporaryFiles } =
    useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [isFilenamePromptOpen, setIsFilenamePromptOpen] = useState(false);
  const [filenamePromptAction, setFilenamePromptAction] = useState<'save' | 'download' | null>(null);
  const [filenamePromptInitialValue, setFilenamePromptInitialValue] = useState('');

  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [processedImageSrc, setProcessedImageSrc] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [manualSaveSuccess, setManualSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [processedFileIsPermanent, setProcessedFileIsPermanent] = useState(false);
  const [processedStoredFileForItde, setProcessedStoredFileForItde] = useState<StoredFile | null>(null);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);
  const lastChangedField = useRef<'width' | 'height' | null>(null);

  const directiveName = metadata.directive;

  const handleProcessIncomingSignal = useCallback(async (signal: IncomingSignal) => {
    setError(null);
    const sourceMeta = getToolMetadata(signal.sourceDirective);
    if (!sourceMeta) {
      setError('Metadata not found for source tool.');
      return;
    }
    const resolvedPayload: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);
    if (resolvedPayload.type === 'error' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
      setError(resolvedPayload.errorMessage || 'No transferable data received from source.');
      return;
    }
    const firstImageItem = resolvedPayload.data.find(item => item.type?.startsWith('image/') && 'id' in item) as StoredFile | undefined;
    if (firstImageItem?.id) {
      const oldSelectedId = toolState.selectedFileId;
      const oldProcessedId = toolState.processedFileId;
      const newState: Partial<ImageResizerToolState> = { selectedFileId: firstImageItem.id, processedFileId: null };
      setState(newState);
      await saveStateNow({ ...toolState, ...newState });
      if (oldSelectedId && oldSelectedId !== firstImageItem.id) cleanupOrphanedTemporaryFiles([oldSelectedId]).catch(e => console.error('[Resizer ITDE] Cleanup failed:', e));
      if (oldProcessedId) cleanupOrphanedTemporaryFiles([oldProcessedId]).catch(e => console.error('[Resizer ITDE] Cleanup failed:', e));
    } else {
      setError('No valid image found in received ITDE data.');
    }
    setUserDeferredAutoPopup(false);
  }, [getToolMetadata, setState, saveStateNow, toolState, cleanupOrphanedTemporaryFiles]);

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingState) {
      if (!initialToolStateLoadCompleteRef.current) initialToolStateLoadCompleteRef.current = true;
    } else {
      if (initialToolStateLoadCompleteRef.current) initialToolStateLoadCompleteRef.current = false;
    }
  }, [isLoadingState]);

  useEffect(() => {
    const canProceed = !isLoadingState && initialToolStateLoadCompleteRef.current;
    if (canProceed && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredAutoPopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingState, itdeTarget, userDeferredAutoPopup]);

  useEffect(() => {
    let objectUrl: string | null = null;
    const loadOriginalImage = async () => {
      if (!toolState.selectedFileId) {
        setOriginalImageSrc(null);
        setOriginalDimensions(null);
        setState({ width: '', height: '' });
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const file = await getFile(toolState.selectedFileId);
        if (!file?.blob) throw new Error('Selected file or its blob not found.');
        objectUrl = URL.createObjectURL(file.blob);
        setOriginalImageSrc(objectUrl);
        const img = new window.Image();
        img.onload = () => {
          setOriginalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
          if (!toolState.width && !toolState.height) {
            setState({ width: img.naturalWidth.toString(), height: img.naturalHeight.toString() });
          }
          setIsLoading(false);
        };
        img.onerror = () => {
          setError('Failed to load image dimensions.');
          setIsLoading(false);
        };
        img.src = objectUrl;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading image file.');
        setIsLoading(false);
      }
    };
    loadOriginalImage();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [toolState.selectedFileId, getFile, setState]);

  useEffect(() => {
    let objectUrl: string | null = null;
    const loadProcessedImage = async () => {
      if (!toolState.processedFileId) {
        setProcessedImageSrc(null);
        setProcessedFileIsPermanent(false);
        setProcessedStoredFileForItde(null);
        return;
      }
      try {
        const file = await getFile(toolState.processedFileId);
        if (file?.blob) {
          objectUrl = URL.createObjectURL(file.blob);
          setProcessedImageSrc(objectUrl);
          setProcessedFileIsPermanent(file.isTemporary === false);
          setProcessedStoredFileForItde(file);
        }
      } catch (err) {
        setError('Failed to load processed image preview.');
      }
    };
    loadProcessedImage();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [toolState.processedFileId, getFile]);

  const debouncedAspectRatioCalculation = useDebouncedCallback(() => {
    if (!toolState.maintainAspectRatio || !originalDimensions) return;
    
    const w = parseFloat(toolState.width);
    const h = parseFloat(toolState.height);

    if (lastChangedField.current === 'width' && w > 0) {
      const newHeight = Math.round((w / originalDimensions.width) * originalDimensions.height);
      if (newHeight.toString() !== toolState.height) {
        setState({ height: newHeight.toString() });
      }
    } else if (lastChangedField.current === 'height' && h > 0) {
      const newWidth = Math.round((h / originalDimensions.height) * originalDimensions.width);
      if (newWidth.toString() !== toolState.width) {
        setState({ width: newWidth.toString() });
      }
    }
  }, 300);

  useEffect(() => {
    debouncedAspectRatioCalculation();
  }, [toolState.width, toolState.height, toolState.maintainAspectRatio, originalDimensions, debouncedAspectRatioCalculation]);

  const handleFilesSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsLibraryModalOpen(false);
    setError(null);
    if (files?.[0]?.type?.startsWith('image/') && files[0].id) {
      const oldSelectedId = toolState.selectedFileId;
      const oldProcessedId = toolState.processedFileId;
      const newState: Partial<ImageResizerToolState> = { selectedFileId: files[0].id, processedFileId: null, width: '', height: '' };
      setState(newState);
      await saveStateNow({ ...toolState, ...newState });
      if (oldSelectedId && oldSelectedId !== files[0].id) cleanupOrphanedTemporaryFiles([oldSelectedId]);
      if (oldProcessedId) cleanupOrphanedTemporaryFiles([oldProcessedId]);
    } else if (files?.length) {
      setError(`Selected file "${files[0].filename}" is not a recognized image type.`);
    }
  }, [toolState, setState, saveStateNow, cleanupOrphanedTemporaryFiles]);

  const handleResize = useCallback(async () => {
    if (!originalImageSrc) {
      setError('Please select an image first.');
      return;
    }
    const targetWidth = parseInt(toolState.width, 10);
    const targetHeight = parseInt(toolState.height, 10);
    if (isNaN(targetWidth) || isNaN(targetHeight) || targetWidth <= 0 || targetHeight <= 0) {
      setError('Please enter valid positive numbers for width and height.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image for processing.'));
        img.src = originalImageSrc;
      });

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context.');
      
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const originalFile = await getFile(toolState.selectedFileId!);
      const outputMimeType = originalFile?.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
      const quality = outputMimeType === 'image/jpeg' ? 0.92 : undefined;
      
      const resizedBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, outputMimeType, quality));
      if (!resizedBlob) throw new Error('Failed to create blob from canvas.');

      const originalFilename = originalFile?.filename || 'image.png';
      const baseName = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
      const ext = outputMimeType.split('/')[1];
      const outputFileName = `resized-${baseName}-${targetWidth}x${targetHeight}.${ext}`;

      const newFileId = await addFile(resizedBlob, outputFileName, outputMimeType, true);
      
      const oldProcessedId = toolState.processedFileId;
      setState({ processedFileId: newFileId, lastUserGivenFilename: null });
      if (oldProcessedId) cleanupOrphanedTemporaryFiles([oldProcessedId]);

      setManualSaveSuccess(false);
      setDownloadSuccess(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred during resizing.');
    } finally {
      setIsLoading(false);
    }
  }, [originalImageSrc, toolState.width, toolState.height, toolState.selectedFileId, toolState.processedFileId, getFile, addFile, setState, cleanupOrphanedTemporaryFiles]);

  const handleClear = useCallback(async () => {
    const oldSelectedId = toolState.selectedFileId;
    const oldProcessedId = toolState.processedFileId;
    await clearStateAndPersist();
    setError(null);
    setManualSaveSuccess(false);
    setDownloadSuccess(false);
    if (oldSelectedId) cleanupOrphanedTemporaryFiles([oldSelectedId]);
    if (oldProcessedId) cleanupOrphanedTemporaryFiles([oldProcessedId]);
  }, [clearStateAndPersist, toolState.selectedFileId, toolState.processedFileId, cleanupOrphanedTemporaryFiles]);

  const generateDefaultOutputFilename = useCallback(() => {
    const originalFile = processedStoredFileForItde;
    const originalName = originalFile?.filename || 'resized-image.png';
    return originalName;
  }, [processedStoredFileForItde]);

  const initiateSave = async () => {
    if (!toolState.processedFileId) return;
    const filenameToUse = toolState.lastUserGivenFilename || generateDefaultOutputFilename();
    setFilenamePromptInitialValue(filenameToUse);
    setFilenamePromptAction('save');
    setIsFilenamePromptOpen(true);
  };

  const initiateDownload = async () => {
    if (!processedImageSrc) return;
    const filenameToUse = toolState.lastUserGivenFilename || generateDefaultOutputFilename();
    setFilenamePromptInitialValue(filenameToUse);
    setFilenamePromptAction('download');
    setIsFilenamePromptOpen(true);
  };

  const handleConfirmFilename = async (filename: string) => {
    setIsFilenamePromptOpen(false);
    if (filenamePromptAction === 'save') {
      if (!toolState.processedFileId) return;
      const success = await makeFilePermanentAndUpdate(toolState.processedFileId, filename);
      if (success) {
        setProcessedFileIsPermanent(true);
        setManualSaveSuccess(true);
        setTimeout(() => setManualSaveSuccess(false), 2000);
        setState({ lastUserGivenFilename: filename });
      } else {
        setError('Failed to save file to library.');
      }
    } else if (filenamePromptAction === 'download') {
      if (!processedImageSrc) return;
      const link = document.createElement('a');
      link.href = processedImageSrc;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
      setState({ lastUserGivenFilename: filename });
    }
    setFilenamePromptAction(null);
  };

  const imageFilter = useMemo(() => ({ category: 'image' as const }), []);
  const canPerformActions = !!toolState.processedFileId && !isLoading;
  const canInitiateSaveCurrent = canPerformActions && !processedFileIsPermanent;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 p-4 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          <Button
            variant="accent2"
            iconLeft={<PhotoIcon className="h-5 w-5" />}
            onClick={() => setIsLibraryModalOpen(true)}
            disabled={isLoading}
            className="w-full"
          >
            {toolState.selectedFileId ? 'Change Image' : 'Select Image'}
          </Button>
          <Input
            label="Width (px)"
            id="width"
            type="number"
            value={toolState.width}
            onChange={(e) => {
              lastChangedField.current = 'width';
              setState({ width: e.target.value });
            }}
            placeholder="e.g., 1920"
            disabled={!toolState.selectedFileId || isLoading}
          />
          <Input
            label="Height (px)"
            id="height"
            type="number"
            value={toolState.height}
            onChange={(e) => {
              lastChangedField.current = 'height';
              setState({ height: e.target.value });
            }}
            placeholder="e.g., 1080"
            disabled={!toolState.selectedFileId || isLoading}
          />
          <div className="pt-7">
            <Checkbox
              label="Maintain aspect ratio"
              id="aspectRatio"
              checked={toolState.maintainAspectRatio}
              onChange={(e) => setState({ maintainAspectRatio: e.target.checked })}
              disabled={!toolState.selectedFileId || isLoading}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center pt-3 border-t border-[rgb(var(--color-border-base))] mt-2">
          <Button
            variant="primary"
            onClick={handleResize}
            disabled={!toolState.selectedFileId || isLoading}
            isLoading={isLoading}
            iconLeft={<ArrowPathIcon className="h-5 w-5" />}
          >
            Resize Image
          </Button>
          <div className="flex gap-2 ml-auto items-center">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
            <OutputActionButtons
              canPerform={canPerformActions}
              isSaveSuccess={manualSaveSuccess}
              isDownloadSuccess={downloadSuccess}
              canInitiateSave={canInitiateSaveCurrent}
              onInitiateSave={initiateSave}
              onInitiateDownload={initiateDownload}
              onClear={handleClear}
              directiveName={directiveName}
              outputConfig={metadata.outputConfig}
              selectedOutputItems={processedStoredFileForItde ? [processedStoredFileForItde] : []}
            />
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-[rgb(var(--color-text-muted))]">Original Image</h3>
          <div className="w-full aspect-video border rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {originalImageSrc ? (
              <Image src={originalImageSrc} alt="Original" width={originalDimensions?.width || 300} height={originalDimensions?.height || 200} className="max-w-full max-h-full object-contain" unoptimized />
            ) : (<span className="text-sm italic text-[rgb(var(--color-text-muted))]">Select an image</span>)}
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-[rgb(var(--color-text-muted))]">Resized Image</h3>
          <div className="w-full aspect-video border rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {isLoading && !processedImageSrc ? (
              <div className="flex flex-col items-center text-sm italic text-[rgb(var(--color-text-muted))]">
                <ArrowPathIcon className="animate-spin h-8 w-8 mb-2" />
                Resizing...
              </div>
            ) : processedImageSrc ? (
              <Image src={processedImageSrc} alt="Resized" width={parseInt(toolState.width) || 300} height={parseInt(toolState.height) || 200} className="max-w-full max-h-full object-contain" unoptimized />
            ) : (<span className="text-sm italic text-[rgb(var(--color-text-muted))]">Output appears here</span>)}
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
        libraryFilter={imageFilter}
      />
      <FilenamePromptModal
        isOpen={isFilenamePromptOpen}
        onClose={() => setIsFilenamePromptOpen(false)}
        onConfirm={handleConfirmFilename}
        initialFilename={filenamePromptInitialValue}
        title={filenamePromptAction === 'save' ? 'Save Resized Image' : 'Download Resized Image'}
        confirmButtonText={filenamePromptAction === 'save' ? 'Save to Library' : 'Download'}
        filenameAction={filenamePromptAction || undefined}
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