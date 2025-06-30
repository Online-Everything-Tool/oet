'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { useDebounce } from 'use-debounce';
import useToolState from '@/app/tool/_hooks/useToolState';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata } from '@/src/types/tools';
import Textarea from '@/app/tool/_components/form/Textarea';
import Select from '@/app/tool/_components/form/Select';
import Range from '@/app/tool/_components/form/Range';
import Input from '@/app/tool/_components/form/Input';
import { OutputActionButtons } from '@/app/tool/_components/shared/OutputActionButtons';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import useItdeTargetHandler, {
  IncomingSignal,
} from '@/app/tool/_hooks/useItdeTargetHandler';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '@/app/tool/_components/shared/ReceiveItdeDataTrigger';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import importedMetadata from '../metadata.json';

const metadata = importedMetadata as ToolMetadata;

const ERROR_CORRECTION_LEVELS = [
  { value: 'L', label: 'Low (~7% correction)' },
  { value: 'M', label: 'Medium (~15% correction)' },
  { value: 'Q', label: 'Quartile (~25% correction)' },
  { value: 'H', label: 'High (~30% correction)' },
];

interface QRCodeState {
  data: string;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  size: number;
  margin: number;
  colorDark: string;
  colorLight: string;
  generatedQrCodeId: string | null;
  lastUserGivenFilename: string | null;
}

const DEFAULT_STATE: QRCodeState = {
  data: 'https://online-everything-tool.com',
  errorCorrectionLevel: 'M',
  size: 300,
  margin: 4,
  colorDark: '#000000',
  colorLight: '#ffffff',
  generatedQrCodeId: null,
  lastUserGivenFilename: null,
};

interface QRCodeGeneratorClientProps {
  toolRoute: string;
}

export default function QRCodeGeneratorClient({
  toolRoute,
}: QRCodeGeneratorClientProps) {
  const {
    state,
    setState,
    isLoadingState,
    saveStateNow,
    clearStateAndPersist,
  } = useToolState<QRCodeState>(toolRoute, DEFAULT_STATE);

  const inputsToDebounce = useMemo(
    () => ({
      data: state.data,
      errorCorrectionLevel: state.errorCorrectionLevel,
      size: state.size,
      margin: state.margin,
      colorDark: state.colorDark,
      colorLight: state.colorLight,
    }),
    [
      state.data,
      state.errorCorrectionLevel,
      state.size,
      state.margin,
      state.colorDark,
      state.colorLight,
    ]
  );
  const [debouncedInputs] = useDebounce(inputsToDebounce, 300);

  const {
    addFile,
    getFile,
    makeFilePermanentAndUpdate,
    cleanupOrphanedTemporaryFiles,
  } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isPermanent, setIsPermanent] = useState(false);
  const [storedFileForItde, setStoredFileForItde] = useState<StoredFile | null>(
    null
  );
  const [isFilenamePromptOpen, setIsFilenamePromptOpen] = useState(false);
  const [filenamePromptAction, setFilenamePromptAction] = useState<
    'save' | 'download' | null
  >(null);
  const [filenamePromptInitialValue, setFilenamePromptInitialValue] =
    useState('');

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
      const firstTextItem = resolvedPayload.data.find((item) =>
        item.type?.startsWith('text/')
      );
      if (firstTextItem) {
        const text = await firstTextItem.blob.text();
        const oldGeneratedId = state.generatedQrCodeId;
        const newState = { ...DEFAULT_STATE, data: text };
        await saveStateNow(newState);
        if (oldGeneratedId) cleanupOrphanedTemporaryFiles([oldGeneratedId]);
      } else {
        setError('No valid text data found in received ITDE data.');
      }
      setUserDeferredAutoPopup(false);
    },
    [
      getToolMetadata,
      saveStateNow,
      state.generatedQrCodeId,
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

  // Generation and Cleanup Effect
  useEffect(() => {
    if (isLoadingState) {
      return;
    }

    const generateQRCode = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const oldIdToCleanup = state.generatedQrCodeId;

      if (!debouncedInputs.data) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        setError(null);
        if (oldIdToCleanup) {
          await saveStateNow({ ...state, generatedQrCodeId: null });
          await cleanupOrphanedTemporaryFiles([oldIdToCleanup]);
        }
        return;
      }

      try {
        await QRCode.toCanvas(canvas, debouncedInputs.data, {
          errorCorrectionLevel: debouncedInputs.errorCorrectionLevel,
          margin: debouncedInputs.margin,
          width: debouncedInputs.size,
          color: {
            dark: debouncedInputs.colorDark,
            light: debouncedInputs.colorLight,
          },
        });
        setError(null);

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png')
        );
        if (blob && blob.size > 0) {
          const filename = `qrcode-${debouncedInputs.data.slice(0, 15)}.png`;
          const newFileId = await addFile(blob, filename, 'image/png', true);

          if (newFileId !== oldIdToCleanup) {
            await saveStateNow({ ...state, generatedQrCodeId: newFileId });
            if (oldIdToCleanup) {
              await cleanupOrphanedTemporaryFiles([oldIdToCleanup]);
            }
          }
          setSaveSuccess(false);
          setDownloadSuccess(false);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to generate QR Code: ${message}`);
        if (oldIdToCleanup) {
          await saveStateNow({ ...state, generatedQrCodeId: null });
          await cleanupOrphanedTemporaryFiles([oldIdToCleanup]);
        }
      }
    };

    generateQRCode();
  }, [debouncedInputs, isLoadingState, saveStateNow]);

  useEffect(() => {
    const updateFileStatus = async () => {
      if (state.generatedQrCodeId) {
        const file = await getFile(state.generatedQrCodeId);
        setIsPermanent(file?.isTemporary === false);
        setStoredFileForItde(file || null);
      } else {
        setIsPermanent(false);
        setStoredFileForItde(null);
      }
    };
    updateFileStatus();
  }, [state.generatedQrCodeId, getFile]);

  const handleClear = async () => {
    const oldGeneratedId = state.generatedQrCodeId;
    await clearStateAndPersist();
    setError(null);
    if (oldGeneratedId) {
      cleanupOrphanedTemporaryFiles([oldGeneratedId]);
    }
  };

  const generateDefaultOutputFilename = useCallback(() => {
    return `qrcode-${state.data
      .slice(0, 15)
      .replace(/[^a-zA-Z0-9]/g, '_')}.png`;
  }, [state.data]);

  const initiateSave = () => {
    if (!state.generatedQrCodeId) return;
    const filename =
      state.lastUserGivenFilename || generateDefaultOutputFilename();
    setFilenamePromptInitialValue(filename);
    setFilenamePromptAction('save');
    setIsFilenamePromptOpen(true);
  };

  const initiateDownload = () => {
    if (!state.generatedQrCodeId) return;
    const filename =
      state.lastUserGivenFilename || generateDefaultOutputFilename();
    setFilenamePromptInitialValue(filename);
    setFilenamePromptAction('download');
    setIsFilenamePromptOpen(true);
  };

  const handleConfirmFilename = async (filename: string) => {
    setIsFilenamePromptOpen(false);
    if (!state.generatedQrCodeId) return;

    if (filenamePromptAction === 'save') {
      const success = await makeFilePermanentAndUpdate(
        state.generatedQrCodeId,
        filename
      );
      if (success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        setState({ lastUserGivenFilename: filename });
      } else {
        setError('Failed to save file to library.');
      }
    } else if (filenamePromptAction === 'download') {
      const file = await getFile(state.generatedQrCodeId);
      if (!file?.blob) {
        setError('Could not find file to download.');
        return;
      }
      const url = URL.createObjectURL(file.blob);
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
    setFilenamePromptAction(null);
  };

  const canPerformActions = !!state.generatedQrCodeId && !error;

  if (isLoadingState && !initialToolStateLoadCompleteRef.current) {
    return (
      <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">
        Loading QR Code Generator...
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-4">
        <h3 className="text-lg font-semibold text-[rgb(var(--color-text-emphasis))]">
          Settings
        </h3>
        <Textarea
          label="Data to Encode"
          id="data"
          value={state.data}
          onChange={(e) => setState({ data: e.target.value })}
          rows={5}
        />
        <Select
          label="Error Correction"
          id="errorCorrectionLevel"
          options={ERROR_CORRECTION_LEVELS}
          value={state.errorCorrectionLevel}
          onChange={(e) =>
            setState({
              errorCorrectionLevel: e.target.value as 'L' | 'M' | 'Q' | 'H',
            })
          }
        />
        <Range
          label="Size (px)"
          id="size"
          min={50}
          max={1000}
          step={10}
          value={state.size}
          onChange={(e) => setState({ size: parseInt(e.target.value, 10) })}
        />
        <Range
          label="Margin"
          id="margin"
          min={0}
          max={20}
          value={state.margin}
          onChange={(e) => setState({ margin: parseInt(e.target.value, 10) })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Dark Color"
            id="colorDark"
            type="color"
            value={state.colorDark}
            onChange={(e) => setState({ colorDark: e.target.value })}
            inputClassName="h-10"
          />
          <Input
            label="Light Color"
            id="colorLight"
            type="color"
            value={state.colorLight}
            onChange={(e) => setState({ colorLight: e.target.value })}
            inputClassName="h-10"
          />
        </div>
      </div>

      <div className="md:col-span-2">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold text-[rgb(var(--color-text-emphasis))]">
            Output
          </h3>
          <ReceiveItdeDataTrigger
            hasDeferredSignals={
              itdeTarget.pendingSignals.length > 0 &&
              userDeferredAutoPopup &&
              !itdeTarget.isModalOpen
            }
            pendingSignalCount={itdeTarget.pendingSignals.length}
            onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
          />
        </div>
        <div className="p-4 border rounded-md bg-[rgb(var(--color-bg-subtle))] min-h-[320px] flex items-center justify-center">
          {error && (
            <div className="text-[rgb(var(--color-status-error))] text-center p-2 bg-[rgb(var(--color-bg-error-subtle))] border border-dashed border-[rgb(var(--color-border-error))] rounded-md">
              {error}
            </div>
          )}
          <canvas ref={canvasRef} className={error ? 'hidden' : ''} />
        </div>
        <div className="mt-4 flex justify-end">
          <OutputActionButtons
            canPerform={canPerformActions}
            isSaveSuccess={saveSuccess}
            isDownloadSuccess={downloadSuccess}
            canInitiateSave={canPerformActions && !isPermanent}
            onInitiateSave={initiateSave}
            onInitiateDownload={initiateDownload}
            onClear={handleClear}
            directiveName={metadata.directive}
            outputConfig={metadata.outputConfig}
            selectedOutputItems={storedFileForItde ? [storedFileForItde] : []}
          />
        </div>
      </div>
      <FilenamePromptModal
        isOpen={isFilenamePromptOpen}
        onClose={() => setIsFilenamePromptOpen(false)}
        onConfirm={handleConfirmFilename}
        initialFilename={filenamePromptInitialValue}
        title={
          filenamePromptAction === 'save'
            ? 'Save QR Code'
            : 'Download QR Code'
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