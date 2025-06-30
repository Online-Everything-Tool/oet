'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import useToolState from '@/app/tool/_hooks/useToolState';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import type { StoredFile } from '@/src/types/storage';
import type { ToolMetadata } from '@/src/types/tools';
import Input from '@/app/tool/_components/form/Input';
import Select from '@/app/tool/_components/form/Select';
import Checkbox from '@/app/tool/_components/form/Checkbox';
import Range from '@/app/tool/_components/form/Range';
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

const BARCODE_FORMATS = [
  { value: 'CODE128', label: 'CODE128 (Most flexible)' },
  { value: 'CODE39', label: 'CODE39' },
  { value: 'EAN13', label: 'EAN-13' },
  { value: 'EAN8', label: 'EAN-8' },
  { value: 'UPC', label: 'UPC-A' },
  { value: 'ITF14', label: 'ITF-14' },
  { value: 'MSI', label: 'MSI' },
  { value: 'pharmacode', label: 'Pharmacode' },
];

const BARCODE_FORMAT_INFO: Record<
  string,
  { description: string; example: string }
> = {
  CODE128: {
    description: 'Supports all ASCII characters.',
    example: 'OET Rocks!',
  },
  CODE39: {
    description:
      'Supports uppercase letters (A-Z), digits (0-9), and symbols (- . $ / + %).',
    example: 'CODE-39-EXAMPLE',
  },
  EAN13: {
    description:
      'Requires 12 digits. The 13th (checksum) digit is automatically calculated.',
    example: '978014313184',
  },
  EAN8: {
    description:
      'Requires 7 digits. The 8th (checksum) digit is automatically calculated.',
    example: '1234567',
  },
  UPC: {
    description:
      'Requires 11 digits (UPC-A). The 12th (checksum) digit is automatically calculated.',
    example: '03600029145',
  },
  ITF14: {
    description:
      'Requires 13 digits. The 14th (checksum) digit is automatically calculated.',
    example: '1234567890123',
  },
  MSI: { description: 'Supports digits (0-9) only.', example: '123456789' },
  pharmacode: {
    description: 'A numeric format. Supports integers from 3 to 131070.',
    example: '12345',
  },
};

interface BarcodeState {
  data: string;
  format: string;
  width: number;
  height: number;
  displayValue: boolean;
  margin: number;
  generatedBarcodeId: string | null;
  lastUserGivenFilename: string | null;
}

const DEFAULT_STATE: BarcodeState = {
  data: 'OET Rocks!',
  format: 'CODE128',
  width: 2,
  height: 100,
  displayValue: true,
  margin: 10,
  generatedBarcodeId: null,
  lastUserGivenFilename: null,
};

interface BarcodeGeneratorClientProps {
  toolRoute: string;
}

export default function BarcodeGeneratorClient({
  toolRoute,
}: BarcodeGeneratorClientProps) {
  const {
    state,
    setState,
    isLoadingState,
    saveStateNow,
    clearStateAndPersist,
  } = useToolState<BarcodeState>(toolRoute, DEFAULT_STATE);

  const {
    addFile,
    getFile,
    makeFilePermanentAndUpdate,
    cleanupOrphanedTemporaryFiles,
  } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<React.ReactNode | null>(null);
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
        const oldGeneratedId = state.generatedBarcodeId;
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
      state.generatedBarcodeId,
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
    if (isLoadingState) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (!state.data) {
      if (state.generatedBarcodeId) {
        const cleanUp = async (generatedBarcodeId: string) => {
          await saveStateNow({ ...state, generatedBarcodeId: null });
          cleanupOrphanedTemporaryFiles([generatedBarcodeId]);
        };
        cleanUp(state.generatedBarcodeId);
      }
      return;
    }

    JsBarcode(canvas, state.data, {
      format: state.format,
      width: state.width,
      height: state.height,
      displayValue: state.displayValue,
      margin: state.margin,
      font: 'monospace',
      valid: (isValid) => {
        console.log(
          `%c[JsBarcode valid callback]`,
          'color: #8A2BE2;',
          `isValid: ${isValid}`
        );
        if (isValid) {
          canvas.toBlob(async (blob) => {
            console.log(
              `%c[JsBarcode toBlob callback]`,
              'color: #8A2BE2;',
              'toBlob fired. Blob size:',
              blob?.size
            );
            if (blob && blob.size > 0) {
              setError(null);
              const filename = `barcode-${state.format}-${state.data.slice(0, 10)}.png`;
              const previousId = state.generatedBarcodeId;
              const newFileId = await addFile(
                blob,
                filename,
                'image/png',
                true
              );
              await saveStateNow({
                ...state,
                generatedBarcodeId: newFileId,
              });
              if (previousId) {
                console.log('clean up!');
                cleanupOrphanedTemporaryFiles([previousId]);
              }
              setSaveSuccess(false);
              setDownloadSuccess(false);
            } else {
              setError('Failed to generate a valid barcode image from data.');
            }
          }, 'image/png');
        } else {
          const formatInfo = BARCODE_FORMAT_INFO[state.format];
          const helpText = formatInfo ? (
            <div className="mt-2 text-xs text-left">
              <p className="font-semibold">{formatInfo.description}</p>
              <p>
                Example:{' '}
                <code className="bg-gray-200 p-1 rounded">
                  {formatInfo.example}
                </code>
              </p>
            </div>
          ) : (
            <p>Please check the data format.</p>
          );

          const errorMessage = (
            <div className="text-center">
              <p className="font-bold">Invalid data for {state.format}</p>
              {helpText}
            </div>
          );

          setError(errorMessage);
          if (state.generatedBarcodeId) {
            const cleanUp = async (generatedBarcodeId: string) => {
              await saveStateNow({ ...state, generatedBarcodeId: null });
              cleanupOrphanedTemporaryFiles([generatedBarcodeId]);
            };
            cleanUp(state.generatedBarcodeId);
          }
        }
      },
    });
  }, [
    state.data,
    state.format,
    state.width,
    state.height,
    state.displayValue,
    state.margin,
    addFile,
    cleanupOrphanedTemporaryFiles,
    saveStateNow,
    isLoadingState,
  ]);

  useEffect(() => {
    const updateFileStatus = async () => {
      if (state.generatedBarcodeId) {
        const file = await getFile(state.generatedBarcodeId);
        setIsPermanent(file?.isTemporary === false);
        setStoredFileForItde(file || null);
      } else {
        setIsPermanent(false);
        setStoredFileForItde(null);
      }
    };
    updateFileStatus();
  }, [state.generatedBarcodeId, getFile]);

  const handleClear = async () => {
    const oldGeneratedId = state.generatedBarcodeId;
    await clearStateAndPersist();
    setError(null);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    if (oldGeneratedId) {
      cleanupOrphanedTemporaryFiles([oldGeneratedId]);
    }
  };

  const generateDefaultOutputFilename = useCallback(() => {
    return `barcode-${state.format}-${state.data
      .slice(0, 10)
      .replace(/[^a-zA-Z0-9]/g, '_')}.png`;
  }, [state.data, state.format]);

  const initiateSave = () => {
    if (!state.generatedBarcodeId) return;
    const filename =
      state.lastUserGivenFilename || generateDefaultOutputFilename();
    setFilenamePromptInitialValue(filename);
    setFilenamePromptAction('save');
    setIsFilenamePromptOpen(true);
  };

  const initiateDownload = () => {
    if (!state.generatedBarcodeId) return;
    const filename =
      state.lastUserGivenFilename || generateDefaultOutputFilename();
    setFilenamePromptInitialValue(filename);
    setFilenamePromptAction('download');
    setIsFilenamePromptOpen(true);
  };

  const handleConfirmFilename = async (filename: string) => {
    setIsFilenamePromptOpen(false);
    if (!state.generatedBarcodeId) return;

    if (filenamePromptAction === 'save') {
      const success = await makeFilePermanentAndUpdate(
        state.generatedBarcodeId,
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
      const file = await getFile(state.generatedBarcodeId);
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

  const canPerformActions = !!state.generatedBarcodeId && !error;

  if (isLoadingState && !initialToolStateLoadCompleteRef.current) {
    return (
      <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">
        Loading Barcode Generator...
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-4">
        <h3 className="text-lg font-semibold text-[rgb(var(--color-text-emphasis))]">
          Settings
        </h3>
        <Input
          label="Data to Encode"
          id="data"
          value={state.data}
          onChange={(e) => {
            console.log(
              `%c[Input onChange]`,
              'color: purple;',
              'New data value:',
              e.target.value
            );
            setState({ data: e.target.value });
          }}
        />
        <Select
          label="Barcode Format"
          id="format"
          options={BARCODE_FORMATS}
          value={state.format}
          onChange={(e) => setState({ format: e.target.value })}
        />
        <Range
          label="Bar Width (px)"
          id="width"
          min={1}
          max={4}
          step={0.5}
          value={state.width}
          onChange={(e) => setState({ width: parseFloat(e.target.value) })}
        />
        <Range
          label="Height (px)"
          id="height"
          min={20}
          max={200}
          value={state.height}
          onChange={(e) => setState({ height: parseInt(e.target.value, 10) })}
        />
        <Range
          label="Margin (px)"
          id="margin"
          min={0}
          max={50}
          value={state.margin}
          onChange={(e) => setState({ margin: parseInt(e.target.value, 10) })}
        />
        <Checkbox
          label="Display Text Value"
          id="displayValue"
          checked={state.displayValue}
          onChange={(e) => setState({ displayValue: e.target.checked })}
        />
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
        <div className="p-4 border rounded-md bg-[rgb(var(--color-bg-subtle))] min-h-[200px] flex items-center justify-center">
          {error && (
            <div className="text-[rgb(var(--color-status-error))] text-center p-2 bg-[rgb(var(--color-bg-error-subtle))] border border-dashed border-[rgb(var(--color-border-error))] rounded-md">
              {error}
            </div>
          )}
          <canvas ref={canvasRef} className={error ? 'hidden' : 'max-w-full'} />
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
          filenamePromptAction === 'save' ? 'Save Barcode' : 'Download Barcode'
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
