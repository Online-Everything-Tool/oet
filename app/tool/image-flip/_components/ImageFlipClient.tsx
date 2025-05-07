// FILE: app/tool/image-flip/_components/ImageFlipClient.tsx
'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import Image from 'next/image';
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import { useHistory } from '../../../context/HistoryContext';
import type { StoredFile } from '@/src/types/storage';
import FileSelectionModal from '@/app/tool/_components/FileSelectionModal';
import useImageProcessing from '@/app/tool/_hooks/useImageProcessing';
import Button from '@/app/tool/_components/form/Button';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import {
  PhotoIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  XCircleIcon,
  CheckIcon,
  ArrowPathIcon,
  ArchiveBoxArrowDownIcon,
  CheckBadgeIcon, // For indicating permanence
} from '@heroicons/react/20/solid';

interface ImageFlipClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function ImageFlipClient({
  toolTitle,
  toolRoute,
}: ImageFlipClientProps) {
  const [flipType, setFlipType] = useState<'horizontal' | 'vertical'>(
    'horizontal'
  );
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<StoredFile | null>(null);

  const [isCopied, setIsCopied] = useState<boolean>(false);
  // --- Renamed State ---
  const [processedFileId, setProcessedFileId] = useState<string | null>(null);
  // --- End Renamed State ---
  const [isProcessedFilePermanent, setIsProcessedFilePermanent] =
    useState<boolean>(false); // Track permanence status
  const [autoSaveProcessed, setAutoSaveProcessed] = useState<boolean>(true); // Default based on common expectation?
  const [isManuallySaving, setIsManuallySaving] = useState<boolean>(false);

  const [uiError, setUiError] = useState<string | null>(null);

  const { addHistoryEntry } = useHistory();
  // --- Get makeImagePermanent ---
  const { getImage, makeImagePermanent } = useImageLibrary();
  // --- End Get ---

  const {
    originalImageSrc,
    processedImageSrc,
    processedImageBlob,
    // Use processedFileId from hook now
    processedFileId: hookProcessedFileId,
    fileName,
    isLoading: isProcessingImage,
    error: processingErrorHook,
    setOriginalImageSrc,
    processImage,
    clearProcessingOutput,
  } = useImageProcessing({ toolTitle, toolRoute });

  // Sync local processedFileId state with the one from the hook
  useEffect(() => {
    setProcessedFileId(hookProcessedFileId);
    // Check if the newly processed file is permanent (only relevant if autoSave is on)
    if (hookProcessedFileId && autoSaveProcessed) {
      setIsProcessedFilePermanent(true);
    } else if (!hookProcessedFileId) {
      // Clear permanence state if hook clears its ID
      setIsProcessedFilePermanent(false);
    }
    // We don't necessarily know the permanence if auto-save was off when it was processed
  }, [hookProcessedFileId, autoSaveProcessed]);

  const flipDrawFunction = useCallback(
    (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
      const { naturalWidth: w, naturalHeight: h } = img;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      if (flipType === 'horizontal') {
        ctx.scale(-1, 1);
        ctx.translate(-w, 0);
      } else {
        ctx.scale(1, -1);
        ctx.translate(0, -h);
      }
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    },
    [flipType]
  );

  useEffect(() => {
    let objectUrl: string | null = null;
    if (selectedFile?.blob && selectedFile.type?.startsWith('image/')) {
      try {
        clearProcessingOutput(); // Clears processedFileId via hook state
        setIsProcessedFilePermanent(false); // Reset permanence indicator
        setIsCopied(false);
        setUiError(null);

        objectUrl = URL.createObjectURL(selectedFile.blob);
        setOriginalImageSrc(objectUrl);
      } catch (e) {
        console.error('Error creating object URL for original image:', e);
        setUiError('Could not create preview for selected image.');
        setOriginalImageSrc(null);
      }
    } else {
      setOriginalImageSrc(null);
      clearProcessingOutput(); // Clears processedFileId via hook state
      setIsProcessedFilePermanent(false); // Reset permanence indicator
      if (selectedFile) {
        setUiError('Invalid file type. Please select an image.');
      }
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // Ensure clearProcessingOutput is stable if included
  }, [selectedFile, setOriginalImageSrc, clearProcessingOutput, setUiError]);

  const processingEffectRunCount = useRef(0);
  const processingKey = useMemo(() => {
    if (!selectedFile?.id) return null;
    return `${selectedFile.id}-${flipType}`;
  }, [selectedFile, flipType]);
  const prevProcessingKey = useRef<string | null>(null);

  useEffect(() => {
    processingEffectRunCount.current += 1;
    const runId = processingEffectRunCount.current;

    // console.log(
    //   `[ImageFlipClient] PROC_EFFECT (#${runId}) Eval. Key: ${processingKey}, PrevKey: ${prevProcessingKey.current}, isProcessing: ${isProcessingImage}, AutoSave: ${autoSaveProcessed}`
    // );

    if (!selectedFile?.blob || !selectedFile.type?.startsWith('image/')) {
      // console.log(`  (#${runId}) No valid selectedFile for processing. Current ID: ${selectedFile?.id}`);
      prevProcessingKey.current = processingKey;
      return;
    }

    // Skip if same input/options and not currently processing (avoids loop)
    if (processingKey === prevProcessingKey.current && !isProcessingImage) {
      // console.log(`  (#${runId}) Key ${processingKey} is same as previous and not processing. Skipping re-processing.`);
      return;
    }

    // Skip if already processing this exact task
    if (isProcessingImage && processingKey === prevProcessingKey.current) {
      // console.log(`  (#${runId}) isProcessingImage is TRUE for current key. Skipping duplicate process call for key ${processingKey}.`);
      return;
    }

    // console.log(`  (#${runId}) New processing task or re-processing. Key: ${processingKey}, Prev: ${prevProcessingKey.current}, AutoSave: ${autoSaveProcessed}`);
    prevProcessingKey.current = processingKey; // Update *before* async call

    const currentInputFileForAsync = selectedFile; // Capture current file for async op

    const triggerProcessing = async () => {
      const baseName =
        currentInputFileForAsync.name.substring(
          0,
          currentInputFileForAsync.name.lastIndexOf('.')
        ) || currentInputFileForAsync.name;
      const mimeTypeParts = currentInputFileForAsync.type?.split('/');
      const extension =
        mimeTypeParts && mimeTypeParts.length > 1 ? mimeTypeParts[1] : 'png';
      const outputFileName = `flipped-${flipType}-${baseName}.${extension}`;

      // console.log(`    (#${runId}) Calling processImage for ${outputFileName} (CreatePerm: ${autoSaveProcessed}) (Input ID: ${currentInputFileForAsync.id})`);

      console.log(
        'process image:',
        currentInputFileForAsync,
        flipDrawFunction,
        'auto',
        outputFileName,
        { flipType },
        autoSaveProcessed
      );
      // Pass autoSaveProcessed as createPermanentEntry flag
      await processImage(
        currentInputFileForAsync,
        flipDrawFunction,
        'auto',
        outputFileName,
        { flipType },
        autoSaveProcessed // Pass the state value here
      );
      // console.log(`    (#${runId}) processImage returned. Result ID: ${result.id}, Input ID: ${currentInputFileForAsync.id}, Perm: ${autoSaveProcessed}`);

      // Check if selected file hasn't changed during async processing
      if (selectedFile && selectedFile.id === currentInputFileForAsync.id) {
        // hook already sets processedFileId state via useEffect dependency
        // setProcessedFileId(result.id);
        // Update permanence based on what was actually done
        setIsProcessedFilePermanent(autoSaveProcessed);
        // console.log(`    (#${runId}) Set processedFileId to: ${result.id}, Permanence: ${autoSaveProcessed}`);
      } else {
        console.warn(
          `    (#${runId}) Race condition: selectedFile changed while processing ${currentInputFileForAsync.id}. Current selectedFile is ${selectedFile?.id}. Not updating processedFileId/permanence for old run.`
        );
      }
    };
    triggerProcessing();
    // Dependencies for the processing trigger
  }, [
    processingKey, // Derived from selectedFile and flipType
    isProcessingImage,
    selectedFile, // Direct dependency
    processImage, // From the hook
    flipDrawFunction, // Callback dep
    autoSaveProcessed, // State dep
  ]);

  const handleFilesSelectedFromModal = useCallback(
    (files: StoredFile[]) => {
      setIsLibraryModalOpen(false);
      setUiError(null);
      prevProcessingKey.current = null; // Reset processing key on new file
      if (files && files.length > 0) {
        const firstFile = files[0];
        if (firstFile.type?.startsWith('image/') && firstFile.blob) {
          setSelectedFile(firstFile);
          clearProcessingOutput(); // Clear previous output
          setIsProcessedFilePermanent(false); // Reset permanence
        } else {
          setUiError('Invalid file selected. Please select an image.');
          setSelectedFile(null);
          clearProcessingOutput();
          setIsProcessedFilePermanent(false);
        }
      } else {
        setSelectedFile(null);
        clearProcessingOutput();
        setIsProcessedFilePermanent(false);
      }
    },
    [setUiError, clearProcessingOutput] // Include clearProcessingOutput
  );

  const handleFlipTypeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      prevProcessingKey.current = null; // Reset processing key on option change
      setFlipType(event.target.value as 'horizontal' | 'vertical');
      setIsCopied(false);
      clearProcessingOutput(); // Clear output when options change
      setIsProcessedFilePermanent(false);
    },
    [clearProcessingOutput] // Include clearProcessingOutput
  );

  // --- UPDATED: handleAutoSaveChange ---
  const handleAutoSaveChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newAutoSaveState = e.target.checked;
      setAutoSaveProcessed(newAutoSaveState); // Update state first
      setUiError(null);

      // If toggled ON and there is a processed file that ISN'T permanent yet
      if (
        newAutoSaveState === true &&
        processedFileId &&
        !isProcessedFilePermanent &&
        !isProcessingImage &&
        !isManuallySaving
      ) {
        console.log(
          '[ImageFlipClient] Auto-save toggled ON. Attempting to make current processed image permanent.'
        );
        setIsManuallySaving(true); // Use manual saving flag to prevent race conditions
        try {
          await makeImagePermanent(processedFileId);
          setIsProcessedFilePermanent(true); // Update permanence indicator
          addHistoryEntry({
            toolName: toolTitle,
            toolRoute,
            trigger: 'auto', // Or 'click' if we consider the toggle a click? 'auto' seems ok
            input: {
              originalFile: selectedFile?.name,
              processedFileId: processedFileId,
              operation: 'auto-save toggled on, making file permanent',
            },
            output: { message: `File ${processedFileId} made permanent.` },
            outputFileIds: [processedFileId], // Link history to the now permanent file
            status: 'success',
            eventTimestamp: Date.now(),
          });
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Failed to make image permanent.';
          setUiError(`Auto-save failed: ${message}`);
          // Should we toggle autoSaveProcessed back? Maybe not, let the user retry?
        } finally {
          setIsManuallySaving(false);
        }
      }
    },
    [
      processedFileId, // Use current processed ID
      isProcessedFilePermanent, // Check if already permanent
      makeImagePermanent, // Use the new function
      addHistoryEntry,
      toolTitle,
      toolRoute,
      selectedFile?.name,
      isProcessingImage,
      isManuallySaving,
      setUiError,
    ]
  );
  // --- END UPDATE ---

  const handleClear = useCallback(() => {
    setOriginalImageSrc(null);
    clearProcessingOutput(); // Clears processed ID and blob/src
    setFlipType('horizontal');
    setUiError(null);
    setSelectedFile(null);
    prevProcessingKey.current = null;
    // setProcessedFileId(null); // Handled by clearProcessingOutput
    setIsCopied(false);
    setAutoSaveProcessed(true); // Reset to default?
    setIsProcessedFilePermanent(false); // Reset permanence
  }, [setOriginalImageSrc, clearProcessingOutput, setUiError]);

  const handleDownload = useCallback(() => {
    // This remains largely the same, using processedImageSrc
    if (!processedImageSrc || !fileName) {
      setUiError('No image to download.');
      return;
    }
    setUiError(null);
    const link = document.createElement('a');
    const baseName =
      fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    const mimeType =
      processedImageSrc.match(/data:(image\/\w+);base64,/)?.[1] || 'image/png';
    const extension = mimeType.split('/')[1] || 'png';
    link.download = `flipped-${flipType}-${baseName}.${extension}`;
    link.href = processedImageSrc;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [processedImageSrc, fileName, flipType, setUiError]);

  const handleCopyToClipboard = useCallback(async () => {
    // Now prefers using the ID to get the definitive blob
    setIsCopied(false);
    setUiError(null);
    let blobToCopy: Blob | null = null;

    if (processedFileId) {
      // Use the ID from state
      const fileData = await getImage(processedFileId);
      if (fileData?.blob && fileData.type?.startsWith('image/')) {
        blobToCopy = fileData.blob;
      } else {
        // Fallback to state blob if fetch fails but we have it? Or just error?
        if (processedImageBlob) {
          console.warn(
            'Could not fetch file by ID for copy, falling back to state blob.'
          );
          blobToCopy = processedImageBlob;
        } else {
          setUiError('Processed image data not found for copy.');
          return;
        }
      }
    } else if (processedImageBlob) {
      // Fallback if ID somehow isn't set but blob is
      console.warn('No processedFileId set, attempting copy using state blob.');
      blobToCopy = processedImageBlob;
    } else {
      setUiError('No image data available to copy.');
      return;
    }

    if (!blobToCopy) {
      setUiError('Blob data missing for copy.');
      return;
    }

    try {
      if (!navigator.clipboard?.write)
        throw new Error('Clipboard API not available.');
      await navigator.clipboard.write([
        new ClipboardItem({ [blobToCopy.type || 'image/png']: blobToCopy }),
      ]);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      setUiError(
        `Copy failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }, [processedFileId, processedImageBlob, getImage, setUiError]); // Depend on ID and blob state

  // --- UPDATED: handleSaveProcessedToLibrary ---
  const handleSaveProcessedToLibrary = useCallback(async () => {
    // Check if there is a processed file ID and if it's NOT already permanent
    if (!processedFileId || isProcessedFilePermanent) {
      if (!processedFileId) setUiError('No processed image available to save.');
      if (isProcessedFilePermanent) console.log('Image already permanent.'); // Or subtle feedback
      return;
    }

    setIsManuallySaving(true);
    setUiError(null);
    try {
      await makeImagePermanent(processedFileId);
      setIsProcessedFilePermanent(true); // Update UI indicator

      // Add history entry for the manual "make permanent" action
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute,
        trigger: 'click', // Manual click trigger
        input: {
          originalFile: selectedFile?.name,
          processedFileId: processedFileId,
          operation: 'manual save (make permanent)',
        },
        output: {
          message: `Made processed image ${processedFileId} permanent.`,
        },
        outputFileIds: [processedFileId], // Link to the file
        status: 'success',
        eventTimestamp: Date.now(),
      });
    } catch (err) {
      setUiError(
        `Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      // Optionally reset isProcessedFilePermanent if save fails? Depends on desired UX.
    } finally {
      setIsManuallySaving(false);
    }
  }, [
    processedFileId, // Use the current processed ID
    isProcessedFilePermanent, // Check permanence state
    makeImagePermanent, // Use the new function
    addHistoryEntry,
    toolTitle,
    toolRoute,
    selectedFile?.name,
    setUiError,
  ]);
  // --- END UPDATE ---

  const imageFilter = useMemo(() => ({ category: 'image' }), []);
  const displayError = processingErrorHook || uiError;
  const canPerformActions =
    !!processedImageSrc && !isProcessingImage && !isManuallySaving;
  // Show save button only if processed, not auto-saved, not already permanent, and not currently saving/processing
  const showSaveButton =
    processedImageBlob &&
    !autoSaveProcessed &&
    !isProcessedFilePermanent &&
    !isProcessingImage &&
    !isManuallySaving;

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        {/* Row 1: Select Image & Flip Type */}
        <div className="flex flex-wrap gap-4 items-center">
          <Button
            variant="accent2"
            iconLeft={<PhotoIcon className="h-5 w-5" />}
            onClick={() => setIsLibraryModalOpen(true)}
            disabled={isProcessingImage || isManuallySaving}
          >
            {originalImageSrc ? 'Change Image' : 'Select Image'}
          </Button>
          <fieldset
            className="flex gap-x-4 gap-y-2 items-center"
            disabled={
              isProcessingImage || isManuallySaving || !originalImageSrc
            } // Disable if no image selected
          >
            <legend className="sr-only">Flip Direction</legend>
            <div className="flex items-center">
              <input
                type="radio"
                id="flip-h"
                name="flipType"
                value="horizontal"
                checked={flipType === 'horizontal'}
                onChange={handleFlipTypeChange}
                disabled={
                  isProcessingImage || isManuallySaving || !originalImageSrc
                }
                className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] accent-[rgb(var(--color-checkbox-accent))] focus:ring-offset-0 focus:ring-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label
                htmlFor="flip-h"
                className={`ml-2 block text-sm ${isProcessingImage || isManuallySaving || !originalImageSrc ? 'text-gray-400 cursor-not-allowed' : 'text-[rgb(var(--color-text-base))] cursor-pointer'}`}
              >
                Horizontal
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="radio"
                id="flip-v"
                name="flipType"
                value="vertical"
                checked={flipType === 'vertical'}
                onChange={handleFlipTypeChange}
                disabled={
                  isProcessingImage || isManuallySaving || !originalImageSrc
                }
                className="h-4 w-4 border-[rgb(var(--color-input-border))] text-[rgb(var(--color-checkbox-accent))] accent-[rgb(var(--color-checkbox-accent))] focus:ring-offset-0 focus:ring-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label
                htmlFor="flip-v"
                className={`ml-2 block text-sm ${isProcessingImage || isManuallySaving || !originalImageSrc ? 'text-gray-400 cursor-not-allowed' : 'text-[rgb(var(--color-text-base))] cursor-pointer'}`}
              >
                Vertical
              </label>
            </div>
          </fieldset>
        </div>
        {/* Row 2: Auto-Save & Actions */}
        <div className="flex flex-wrap gap-4 items-center pt-3 border-t border-gray-200 mt-2">
          <Checkbox
            label="Auto-save flipped image to Library"
            checked={autoSaveProcessed}
            onChange={handleAutoSaveChange}
            disabled={isProcessingImage || isManuallySaving}
            id="autoSaveFlippedImage"
          />
          <div className="flex gap-3 ml-auto">
            {showSaveButton && (
              <Button
                variant="secondary"
                iconLeft={<ArchiveBoxArrowDownIcon className="h-5 w-5" />}
                onClick={handleSaveProcessedToLibrary}
                disabled={isManuallySaving || isProcessingImage} // Redundant check, already in showSaveButton
                isLoading={isManuallySaving}
                loadingText="Saving..."
              >
                Save to Library
              </Button>
            )}
            <Button
              variant="primary"
              iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}
              onClick={handleDownload}
              disabled={!canPerformActions}
            >
              Download
            </Button>
            <Button
              variant={isCopied ? 'secondary' : 'accent'}
              iconLeft={
                isCopied ? (
                  <CheckIcon className="h-5 w-5" />
                ) : (
                  <ClipboardDocumentIcon className="h-5 w-5" />
                )
              }
              onClick={handleCopyToClipboard}
              disabled={!canPerformActions}
            >
              {isCopied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              variant="neutral"
              iconLeft={<XCircleIcon className="h-5 w-5" />}
              onClick={handleClear}
              disabled={
                !originalImageSrc &&
                !processedImageSrc &&
                !processingErrorHook &&
                !uiError &&
                !isProcessingImage &&
                !isManuallySaving
              }
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      {displayError && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          <XCircleIcon
            className="h-5 w-5 text-[rgb(var(--color-text-error))] "
            aria-hidden="true"
          />
          <div>
            {' '}
            <strong className="font-semibold">Error:</strong>{' '}
            {displayError}{' '}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Original Image Preview */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            {' '}
            Original Image{' '}
            {fileName && (
              <span className="font-normal text-xs text-[rgb(var(--color-text-muted))]">
                ({fileName})
              </span>
            )}{' '}
          </label>
          <div className="w-full aspect-square border border-[rgb(var(--color-input-border))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {originalImageSrc ? (
              <Image
                src={originalImageSrc}
                alt={fileName || 'Original'}
                width={500}
                height={500}
                className="max-w-full max-h-full object-contain"
                unoptimized={true}
              />
            ) : (
              <span className="text-sm text-[rgb(var(--color-input-placeholder))] italic">
                Select an image
              </span>
            )}
          </div>
        </div>
        {/* Flipped Image Preview */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Flipped Image
            {/* Updated Status Indicator */}
            {processedFileId && isProcessedFilePermanent && (
              <span className="text-xs text-green-600 ml-1 inline-flex items-center gap-1">
                <CheckBadgeIcon className="h-4 w-4" aria-hidden="true" /> (Saved
                to Library)
              </span>
            )}
            {processedFileId &&
              !isProcessedFilePermanent &&
              !autoSaveProcessed && (
                <span className="text-xs text-orange-600 ml-1">
                  (Not Saved)
                </span>
              )}
            {processedFileId &&
              !isProcessedFilePermanent &&
              autoSaveProcessed && (
                <span className="text-xs text-blue-600 ml-1">(Temporary)</span> // Should ideally become permanent quickly
              )}
          </label>
          <div className="w-full aspect-square border border-[rgb(var(--color-input-border))] rounded-md bg-[rgb(var(--color-bg-subtle))] flex items-center justify-center overflow-hidden">
            {isProcessingImage && !processedImageSrc && (
              <div className="flex flex-col items-center text-sm text-[rgb(var(--color-text-link))] italic">
                <ArrowPathIcon className="animate-spin h-8 w-8 mb-2 text-[rgb(var(--color-text-link))]" />{' '}
                Flipping...
              </div>
            )}
            {!isProcessingImage && processedImageSrc ? (
              <Image
                src={processedImageSrc}
                alt={fileName ? `Flipped ${fileName}` : 'Flipped Image'}
                width={500}
                height={500}
                className="max-w-full max-h-full object-contain"
                unoptimized={true}
              />
            ) : (
              !isProcessingImage && (
                <span className="text-sm text-[rgb(var(--color-input-placeholder))] italic">
                  Output appears here
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* Modal remains the same */}
      <FileSelectionModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        onFilesSelected={handleFilesSelectedFromModal}
        mode="selectExistingOrUploadNew"
        initialTab="library"
        showFilterAfterUploadCheckbox={false}
        accept="image/*"
        selectionMode="single"
        libraryFilter={imageFilter}
        className="max-w-4xl"
      />
    </div>
  );
}
