'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import useToolState from '@/app/tool/_hooks/useToolState';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useMetadata } from '@/app/context/MetadataContext';
import {
  usePdfCompressor,
  CompressionLevel,
} from '../_hooks/usePdfCompressor';
import type { StoredFile } from '@/src/types/storage';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import Button from '@/app/tool/_components/form/Button';
import RadioGroup from '@/app/tool/_components/form/RadioGroup';
import {
  DocumentArrowUpIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { formatBytes } from '@/app/lib/utils';
import { OutputActionButtons } from '@/app/tool/_components/shared/OutputActionButtons';
import useItdeTargetHandler from '@/app/tool/_hooks/useItdeTargetHandler';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import { resolveItdeData } from '@/app/lib/itdeDataUtils';
import toolSpecificMetadata from '../metadata.json';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import type { OutputConfig, ReferenceDetails } from '@/src/types/tool';


interface PdfCompressorState {
  inputPdfId: string | null;
  processedPdfId: string | null;
  compressionLevel: CompressionLevel;
  inputPdfName: string | null;
  inputPdfSize: number | null;
  processedPdfSize: number | null;
  lastUserGivenFilename: string | null;
}

const DEFAULT_STATE: PdfCompressorState = {
  inputPdfId: null,
  processedPdfId: null,
  compressionLevel: 'medium',
  inputPdfName: null,
  inputPdfSize: null,
  processedPdfSize: null,
  lastUserGivenFilename: null,
};

export default function PdfCompressorClient({
  toolRoute,
}: {
  toolRoute: string;
}) {
  const {
    state,
    setState,
    isLoadingState,
    clearStateAndPersist,
  } = useToolState<PdfCompressorState>(toolRoute, DEFAULT_STATE);
  const {
    getFile,
    addFile,
    makeFilePermanentAndUpdate,
    cleanupOrphanedTemporaryFiles,
  } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const {
    isCompressing,
    error: compressorError,
    compressPdf,
  } = usePdfCompressor();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processedFile, setProcessedFile] = useState<StoredFile | null>(null);
  const [isFilenamePromptOpen, setIsFilenamePromptOpen] = useState(false);
  const [manualSaveSuccess, setManualSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    setError(compressorError);
  }, [compressorError]);

  const handleClear = useCallback(async () => {
    const idsToClean = [];
    if (state.inputPdfId) idsToClean.push(state.inputPdfId);
    if (state.processedPdfId) idsToClean.push(state.processedPdfId);

    await clearStateAndPersist();
    setProcessedFile(null);
    setError(null);

    if (idsToClean.length > 0) {
      cleanupOrphanedTemporaryFiles(idsToClean);
    }
  }, [
    clearStateAndPersist,
    state.inputPdfId,
    state.processedPdfId,
    cleanupOrphanedTemporaryFiles,
  ]);

  const handleFileSelected = useCallback(
    async (files: StoredFile[]) => {
      setIsModalOpen(false);
      if (files.length > 0 && files[0].id) {
        const selectedFile = files[0];
        if (state.inputPdfId !== selectedFile.id) {
          await handleClear();
          setState({
            inputPdfId: selectedFile.id,
            inputPdfName: selectedFile.filename,
            inputPdfSize: selectedFile.size,
          });
        }
      }
    },
    [state.inputPdfId, setState, handleClear]
  );

  const handleItdeSignal = useCallback(
    async (signal: { sourceDirective: string }) => {
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setError(`Metadata not found for source: ${signal.sourceDirective}`);
        return;
      }
      const resolved = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );
      if (
        resolved.type === 'itemList' &&
        resolved.data &&
        resolved.data.length > 0
      ) {
        const pdfItem = resolved.data.find(
          (item) => item.type === 'application/pdf' && 'id' in item
        ) as StoredFile | undefined;
        if (pdfItem) {
          if (state.inputPdfId !== pdfItem.id) {
            await handleClear();
            setState({
              inputPdfId: pdfItem.id,
              inputPdfName: pdfItem.filename,
              inputPdfSize: pdfItem.size,
            });
          }
        } else {
          setError('No PDF file found in the received data.');
        }
      } else {
        setError(resolved.errorMessage || 'Failed to receive data.');
      }
    },
    [getToolMetadata, setState, state.inputPdfId, handleClear]
  );

  const itdeHandler = useItdeTargetHandler({
    targetToolDirective: toolSpecificMetadata.directive,
    onProcessSignal: handleItdeSignal,
  });

  useEffect(() => {
    if (!isLoadingState) {
      itdeHandler.openModalIfSignalsExist();
    }
  }, [isLoadingState, itdeHandler]);

  useEffect(() => {
    if (state.processedPdfId) {
      getFile(state.processedPdfId).then((file) => setProcessedFile(file));
    } else {
      setProcessedFile(null);
    }
  }, [state.processedPdfId, getFile]);

  const handleCompress = async () => {
    if (!state.inputPdfId) {
      setError('Please select a PDF file first.');
      return;
    }
    setError(null);
    const inputFile = await getFile(state.inputPdfId);
    if (!inputFile) {
      setError('Could not retrieve the selected PDF file.');
      return;
    }

    const compressedBlob = await compressPdf(inputFile, state.compressionLevel);

    if (compressedBlob) {
      const oldProcessedId = state.processedPdfId;
      const baseName =
        inputFile.filename.substring(0, inputFile.filename.lastIndexOf('.')) ||
        inputFile.filename;
      const outputFileName = `${baseName}-compressed.pdf`;

      const newFileId = await addFile(
        compressedBlob,
        outputFileName,
        'application/pdf',
        true
      );

      setState({
        processedPdfId: newFileId,
        processedPdfSize: compressedBlob.size,
        lastUserGivenFilename: null,
      });
      setManualSaveSuccess(false);
      setDownloadSuccess(false);

      if (oldProcessedId) {
        cleanupOrphanedTemporaryFiles([oldProcessedId]);
      }
    }
  };

  const initiateSave = () => {
    if (!processedFile) return;

    setIsFilenamePromptOpen(true);
  };

  const handleConfirmFilename = async (filename: string) => {
    setIsFilenamePromptOpen(false);
    if (!state.processedPdfId) return;

    const success = await makeFilePermanentAndUpdate(
      state.processedPdfId,
      filename
    );
    if (success) {
      setProcessedFile((prev) =>
        prev ? { ...prev, isTemporary: false } : null
      );
      setManualSaveSuccess(true);
      setState({ lastUserGivenFilename: filename });
      setTimeout(() => setManualSaveSuccess(false), 2000);
    } else {
      setError('Failed to save file to library.');
    }
  };

  const handleDownload = () => {
    if (!processedFile?.blob) return;
    const url = URL.createObjectURL(processedFile.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = state.lastUserGivenFilename || processedFile.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  const compressionOptions = useMemo(
    () => [
      { value: 'low', label: 'Basic (Compatibility)' },
      { value: 'medium', label: 'Recommended' },
      { value: 'high', label: 'High (Removes Metadata)' },
    ],
    []
  );

  const sizeReduction =
    state.inputPdfSize && state.processedPdfSize
      ? ((state.inputPdfSize - state.processedPdfSize) / state.inputPdfSize) *
        100
      : 0;

  const canPerformActions = !!state.processedPdfId && !isCompressing;
  const canInitiateSaveCurrent = canPerformActions && !!processedFile?.isTemporary;

  const outputConfig = useMemo<OutputConfig>(
    () => ({
      transferableContent: [{ dataType: 'file', stateKey: 'processedPdfId' }],
    }),
    []
  );


  return (
    <div className="space-y-4">
      {/* ... other JSX ... */}
          <OutputActionButtons
            {/* other props */}
            directiveName={toolSpecificMetadata.directive}
            outputConfig={outputConfig}
            {/* other props */}
          />
        </div>
      )}
      {/* ... other JSX ... */}

    </div>
  );
}
