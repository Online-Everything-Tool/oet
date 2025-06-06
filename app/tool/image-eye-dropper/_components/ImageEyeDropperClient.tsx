'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import useToolState from '@/app/tool/_hooks/useToolState';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata } from '@/src/types/tools';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import Button from '@/app/tool/_components/form/Button';
import {
  PhotoIcon,
  XCircleIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import SendToToolButton from '@/app/tool/_components/shared/SendToToolButton';
import useItdeTargetHandler, {
  IncomingSignal,
} from '@/app/tool/_hooks/useItdeTargetHandler';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '@/app/tool/_components/shared/ReceiveItdeDataTrigger';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import importedMetadata from '../metadata.json';

const metadata = importedMetadata as ToolMetadata;

interface ColorDetails {
  hex: string;
  rgba: { r: number; g: number; b: number; a: number };
}

interface ImageEyeDropperToolState {
  selectedFileId: string | null;
  pickedColorHex: string | null;
  pickedColorFullDetails: ColorDetails | null;
}

const DEFAULT_TOOL_STATE: ImageEyeDropperToolState = {
  selectedFileId: null,
  pickedColorHex: null,
  pickedColorFullDetails: null,
};

const componentToHex = (c: number): string => {
  const hex = c.toString(16);
  return hex.length === 1 ? '0' + hex : hex;
};

const simpleRgbToHex = (r: number, g: number, b: number): string => {
  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

interface ImageEyeDropperClientProps {
  toolRoute: string;
}

export default function ImageEyeDropperClient({
  toolRoute,
}: ImageEyeDropperClientProps) {
  const {
    state: toolState,
    setState,
    isLoadingState,
    clearStateAndPersist,
    saveStateNow,
  } = useToolState<ImageEyeDropperToolState>(toolRoute, DEFAULT_TOOL_STATE);

  const { getFile, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedHex, setCopiedHex] = useState(false);
  const [copiedRgb, setCopiedRgb] = useState(false);
  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const visibleCanvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

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
        const newState: Partial<ImageEyeDropperToolState> = {
          selectedFileId: firstImageItem.id,
          pickedColorHex: null,
          pickedColorFullDetails: null,
        };
        setState(newState);
        await saveStateNow({ ...toolState, ...newState });
        if (oldSelectedId && oldSelectedId !== firstImageItem.id) {
          cleanupOrphanedTemporaryFiles([oldSelectedId]).catch((e) =>
            console.error('[EyeDropper ITDE Accept] Cleanup failed:', e)
          );
        }
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
      if (imageObjectUrl) {
        URL.revokeObjectURL(imageObjectUrl);
        setImageObjectUrl(null);
      }
      imageElementRef.current = null;
      if (visibleCanvasRef.current) {
        const ctx = visibleCanvasRef.current.getContext('2d');
        ctx?.clearRect(
          0,
          0,
          visibleCanvasRef.current.width,
          visibleCanvasRef.current.height
        );
      }
      return;
    }

    setIsImageLoading(true);
    setError(null);
    let newObjectUrl: string | null = null;

    getFile(toolState.selectedFileId)
      .then((file) => {
        if (!file?.blob) {
          throw new Error('Selected file or its blob not found.');
        }
        newObjectUrl = URL.createObjectURL(file.blob);
        setImageObjectUrl(newObjectUrl);

        const img = new Image();
        img.onload = () => {
          imageElementRef.current = img;
          if (!offscreenCanvasRef.current) {
            offscreenCanvasRef.current = document.createElement('canvas');
          }
          offscreenCanvasRef.current.width = img.naturalWidth;
          offscreenCanvasRef.current.height = img.naturalHeight;
          const offscreenCtx = offscreenCanvasRef.current.getContext('2d');
          offscreenCtx?.drawImage(img, 0, 0);

          const drawVisibleCanvas = () => {
            if (visibleCanvasRef.current && imageElementRef.current) {
              const canvas = visibleCanvasRef.current;
              const parent = canvas.parentElement;
              const imgElement = imageElementRef.current;

              if (!parent) {
                console.warn('Canvas parent element not found for sizing.');
                setIsImageLoading(false);
                return;
              }

              const availableWidth = parent.clientWidth;
              const availableHeight = (availableWidth * 3) / 4;
              if (availableWidth === 0) {
                console.warn('Parent width is 0, cannot size canvas yet.');
                setIsImageLoading(false);
                return;
              }

              const imageAspectRatio =
                imgElement.naturalWidth / imgElement.naturalHeight;

              let canvasWidth = availableWidth;
              let canvasHeight = canvasWidth / imageAspectRatio;

              if (canvasHeight > availableHeight) {
                canvasHeight = availableHeight;
                canvasWidth = canvasHeight * imageAspectRatio;
              }

              if (canvasWidth > availableWidth) {
                canvasWidth = availableWidth;
                canvasHeight = canvasWidth / imageAspectRatio;
              }

              canvas.width = Math.max(1, Math.floor(canvasWidth));
              canvas.height = Math.max(1, Math.floor(canvasHeight));

              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
                console.log(
                  `Canvas drawn: ${canvas.width}x${canvas.height}. Image: ${imgElement.naturalWidth}x${imgElement.naturalHeight}. Parent: ${parent.clientWidth}x${parent.clientHeight}`
                );
              } else {
                console.error(
                  'Failed to get visible canvas context after sizing.'
                );
              }
            }
            setIsImageLoading(false);
          };

          drawVisibleCanvas();
        };
        img.onerror = () => {
          throw new Error('Failed to load image.');
        };
        img.src = newObjectUrl;
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : 'Error loading image file.'
        );
        setIsImageLoading(false);
        if (newObjectUrl) URL.revokeObjectURL(newObjectUrl);
        setImageObjectUrl(null);
        imageElementRef.current = null;
      });

    return () => {
      if (newObjectUrl) {
        URL.revokeObjectURL(newObjectUrl);
      }

      if (imageObjectUrl && imageObjectUrl !== newObjectUrl) {
        URL.revokeObjectURL(imageObjectUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolState.selectedFileId, getFile]);

  const handleFilesSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLibraryModalOpen(false);
      setError(null);
      if (files?.[0]?.type?.startsWith('image/') && files[0].id) {
        const oldSelectedId = toolState.selectedFileId;
        const newState: Partial<ImageEyeDropperToolState> = {
          selectedFileId: files[0].id,
          pickedColorHex: null,
          pickedColorFullDetails: null,
        };
        setState(newState);
        await saveStateNow({ ...toolState, ...newState });
        if (oldSelectedId && oldSelectedId !== files[0].id) {
          cleanupOrphanedTemporaryFiles([oldSelectedId]).catch((e) =>
            console.error('[EyeDropper Select] Cleanup failed:', e)
          );
        }
      } else if (files?.length) {
        setError(
          `Selected file "${files[0].filename}" is not a recognized image type or has no ID.`
        );
      }
    },
    [toolState, setState, saveStateNow, cleanupOrphanedTemporaryFiles]
  );

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (
        !visibleCanvasRef.current ||
        !offscreenCanvasRef.current ||
        !imageElementRef.current
      )
        return;

      const canvas = visibleCanvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const imgCoordX = Math.floor(
        (x / canvas.clientWidth) * imageElementRef.current.naturalWidth
      );
      const imgCoordY = Math.floor(
        (y / canvas.clientHeight) * imageElementRef.current.naturalHeight
      );

      const offscreenCtx = offscreenCanvasRef.current.getContext('2d');
      if (!offscreenCtx) return;

      const pixelData = offscreenCtx.getImageData(
        imgCoordX,
        imgCoordY,
        1,
        1
      ).data;
      const r = pixelData[0];
      const g = pixelData[1];
      const b = pixelData[2];
      const a = pixelData[3];

      const hex = simpleRgbToHex(r, g, b);
      const newColorDetails: ColorDetails = { hex, rgba: { r, g, b, a } };

      setState({
        pickedColorHex: hex,
        pickedColorFullDetails: newColorDetails,
      });
      setCopiedHex(false);
      setCopiedRgb(false);
    },
    [setState]
  );

  const handleCopy = useCallback(
    async (type: 'hex' | 'rgb') => {
      if (!toolState.pickedColorFullDetails) return;
      let textToCopy = '';
      if (type === 'hex') {
        textToCopy = toolState.pickedColorFullDetails.hex;
      } else {
        const { r, g, b } = toolState.pickedColorFullDetails.rgba;
        textToCopy = `rgb(${r}, ${g}, ${b})`;
      }

      try {
        await navigator.clipboard.writeText(textToCopy);
        if (type === 'hex') setCopiedHex(true);
        else setCopiedRgb(true);
        setTimeout(() => {
          if (type === 'hex') setCopiedHex(false);
          else setCopiedRgb(false);
        }, 2000);
      } catch (_err) {
        setError('Failed to copy color to clipboard.');
      }
    },
    [toolState.pickedColorFullDetails]
  );

  const handleClear = useCallback(async () => {
    const oldSelectedId = toolState.selectedFileId;
    await clearStateAndPersist();
    setError(null);
    setCopiedHex(false);
    setCopiedRgb(false);
    if (visibleCanvasRef.current) {
      const ctx = visibleCanvasRef.current.getContext('2d');
      ctx?.clearRect(
        0,
        0,
        visibleCanvasRef.current.width,
        visibleCanvasRef.current.height
      );
    }
    if (imageObjectUrl) {
      URL.revokeObjectURL(imageObjectUrl);
      setImageObjectUrl(null);
    }
    imageElementRef.current = null;
    if (oldSelectedId) {
      cleanupOrphanedTemporaryFiles([oldSelectedId]).catch((e) =>
        console.error('[EyeDropper Clear] Cleanup failed:', e)
      );
    }
  }, [
    clearStateAndPersist,
    imageObjectUrl,
    toolState.selectedFileId,
    cleanupOrphanedTemporaryFiles,
  ]);

  const imageFilter = useMemo(() => ({ category: 'image' as const }), []);

  const itdeSendableItems = useMemo(() => {
    return [];
  }, []);

  const onBeforeSignalSend = useCallback(async () => {
    return !!toolState.pickedColorHex;
  }, [toolState.pickedColorHex]);

  const handleModalDeferAll = () => {
    setUserDeferredAutoPopup(true);
    itdeTarget.closeModal();
  };
  const handleModalIgnoreAll = () => {
    setUserDeferredAutoPopup(false);
    itdeTarget.ignoreAllSignals();
  };
  const handleModalAccept = (sourceDirective: string) => {
    itdeTarget.acceptSignal(sourceDirective);
  };
  const handleModalIgnore = (sourceDirective: string) => {
    itdeTarget.ignoreSignal(sourceDirective);
    const remaining = itdeTarget.pendingSignals.filter(
      (s) => s.sourceDirective !== sourceDirective
    );
    if (remaining.length === 0) setUserDeferredAutoPopup(false);
  };

  if (isLoadingState && !initialToolStateLoadCompleteRef.current) {
    return (
      <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">
        Loading Image Eye Dropper...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="flex flex-col gap-3 p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="flex flex-wrap gap-4 items-center">
          <Button
            variant="accent2"
            iconLeft={<PhotoIcon className="h-5 w-5" />}
            onClick={() => setIsLibraryModalOpen(true)}
            disabled={isImageLoading}
          >
            {toolState.selectedFileId ? 'Change Image' : 'Select Image'}
          </Button>
          <ReceiveItdeDataTrigger
            hasDeferredSignals={
              itdeTarget.pendingSignals.length > 0 &&
              userDeferredAutoPopup &&
              !itdeTarget.isModalOpen
            }
            pendingSignalCount={itdeTarget.pendingSignals.length}
            onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
          />
          <Button
            variant="neutral"
            onClick={handleClear}
            iconLeft={<XCircleIcon className="h-5 w-5" />}
            className="ml-auto"
          >
            Clear
          </Button>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-2">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Click on the image to pick a color
          </label>
          <div
            className="w-full aspect-[4/3] border rounded-md bg-[rgb(var(--color-bg-neutral))] flex items-center justify-center overflow-hidden relative"
            style={{
              backgroundColor: 'rgb(var(--color-bg-subtle))',
              borderColor: 'rgb(var(--color-border-base))',
            }}
          >
            {isImageLoading && (
              <p className="text-sm italic text-[rgb(var(--color-text-muted))]">
                Loading image...
              </p>
            )}
            {!toolState.selectedFileId && !isImageLoading && (
              <p className="text-sm italic text-[rgb(var(--color-text-muted))]">
                No image selected
              </p>
            )}
            <canvas
              ref={visibleCanvasRef}
              onClick={handleCanvasClick}
              className={
                toolState.selectedFileId && !isImageLoading
                  ? 'cursor-crosshair'
                  : 'cursor-default'
              }
              style={{
                display:
                  toolState.selectedFileId && !isImageLoading
                    ? 'block'
                    : 'none',
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Picked Color
          </label>
          {toolState.pickedColorFullDetails ? (
            <div className="p-4 border rounded-md bg-[rgb(var(--color-bg-component))] space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded border border-[rgb(var(--color-border-soft))]"
                  style={{
                    backgroundColor: toolState.pickedColorFullDetails.hex,
                  }}
                  title={`Preview of ${toolState.pickedColorFullDetails.hex}`}
                ></div>
                <div className="flex-grow">
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    HEX
                  </p>
                  <div className="flex items-center">
                    <p
                      className="font-mono text-sm flex-grow"
                      title={toolState.pickedColorFullDetails.hex}
                    >
                      {toolState.pickedColorFullDetails.hex}
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => handleCopy('hex')}
                      className="!p-1"
                      title={copiedHex ? 'Copied!' : 'Copy HEX'}
                      disabled={copiedHex}
                    >
                      {copiedHex ? (
                        <CheckIcon className="h-4 w-4 text-[rgb(var(--color-status-success))]" />
                      ) : (
                        <ClipboardDocumentIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">
                  RGB
                </p>
                <div className="flex items-center">
                  <p
                    className="font-mono text-sm flex-grow"
                    title={`rgb(${toolState.pickedColorFullDetails.rgba.r}, ${toolState.pickedColorFullDetails.rgba.g}, ${toolState.pickedColorFullDetails.rgba.b})`}
                  >{`rgb(${toolState.pickedColorFullDetails.rgba.r}, ${toolState.pickedColorFullDetails.rgba.g}, ${toolState.pickedColorFullDetails.rgba.b})`}</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => handleCopy('rgb')}
                    className="!p-1"
                    title={copiedRgb ? 'Copied!' : 'Copy RGB'}
                    disabled={copiedRgb}
                  >
                    {copiedRgb ? (
                      <CheckIcon className="h-4 w-4 text-[rgb(var(--color-status-success))]" />
                    ) : (
                      <ClipboardDocumentIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">
                  Alpha
                </p>
                <p className="font-mono text-sm">
                  {toolState.pickedColorFullDetails.rgba.a} (
                  {(
                    (toolState.pickedColorFullDetails.rgba.a / 255) *
                    100
                  ).toFixed(0)}
                  %)
                </p>
              </div>
              <div className="pt-2 border-t border-[rgb(var(--color-border-base))]">
                <SendToToolButton
                  currentToolDirective={directiveName}
                  currentToolOutputConfig={metadata.outputConfig}
                  selectedOutputItems={itdeSendableItems}
                  onBeforeSignal={onBeforeSignalSend}
                  buttonText="Send Color"
                  className="w-full"
                />
              </div>
            </div>
          ) : (
            <div className="p-4 border rounded-md bg-[rgb(var(--color-bg-component))] text-center text-sm text-[rgb(var(--color-text-muted))] italic">
              No color picked yet.
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
      <IncomingDataModal
        isOpen={itdeTarget.isModalOpen}
        signals={itdeTarget.pendingSignals}
        onAccept={handleModalAccept}
        onIgnore={handleModalIgnore}
        onDeferAll={handleModalDeferAll}
        onIgnoreAll={handleModalIgnoreAll}
      />
    </div>
  );
}
