'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import Image from 'next/image';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import useToolState from '@/app/tool/_hooks/useToolState';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata } from '@/src/types/tools';
import { formatBytes } from '@/app/lib/utils';
import importedMetadata from '../metadata.json';

import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import { OutputActionButtons } from '@/app/tool/_components/shared/OutputActionButtons';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '@/app/tool/_components/shared/ReceiveItdeDataTrigger';

import Button from '@/app/tool/_components/form/Button';
import RadioGroup from '@/app/tool/_components/form/RadioGroup';
import Range from '@/app/tool/_components/form/Range';

import useItdeTargetHandler, {
  IncomingSignal,
} from '@/app/tool/_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';

import { PhotoIcon, ArrowPathIcon } from '@heroicons/react/20/solid';

const metadata = importedMetadata as ToolMetadata;

type TargetFormat = 'png' | 'jpeg' | 'webp';

interface ImageConversionToolState {
  selectedFileId: string | null;
  processedFileId: string | null;
  targetFormat: TargetFormat;
  quality: number;
  lastUserGivenFilename: string | null;
}

const DEFAULT_TOOL_STATE: ImageConversionToolState = {
  selectedFileId: null,
  processedFileId: null,
  targetFormat: 'png',
  quality: 92,
  lastUserGivenFilename: null,
};

interface FileInfo {
  name: string;
  size: number;
  type: string;
  dimensions: { width: number; height: number };
}

interface ImageConversionClientProps {
  toolRoute: string;
}

export default function ImageConversionClient({
  toolRoute,
}: ImageConversionClientProps) {
  const {
    state: toolState,
    setState,
    isLoadingState,
    clearStateAndPersist,
    saveStateNow,
  } = useToolState<ImageConversionToolState>(toolRoute, DEFAULT_TOOL_STATE);

  const {
    getFile,
    addFile,
    makeFilePermanentAndUpdate,
    cleanupOrphanedTemporaryFiles,
  } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [isFilenamePromptOpen, setIsFilenamePromptOpen] = useState(false);
  const [filenamePromptAction, setFilenamePromptAction] = useState<
    'save' | 'download' | null
  >(null);
  const [filenamePromptInitialValue, setFilenamePromptInitialValue] =
    useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualSaveSuccess, setManualSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [processedImageSrc, setProcessedImageSrc] = useState<string | null>(
    null
  );
  const [originalFileInfo, setOriginalFileInfo] = useState<FileInfo | null>(
    null
  );
  const [processedFileInfo, setProcessedFileInfo] = useState<Pick<
    FileInfo,
    'size' | 'type'
  > | null>(null);
  const [processedStoredFileForItde, setProcessedStoredFileForItde] =
    useState<StoredFile | null>(null);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const directiveName = metadata.directive;

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      setError(null);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setError('Metadata not found for source tool.');
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
        setError(
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
        const oldProcessedId = toolState.processedFileId;
        const newState: Partial<ImageConversionToolState> = {
          selectedFileId: firstImageItem.id,
          processedFileId: null,
        };
        setState(newState);
        await saveStateNow({ ...toolState, ...newState });
        if (oldSelectedId && oldSelectedId !== firstImageItem.id)
          cleanupOrphanedTemporaryFiles([oldSelectedId]);
        if (oldProcessedId) cleanupOrphanedTemporaryFiles([oldProcessedId]);
      } else {
        setError('No valid image found in received ITDE data.');
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
    if (
      !isLoadingState &&
      initialToolStateLoadCompleteRef.current &&
      itdeTarget.pendingSignals.length > 0 &&
      !itdeTarget.isModalOpen &&
      !userDeferredAutoPopup
    ) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingState, itdeTarget, userDeferredAutoPopup]);

  useEffect(() => {
    let objectUrl: string | null = null;
    const loadOriginalImage = async () => {
      if (!toolState.selectedFileId) {
        setOriginalImageSrc(null);
        setOriginalFileInfo(null);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const file = await getFile(toolState.selectedFileId);
        if (!file?.blob)
          throw new Error('Selected file or its blob not found.');
        objectUrl = URL.createObjectURL(file.blob);
        setOriginalImageSrc(objectUrl);
        const img = new window.Image();
        img.onload = () => {
          setOriginalFileInfo({
            name: file.filename,
            size: file.size,
            type: file.type,
            dimensions: { width: img.naturalWidth, height: img.naturalHeight },
          });
          setIsLoading(false);
        };
        img.onerror = () => {
          setError('Failed to load image dimensions.');
          setIsLoading(false);
        };
        img.src = objectUrl;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Error loading image file.'
        );
        setIsLoading(false);
      }
    };
    loadOriginalImage();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [toolState.selectedFileId, getFile]);

  useEffect(() => {
    let objectUrl: string | null = null;
    const loadProcessedImage = async () => {
      if (!toolState.processedFileId) {
        setProcessedImageSrc(null);
        setProcessedFileInfo(null);
        setProcessedStoredFileForItde(null);
        return;
      }
      try {
        const file = await getFile(toolState.processedFileId);
        if (file?.blob) {
          objectUrl = URL.createObjectURL(file.blob);
          setProcessedImageSrc(objectUrl);
          setProcessedFileInfo({ size: file.size, type: file.type });
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

  const handleFilesSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLibraryModalOpen(false);
      setError(null);
      if (files?.[0]?.type?.startsWith('image/') && files[0].id) {
        const oldSelectedId = toolState.selectedFileId;
        const oldProcessedId = toolState.processedFileId;
        const newState: Partial<ImageConversionToolState> = {
          selectedFileId: files[0].id,
          processedFileId: null,
        };
        setState(newState);
        await saveStateNow({ ...toolState, ...newState });
        if (oldSelectedId && oldSelectedId !== files[0].id)
          cleanupOrphanedTemporaryFiles([oldSelectedId]);
        if (oldProcessedId) cleanupOrphanedTemporaryFiles([oldProcessedId]);
      } else if (files?.length) {
        setError(
          `Selected file "${files[0].filename}" is not a recognized image type.`
        );
      }
    },
    [toolState, setState, saveStateNow, cleanupOrphanedTemporaryFiles]
  );

  const handleConvert = useCallback(async () => {
    if (!originalImageSrc || !originalFileInfo) {
      setError('Please select an image first.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () =>
          reject(new Error('Failed to load image for processing.'));
        img.src = originalImageSrc;
      });

      const canvas = document.createElement('canvas');
      canvas.width = originalFileInfo.dimensions.width;
      canvas.height = originalFileInfo.dimensions.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context.');

      if (toolState.targetFormat === 'jpeg') {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);

      const outputMimeType = `image/${toolState.targetFormat}`;
      const quality =
        toolState.targetFormat === 'png' ? undefined : toolState.quality / 100;

      const convertedBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, outputMimeType, quality)
      );
      if (!convertedBlob) throw new Error('Failed to create blob from canvas.');

      const baseName =
        originalFileInfo.name.substring(
          0,
          originalFileInfo.name.lastIndexOf('.')
        ) || originalFileInfo.name;
      const outputFileName = `${baseName}.${toolState.targetFormat}`;

      const newFileId = await addFile(
        convertedBlob,
        outputFileName,
        outputMimeType,
        true
      );

      const oldProcessedId = toolState.processedFileId;
      setState({ processedFileId: newFileId, lastUserGivenFilename: null });
      if (oldProcessedId) cleanupOrphanedTemporaryFiles([oldProcessedId]);

      setManualSaveSuccess(false);
      setDownloadSuccess(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'An unknown error occurred during conversion.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    originalImageSrc,
    originalFileInfo,
    toolState,
    addFile,
    setState,
    cleanupOrphanedTemporaryFiles,
  ]);

  const handleClear = useCallback(async () => {
    const oldSelectedId = toolState.selectedFileId;
    const oldProcessedId = toolState.processedFileId;
    await clearStateAndPersist();
    setError(null);
    setManualSaveSuccess(false);
    setDownloadSuccess(false);
    if (oldSelectedId) cleanupOrphanedTemporaryFiles([oldSelectedId]);
    if (oldProcessedId) cleanupOrphanedTemporaryFiles([oldProcessedId]);
  }, [
    clearStateAndPersist,
    toolState.selectedFileId,
    toolState.processedFileId,
    cleanupOrphanedTemporaryFiles,
  ]);

  const generateDefaultOutputFilename = useCallback(() => {
    if (!processedStoredFileForItde) {
      const baseName =
        originalFileInfo?.name.substring(
          0,
          originalFileInfo.name.lastIndexOf('.')
        ) || 'converted';
      return `${baseName}.${toolState.targetFormat}`;
    }
    return processedStoredFileForItde.filename;
  }, [processedStoredFileForItde, originalFileInfo, toolState.targetFormat]);

  const initiateSave = () => {
    if (!toolState.processedFileId) return;
    const filenameToUse =
      toolState.lastUserGivenFilename || generateDefaultOutputFilename();
    setFilenamePromptInitialValue(filenameToUse);
    setFilenamePromptAction('save');
    setIsFilenamePromptOpen(true);
  };

  const initiateDownload = () => {
    if (!processedImageSrc) return;
    const filenameToUse =
      toolState.lastUserGivenFilename || generateDefaultOutputFilename();
    setFilenamePromptInitialValue(filenameToUse);
    setFilenamePromptAction('download');
    setIsFilenamePromptOpen(true);
  };

  const handleConfirmFilename = async (filename: string) => {
    setIsFilenamePromptOpen(false);
    if (filenamePromptAction === 'save') {
      if (!toolState.processedFileId) return;
      const success = await makeFilePermanentAndUpdate(
        toolState.processedFileId,
        filename
      );
      if (success) {
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

  const formatOptions = useMemo(
    () => [
      { value: 'png' as TargetFormat, label: 'PNG' },
      { value: 'jpeg' as TargetFormat, label: 'JPEG' },
      { value: 'webp' as TargetFormat, label: 'WebP' },
    ],
    []
  );

  const imageFilter = useMemo(() => ({ category: 'image' as const }), []);
  const canPerformActions = !!toolState.processedFileId && !isLoading;
  const isQualityApplicable =
    toolState.targetFormat === 'jpeg' || toolState.targetFormat === 'webp';
  const processedFileIsPermanent =
    processedStoredFileForItde?.isTemporary === false;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 p-4 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="flex flex-wrap gap-4 items-center">
          <Button
            variant="accent2"
            iconLeft={<PhotoIcon className="h-5 w-5" />}
            onClick={() => setIsLibraryModalOpen(true)}
            disabled={isLoading}
          >
            {toolState.selectedFileId ? 'Change Image' : 'Select Image'}
          </Button>
          <RadioGroup
            name="targetFormat"
            legend="Target Format:"
            options={formatOptions}
            selectedValue={toolState.targetFormat}
            onChange={(value) =>
              setState({ targetFormat: value as TargetFormat })
            }
            disabled={!toolState.selectedFileId || isLoading}
          />
          {isQualityApplicable && (
            <div className="w-full sm:w-48">
              <Range
                label="Quality"
                id="quality"
                min={0}
                max={100}
                step={1}
                value={toolState.quality}
                onChange={(e) =>
                  setState({ quality: parseInt(e.target.value, 10) })
                }
                disabled={!toolState.selectedFileId || isLoading}
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-center pt-3 border-t border-[rgb(var(--color-border-base))] mt-2">
          <Button
            variant="primary"
            onClick={handleConvert}
            disabled={!toolState.selectedFileId || isLoading}
            isLoading={isLoading}
            iconLeft={<ArrowPathIcon className="h-5 w-5" />}
          >
            Convert Image
          </Button>
          <div className="flex gap-2 ml-auto items-center">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={
                itdeTarget.pendingSignals.length > 0 &&
                userDeferredAutoPopup &&
                !itdeTarget.isModalOpen
              }
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
            <OutputActionButtons
              canPerform={canPerformActions}
              isSaveSuccess={manualSaveSuccess}
              isDownloadSuccess={downloadSuccess}
              canInitiateSave={canPerformActions && !processedFileIsPermanent}
              onInitiateSave={initiateSave}
              onInitiateDownload={initiateDownload}
              onClear={handleClear}
              directiveName={directiveName}
              outputConfig={metadata.outputConfig}
              selectedOutputItems={
                processedStoredFileForItde ? [processedStoredFileForItde] : []
              }
            />
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm"
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Original Image
          </h3>
          <div className="w-full aspect-video border rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden p-2">
            {originalImageSrc ? (
              <Image
                src={originalImageSrc}
                alt="Original"
                width={originalFileInfo?.dimensions.width || 300}
                height={originalFileInfo?.dimensions.height || 200}
                className="max-w-full max-h-full object-contain"
                unoptimized
              />
            ) : (
              <span className="text-sm italic text-[rgb(var(--color-text-muted))]">
                Select an image
              </span>
            )}
          </div>
          {originalFileInfo && (
            <div className="text-xs text-[rgb(var(--color-text-muted))] flex justify-between">
              <span>{originalFileInfo.name}</span>
              <span>
                {originalFileInfo.dimensions.width}x
                {originalFileInfo.dimensions.height} (
                {formatBytes(originalFileInfo.size)})
              </span>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Converted Image
          </h3>
          <div className="w-full aspect-video border rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden p-2">
            {isLoading && !processedImageSrc ? (
              <div className="flex flex-col items-center text-sm italic text-[rgb(var(--color-text-muted))]">
                <ArrowPathIcon className="animate-spin h-8 w-8 mb-2" />
                Processing...
              </div>
            ) : processedImageSrc ? (
              <Image
                src={processedImageSrc}
                alt="Converted"
                width={originalFileInfo?.dimensions.width || 300}
                height={originalFileInfo?.dimensions.height || 200}
                className="max-w-full max-h-full object-contain"
                unoptimized
              />
            ) : (
              <span className="text-sm italic text-[rgb(var(--color-text-muted))]">
                Output appears here
              </span>
            )}
          </div>
          {processedFileInfo && (
            <div className="text-xs text-[rgb(var(--color-text-muted))] flex justify-between">
              <span>{processedFileInfo.type}</span>
              <span>{formatBytes(processedFileInfo.size)}</span>
            </div>
          )}
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
        title={
          filenamePromptAction === 'save'
            ? 'Save Converted Image'
            : 'Download Converted Image'
        }
        confirmButtonText={
          filenamePromptAction === 'save' ? 'Save to Library' : 'Download'
        }
        filenameAction={filenamePromptAction || undefined}
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
