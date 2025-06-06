'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '@/app/tool/_hooks/useToolState';
import useXlsCsvConverter from '../_hooks/useXlsCsvConverter';
import Button from '@/app/tool/_components/form/Button';
import RadioGroup from '@/app/tool/_components/form/RadioGroup';
import FileSelectionModal from '@/app/tool/_components/shared/FileSelectionModal';
import FilenamePromptModal from '@/app/tool/_components/shared/FilenamePromptModal';
import { OutputActionButtons } from '@/app/tool/_components/shared/OutputActionButtons';
import type { ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { ArrowUpTrayIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '@/app/tool/_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '@/app/tool/_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '@/app/tool/_components/shared/ReceiveItdeDataTrigger';
import { formatBytes } from '@/app/lib/utils';
import importedMetadata from '../metadata.json';

type ConversionDirection = 'xlsToCsv' | 'csvToXlsx';

interface ConverterState {
  inputFileId: string | null;
  inputFilename: string | null;
  inputFileSize: number | null;
  outputFileId: string | null;
  outputFilename: string | null;
  conversionDirection: ConversionDirection;
  processingError: string | null;
}

const DEFAULT_STATE: ConverterState = {
  inputFileId: null,
  inputFilename: null,
  inputFileSize: null,
  outputFileId: null,
  outputFilename: null,
  conversionDirection: 'xlsToCsv',
  processingError: null,
};

const metadata = importedMetadata as ToolMetadata;

interface XlsCsvConverterClientProps {
  toolRoute: string;
}

export default function XlsCsvConverterClient({ toolRoute }: XlsCsvConverterClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    saveStateNow,
  } = useToolState<ConverterState>(toolRoute, DEFAULT_STATE);

  const { addFile, getFile, cleanupOrphanedTemporaryFiles } = useFileLibrary();
  const { getToolMetadata } = useMetadata();
  const converter = useXlsCsvConverter();

  const [isFileSelectionModalOpen, setIsFileSelectionModalOpen] = useState(false);
  const [isFilenamePromptModalOpen, setIsFilenamePromptModalOpen] = useState(false);
  const [filenameAction, setFilenameAction] = useState<'download' | 'save' | null>(null);
  
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const directiveName = metadata.directive;

  const conversionOptions = useMemo(
    () => [
      { value: 'xlsToCsv' as ConversionDirection, label: 'XLS/XLSX to CSV' },
      { value: 'csvToXlsx' as ConversionDirection, label: 'CSV to XLSX' },
    ],
    []
  );

  const performConversion = useCallback(async (inputFile: StoredFile, direction: ConversionDirection) => {
    if (!inputFile.blob) {
      setToolState(prev => ({ ...prev, processingError: 'Input file blob is missing.' }));
      return;
    }
    setToolState(prev => ({ ...prev, processingError: null, outputFileId: null, outputFilename: null }));
    converter.resetConverter();

    const result = await converter.convert(inputFile.blob as File, inputFile.filename, direction);

    if (result && !converter.conversionError) {
      const { data, filename: outputName, mimeType } = result;
      const outputBlob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
      
      try {
        const newOutputFileId = await addFile(outputBlob, outputName, mimeType, true, toolRoute);
        const oldOutputFileId = toolState.outputFileId;
        setToolState(prev => ({ ...prev, outputFileId: newOutputFileId, outputFilename: outputName, processingError: null }));
        if (oldOutputFileId) {
            cleanupOrphanedTemporaryFiles([oldOutputFileId]).catch(e => console.error("Error cleaning up old output file:", e));
        }
      } catch (e) {
        setToolState(prev => ({ ...prev, processingError: `Failed to save output file: ${e instanceof Error ? e.message : String(e)}` }));
      }
    } else if (converter.conversionError) {
      setToolState(prev => ({ ...prev, processingError: converter.conversionError, outputFileId: null, outputFilename: null }));
    }
  }, [addFile, converter, setToolState, toolState.outputFileId, cleanupOrphanedTemporaryFiles, toolRoute]);

  useEffect(() => {
    if (!isLoadingToolState && toolState.inputFileId && !converter.isConverting) {
      const loadAndConvert = async () => {
        const file = await getFile(toolState.inputFileId!);
        if (file) {
          if (!toolState.outputFileId || toolState.processingError) {
             await performConversion(file, toolState.conversionDirection);
          }
        } else {
          setToolState(prev => ({ ...prev, inputFileId: null, inputFilename: null, inputFileSize: null, processingError: "Previously selected input file not found."}));
        }
      };
      loadAndConvert();
    }
  }, [toolState.inputFileId, toolState.conversionDirection, isLoadingToolState, performConversion, getFile, setToolState]);

  const handleFileSelected = useCallback(async (files: StoredFile[]) => {
    setIsFileSelectionModalOpen(false);
    if (files.length === 0) return;
    const selectedFile = files[0];

    const oldInputFileId = toolState.inputFileId;
    const oldOutputFileId = toolState.outputFileId;

    setToolState(prevState => ({
      ...prevState,
      inputFileId: selectedFile.id,
      inputFilename: selectedFile.filename,
      inputFileSize: selectedFile.size,
      outputFileId: null,
      outputFilename: null,
      processingError: null,
    }));
    
    const filesToCleanup = [oldInputFileId, oldOutputFileId].filter(id => id && id !== selectedFile.id) as string[];
    if (filesToCleanup.length > 0) {
        cleanupOrphanedTemporaryFiles(filesToCleanup).catch(e => console.error("Error cleaning up old files:", e));
    }

    await performConversion(selectedFile, toolState.conversionDirection);
  }, [toolState.conversionDirection, toolState.inputFileId, toolState.outputFileId, setToolState, performConversion, cleanupOrphanedTemporaryFiles]);

  const handleDirectionChange = (newDirection: ConversionDirection) => {
    setToolState(prevState => ({ ...prevState, conversionDirection: newDirection, outputFileId: null, outputFilename: null, processingError: null }));
    if (toolState.inputFileId) {
      getFile(toolState.inputFileId).then(file => {
        if (file) performConversion(file, newDirection);
      });
    }
  };

  const handleClear = useCallback(async () => {
    const filesToCleanup = [toolState.inputFileId, toolState.outputFileId].filter(Boolean) as string[];
    setToolState(DEFAULT_STATE);
    converter.resetConverter();
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
    await saveStateNow(DEFAULT_STATE);
    if (filesToCleanup.length > 0) {
        cleanupOrphanedTemporaryFiles(filesToCleanup).catch(e => console.error("Error cleaning up files on clear:", e));
    }
  }, [setToolState, saveStateNow, converter, toolState.inputFileId, toolState.outputFileId, cleanupOrphanedTemporaryFiles]);

  const handleFilenameConfirm = useCallback(async (chosenFilename: string) => {
    setIsFilenamePromptModalOpen(false);
    if (!toolState.outputFileId || !filenameAction) return;

    const outputFile = await getFile(toolState.outputFileId);
    if (!outputFile || !outputFile.blob) {
      setToolState(prev => ({ ...prev, processingError: "Output file data not found." }));
      return;
    }

    let finalFilename = chosenFilename.trim();
    if (!finalFilename) finalFilename = toolState.outputFilename || 'converted_file';

    if (filenameAction === 'download') {
      const url = URL.createObjectURL(outputFile.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } else if (filenameAction === 'save') {
      try {
        await addFile(outputFile.blob, finalFilename, outputFile.type, false, toolRoute);
        setToolState(prev => ({ ...prev, outputFilename: finalFilename }));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (e) {
        setToolState(prev => ({ ...prev, processingError: `Failed to save to library: ${e instanceof Error ? e.message : String(e)}` }));
      }
    }
    setFilenameAction(null);
  }, [toolState.outputFileId, toolState.outputFilename, filenameAction, getFile, addFile, setToolState, toolRoute]);

  const initiateOutputAction = (action: 'download' | 'save') => {
    if (!toolState.outputFileId || !toolState.outputFilename) {
      setToolState(prev => ({ ...prev, processingError: "No output file available." }));
      return;
    }
    setFilenameAction(action);
    setIsFilenamePromptModalOpen(true);
  };
  
  const handleCopyToClipboard = useCallback(async () => {
    if (!toolState.outputFileId) {
      setToolState(prev => ({ ...prev, processingError: "No output file to copy." }));
      return;
    }
    const outputFile = await getFile(toolState.outputFileId);
    if (!outputFile || !outputFile.blob) {
      setToolState(prev => ({ ...prev, processingError: "Output file data not found for copying." }));
      return;
    }
    if (outputFile.type !== 'text/csv') {
        setToolState(prev => ({ ...prev, processingError: "Copy to clipboard is only available for CSV output." }));
        return;
    }
    try {
      const text = await outputFile.blob.text();
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (e) {
      setToolState(prev => ({ ...prev, processingError: `Failed to copy: ${e instanceof Error ? e.message : String(e)}` }));
    }
  }, [toolState.outputFileId, getFile, setToolState]);


  // ITDE Handling
  const handleProcessIncomingSignal = useCallback(async (signal: IncomingSignal) => {
    setToolState(prev => ({ ...prev, processingError: null }));
    const sourceMeta = getToolMetadata(signal.sourceDirective);
    if (!sourceMeta) {
      setToolState(prev => ({ ...prev, processingError: `Metadata not found for source: ${signal.sourceToolTitle}` }));
      return;
    }
    const resolvedPayload: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);
    if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
      setToolState(prev => ({ ...prev, processingError: resolvedPayload.errorMessage || 'No transferable data received.' }));
      return;
    }

    const receivedFileItem = resolvedPayload.data[0];
    const acceptedMimeTypes = metadata.inputConfig.acceptsMimeTypes;
    if (!acceptedMimeTypes.includes(receivedFileItem.type) && !receivedFileItem.type.startsWith('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') && !receivedFileItem.type.startsWith('application/vnd.ms-excel') && !receivedFileItem.type.startsWith('text/csv')) {
        setToolState(prev => ({ ...prev, processingError: `Received file type (${receivedFileItem.type}) is not supported.` }));
        return;
    }
    
    let fileToProcess: StoredFile;
    if (!('id' in receivedFileItem)) {
        try {
            const tempName = `itde-received-${Date.now()}.${receivedFileItem.type.split('/')[1] || 'dat'}`;
            const newId = await addFile(receivedFileItem.blob, tempName, receivedFileItem.type, true, toolRoute);
            const fetchedFile = await getFile(newId);
            if (!fetchedFile) throw new Error('Failed to retrieve saved InlineFile');
            fileToProcess = fetchedFile;
        } catch (e) {
            setToolState(prev => ({ ...prev, processingError: `Failed to process incoming file: ${e instanceof Error ? e.message : String(e)}` }));
            return;
        }
    } else {
        fileToProcess = receivedFileItem as StoredFile;
    }
    
    let direction: ConversionDirection = toolState.conversionDirection;
    if (fileToProcess.type === 'text/csv') {
        direction = 'csvToXlsx';
    } else if (fileToProcess.type.includes('spreadsheetml') || fileToProcess.type.includes('ms-excel')) {
        direction = 'xlsToCsv';
    }

    const oldInputFileId = toolState.inputFileId;
    const oldOutputFileId = toolState.outputFileId;
    const filesToCleanup = [oldInputFileId, oldOutputFileId].filter(id => id && id !== fileToProcess.id) as string[];
    if (filesToCleanup.length > 0) {
        cleanupOrphanedTemporaryFiles(filesToCleanup).catch(e => console.error("Error cleaning up old files on ITDE:", e));
    }

    setToolState(prevState => ({
        ...prevState,
        inputFileId: fileToProcess.id,
        inputFilename: fileToProcess.filename,
        inputFileSize: fileToProcess.size,
        outputFileId: null,
        outputFilename: null,
        conversionDirection: direction,
        processingError: null,
    }));
    await performConversion(fileToProcess, direction);
    setUserDeferredAutoPopup(false);

  }, [getToolMetadata, addFile, getFile, setToolState, performConversion, toolState.conversionDirection, toolState.inputFileId, toolState.outputFileId, cleanupOrphanedTemporaryFiles, toolRoute]);

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
        initialToolStateLoadCompleteRef.current = true;
    }
    if (initialToolStateLoadCompleteRef.current && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredAutoPopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingToolState, itdeTarget, userDeferredAutoPopup]);

  const onBeforeSendToTool = useCallback(async (): Promise<boolean> => {
    if (toolState.outputFileId) return true;
    if (toolState.inputFileId) {
      const inputFile = await getFile(toolState.inputFileId);
      if (inputFile) {
        await performConversion(inputFile, toolState.conversionDirection);
        return new Promise((resolve) => {
            const checkOutput = () => {
                if (toolState.outputFileId && !converter.isConverting) {
                    resolve(true);
                } else if (converter.conversionError || toolState.processingError) {
                    resolve(false);
                } else {
                    setTimeout(checkOutput, 100);
                }
            };
            setTimeout(checkOutput, 100);
        });
      }
    }
    setToolState(prev => ({ ...prev, processingError: "No input file to process for sending." }));
    return false;
  }, [toolState.inputFileId, toolState.outputFileId, toolState.conversionDirection, getFile, performConversion, converter.isConverting, converter.conversionError, toolState.processingError, setToolState]);


  if (isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
    return <p className="text-center p-4 italic text-[rgb(var(--color-text-muted))] animate-pulse">Loading Converter...</p>;
  }

  const currentError = toolState.processingError || converter.conversionError;
  const isLoading = converter.isConverting || isLoadingToolState;

  return (
    <div className="flex flex-col gap-5">
      {/* ... rest of the JSX remains unchanged ... */}
    </div>
  );
}
