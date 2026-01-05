'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import useToolState from '@/app/tool/_hooks/useToolState';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata } from '@/src/types/tools';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import Button from '@/app/tool/_components/form/Button';
import Input from '@/app/tool/_components/form/Input';
import { OutputActionButtons } from '@/app/tool/_components/shared/OutputActionButtons';
import useItdeTargetHandler, {
  IncomingSignal,
} from '@/app/tool/_hooks/useItdeTargetHandler';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import { useVideoClipper } from '../_hooks/useVideoClipper';
import importedMetadata from '../metadata.json';
import {
  FilmIcon,
  ScissorsIcon,
  ArrowPathIcon,
} from '@heroicons/react/20/solid';

const metadata = importedMetadata as ToolMetadata;

interface ClipVideoToolState {
  inputFileId: string | null;
  outputFileId: string | null;
  startTime: string;
  endTime: string;
  lastUserGivenFilename: string | null;
}

const DEFAULT_TOOL_STATE: ClipVideoToolState = {
  inputFileId: null,
  outputFileId: null,
  startTime: '00:00:00.000',
  endTime: '00:00:00.000',
  lastUserGivenFilename: null,
};

// Helper to format seconds to HH:MM:SS.ms
const formatTime = (timeInSeconds: number): string => {
  if (isNaN(timeInSeconds) || timeInSeconds < 0) {
    return '00:00:00.000';
  }
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  const milliseconds = Math.round(
    (timeInSeconds - Math.floor(timeInSeconds)) * 1000
  );

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
};

export default function ClipVideoClient({ toolRoute }: { toolRoute: string }) {
  const {
    state: toolState,
    setState,
    isLoadingState,
    clearStateAndPersist,
    saveStateNow,
  } = useToolState<ClipVideoToolState>(toolRoute, DEFAULT_TOOL_STATE);

  const { getFile, makeFilePermanentAndUpdate, cleanupOrphanedTemporaryFiles } =
    useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const {
    isFfmpegLoading,
    isClipping,
    progress,
    error: clipperError,
    clipVideo,
  } = useVideoClipper();

  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [isFilenamePromptOpen, setIsFilenamePromptOpen] = useState(false);
  const [filenamePromptAction, setFilenamePromptAction] = useState<
    'save' | 'download' | null
  >(null);

  const [inputVideoSrc, setInputVideoSrc] = useState<string | null>(null);
  const [outputVideoSrc, setOutputVideoSrc] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [manualSaveSuccess, setManualSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [outputStoredFile, setOutputStoredFile] = useState<StoredFile | null>(
    null
  );
  const inputVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setError(clipperError);
  }, [clipperError]);

  // Load input video from state
  useEffect(() => {
    let objectUrl: string | null = null;
    const loadInputVideo = async () => {
      if (!toolState.inputFileId) {
        setInputVideoSrc(null);
        setVideoDuration(0);
        setCurrentTime(0);
        return;
      }
      try {
        const file = await getFile(toolState.inputFileId);
        if (file?.blob) {
          objectUrl = URL.createObjectURL(file.blob);
          setInputVideoSrc(objectUrl);
        }
      } catch (err) {
        setError('Failed to load input video.');
      }
    };
    loadInputVideo();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [toolState.inputFileId, getFile]);

  // Load output video from state
  useEffect(() => {
    let objectUrl: string | null = null;
    const loadOutputVideo = async () => {
      if (!toolState.outputFileId) {
        setOutputVideoSrc(null);
        setOutputStoredFile(null);
        return;
      }
      try {
        const file = await getFile(toolState.outputFileId);
        if (file?.blob) {
          objectUrl = URL.createObjectURL(file.blob);
          setOutputVideoSrc(objectUrl);
          setOutputStoredFile(file);
        }
      } catch (err) {
        setError('Failed to load clipped video.');
      }
    };
    loadOutputVideo();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [toolState.outputFileId, getFile]);

  const handleFilesSelected = useCallback(
    async (files: StoredFile[]) => {
      setIsLibraryModalOpen(false);
      if (files.length > 0 && files[0].id) {
        const oldInputId = toolState.inputFileId;
        const oldOutputId = toolState.outputFileId;
        await clearStateAndPersist();
        setState({ inputFileId: files[0].id });
        if (oldInputId && oldInputId !== files[0].id)
          cleanupOrphanedTemporaryFiles([oldInputId]);
        if (oldOutputId) cleanupOrphanedTemporaryFiles([oldOutputId]);
      }
    },
    [
      toolState.inputFileId,
      toolState.outputFileId,
      setState,
      clearStateAndPersist,
      cleanupOrphanedTemporaryFiles,
    ]
  );

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setError('Metadata not found for source tool.');
        return;
      }
      const resolved: ResolvedItdeData = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );
      if (resolved.type === 'itemList' && resolved.data?.length) {
        const videoItem = resolved.data.find(
          (item) => item.type?.startsWith('video/') && 'id' in item
        ) as StoredFile | undefined;
        if (videoItem) {
          handleFilesSelected([videoItem]);
        } else {
          setError('No compatible video file found in the received data.');
        }
      } else {
        setError(resolved.errorMessage || 'Failed to process incoming data.');
      }
    },
    [getToolMetadata, handleFilesSelected]
  );

  const itdeHandler = useItdeTargetHandler({
    targetToolDirective: metadata.directive,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingState) {
      itdeHandler.openModalIfSignalsExist();
    }
  }, [isLoadingState, itdeHandler]);

  const handleClip = async () => {
    if (!toolState.inputFileId) {
      setError('Please select a video file first.');
      return;
    }
    const inputFile = await getFile(toolState.inputFileId);
    if (!inputFile) {
      setError('Could not retrieve input file.');
      return;
    }

    const baseName =
      inputFile.filename.substring(0, inputFile.filename.lastIndexOf('.')) ||
      inputFile.filename;
    const ext =
      inputFile.filename.substring(inputFile.filename.lastIndexOf('.') + 1) ||
      'mp4';
    const outputFilename = `clipped-${baseName}.${ext}`;

    const newFileId = await clipVideo(
      inputFile,
      toolState.startTime,
      toolState.endTime,
      outputFilename
    );
    if (newFileId) {
      const oldOutputId = toolState.outputFileId;
      setState({ outputFileId: newFileId, lastUserGivenFilename: null });
      if (oldOutputId) cleanupOrphanedTemporaryFiles([oldOutputId]);
      setManualSaveSuccess(false);
      setDownloadSuccess(false);
    }
  };

  const handleClear = useCallback(async () => {
    const idsToClean = [];
    if (toolState.inputFileId) idsToClean.push(toolState.inputFileId);
    if (toolState.outputFileId) idsToClean.push(toolState.outputFileId);

    await clearStateAndPersist();
    setError(null);
    setManualSaveSuccess(false);
    setDownloadSuccess(false);

    if (idsToClean.length > 0) {
      cleanupOrphanedTemporaryFiles(idsToClean);
    }
  }, [
    clearStateAndPersist,
    toolState.inputFileId,
    toolState.outputFileId,
    cleanupOrphanedTemporaryFiles,
  ]);

  const initiateSave = () => {
    if (!outputStoredFile) return;
    setFilenamePromptAction('save');
    setIsFilenamePromptOpen(true);
  };

  const initiateDownload = () => {
    if (!outputStoredFile) return;
    setFilenamePromptAction('download');
    setIsFilenamePromptOpen(true);
  };

  const handleConfirmFilename = async (filename: string) => {
    setIsFilenamePromptOpen(false);
    if (!outputStoredFile) return;

    if (filenamePromptAction === 'save') {
      const success = await makeFilePermanentAndUpdate(
        outputStoredFile.id,
        filename
      );
      if (success) {
        setManualSaveSuccess(true);
        setTimeout(() => setManualSaveSuccess(false), 2000);
        setState({ lastUserGivenFilename: filename });
        // Refresh file state to reflect permanent status
        const updatedFile = await getFile(outputStoredFile.id);
        if (updatedFile) setOutputStoredFile(updatedFile);
      }
    } else if (filenamePromptAction === 'download') {
      const url = URL.createObjectURL(outputStoredFile.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
      setState({ lastUserGivenFilename: filename });
    }
  };

  const isLoading = isFfmpegLoading || isClipping;
  const loadingText = isFfmpegLoading
    ? 'Loading Engine...'
    : isClipping
      ? `Clipping... ${progress}%`
      : '';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 p-4 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <div className="flex flex-wrap gap-3 items-center">
          <Button
            variant="accent2"
            iconLeft={<FilmIcon className="h-5 w-5" />}
            onClick={() => setIsLibraryModalOpen(true)}
            disabled={isLoading}
          >
            {toolState.inputFileId ? 'Change Video' : 'Select Video'}
          </Button>
          <Button
            variant="primary"
            onClick={handleClip}
            disabled={!toolState.inputFileId || isLoading}
            isLoading={isLoading}
            loadingText={loadingText}
            iconLeft={isLoading ? undefined : <ScissorsIcon className="h-5 w-5" />}
          >
            Clip Video
          </Button>
          <div className="flex gap-2 ml-auto items-center">
            <OutputActionButtons
              canPerform={!!toolState.outputFileId && !isLoading}
              isSaveSuccess={manualSaveSuccess}
              isDownloadSuccess={downloadSuccess}
              canInitiateSave={
                !!outputStoredFile && outputStoredFile.isTemporary !== false
              }
              onInitiateSave={initiateSave}
              onInitiateDownload={initiateDownload}
              onClear={handleClear}
              directiveName={metadata.directive}
              outputConfig={metadata.outputConfig}
              selectedOutputItems={outputStoredFile ? [outputStoredFile] : []}
            />
          </div>
        </div>

        {toolState.inputFileId && (
          <div className="flex flex-wrap gap-4 items-end pt-3 border-t border-[rgb(var(--color-border-base))] mt-2">
            <Input
              label="Start Time (HH:MM:SS.ms)"
              value={toolState.startTime}
              onChange={(e) => setState({ startTime: e.target.value })}
              containerClassName="flex-grow"
            />
            <Button
              size="sm"
              onClick={() => setState({ startTime: formatTime(currentTime) })}
            >
              Set Current
            </Button>
            <Input
              label="End Time (HH:MM:SS.ms)"
              value={toolState.endTime}
              onChange={(e) => setState({ endTime: e.target.value })}
              containerClassName="flex-grow"
            />
            <Button
              size="sm"
              onClick={() => setState({ endTime: formatTime(currentTime) })}
            >
              Set Current
            </Button>
          </div>
        )}
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
            Input Video {videoDuration > 0 && `(${formatTime(videoDuration)})`}
          </h3>
          <div className="w-full aspect-video border rounded-md bg-black flex items-center justify-center overflow-hidden">
            {inputVideoSrc ? (
              <video
                ref={inputVideoRef}
                src={inputVideoSrc}
                controls
                className="max-w-full max-h-full"
                onLoadedMetadata={(e) =>
                  setVideoDuration(e.currentTarget.duration)
                }
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              />
            ) : (
              <span className="text-sm italic text-[rgb(var(--color-text-muted))]">
                Select a video to begin
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Clipped Output
          </h3>
          <div className="w-full aspect-video border rounded-md bg-black flex items-center justify-center overflow-hidden">
            {isLoading && !outputVideoSrc ? (
              <div className="flex flex-col items-center text-sm italic text-[rgb(var(--color-text-muted))]">
                <ArrowPathIcon className="animate-spin h-8 w-8 mb-2" />
                {loadingText}
              </div>
            ) : outputVideoSrc ? (
              <video
                src={outputVideoSrc}
                controls
                className="max-w-full max-h-full"
              />
            ) : (
              <span className="text-sm italic text-[rgb(var(--color-text-muted))]">
                Output appears here
              </span>
            )}
          </div>
        </div>
      </div>

      <FileSelectionModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        onFilesSelected={handleFilesSelected}
        mode="selectExistingOrUploadNew"
        accept="video/*"
        selectionMode="single"
        libraryFilter={{ category: 'video' }}
      />
      <FilenamePromptModal
        isOpen={isFilenamePromptOpen}
        onClose={() => setIsFilenamePromptOpen(false)}
        onConfirm={handleConfirmFilename}
        initialFilename={outputStoredFile?.filename || 'clipped-video.mp4'}
        title={
          filenamePromptAction === 'save'
            ? 'Save Clipped Video'
            : 'Download Clipped Video'
        }
        confirmButtonText={
          filenamePromptAction === 'save' ? 'Save to Library' : 'Download'
        }
        filenameAction={filenamePromptAction || undefined}
      />
      <IncomingDataModal
        isOpen={itdeHandler.isModalOpen}
        signals={itdeHandler.pendingSignals}
        onAccept={itdeHandler.acceptSignal}
        onIgnore={itdeHandler.ignoreSignal}
        onDeferAll={itdeHandler.closeModal}
        onIgnoreAll={itdeHandler.ignoreAllSignals}
      />
    </div>
  );
}