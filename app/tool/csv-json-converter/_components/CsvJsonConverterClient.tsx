'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import RadioGroup from '../../_components/form/RadioGroup';
import Button from '../../_components/form/Button';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import { useDebouncedCallback } from 'use-debounce';
import {
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';
import importedMetadata from '../metadata.json';

type ConversionDirection = 'csvToJson' | 'jsonToCsv';

interface CsvJsonToolState {
  inputText: string;
  conversionDirection: ConversionDirection;
  outputValue: string;
  errorMsg: string;
  lastLoadedFilename?: string | null;
}

const DEFAULT_CSV_JSON_TOOL_STATE: CsvJsonToolState = {
  inputText: '',
  conversionDirection: 'csvToJson',
  outputValue: '',
  errorMsg: '',
  lastLoadedFilename: null,
};

const AUTO_PROCESS_DEBOUNCE_MS = 300;
const metadata = importedMetadata as ToolMetadata;

const directionOptions = [
  { value: 'csvToJson', label: 'CSV to JSON' },
  { value: 'jsonToCsv', label: 'JSON to CSV' },
];

interface CsvJsonConverterClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}


export default function CsvJsonConverterClient({
  urlStateParams,
  toolRoute,
}: CsvJsonConverterClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    saveStateNow,
  } = useToolState<CsvJsonToolState>(toolRoute, DEFAULT_CSV_JSON_TOOL_STATE);

  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameActionType, setFilenameActionType] = useState<'download' | 'save' | null>(null);
  const [currentOutputFilename, setCurrentOutputFilename] = useState<string | null>(null);
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialUrlLoadProcessedRef = useRef(false);
  const initialToolStateLoadCompleteRef = useRef(false);


  const { addFile: addFileToLibrary } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const directiveName = metadata.directive;

  const generateOutputFilename = useCallback((baseName?: string | null, op?: ConversionDirection): string => {
    const opToUse = op || toolState.conversionDirection;
    const base = baseName?.replace(/\.[^/.]+$/, '') || (opToUse === 'csvToJson' ? 'converted-json' : 'converted-csv');
    return `${base}.${opToUse === 'csvToJson' ? 'json' : 'csv'}`;
  }, [toolState.conversionDirection]);

  const handleProcessIncomingSignal = useCallback(async (signal: IncomingSignal) => {
    console.log(`[CSV-JSON ITDE Accept] Processing signal from: ${signal.sourceDirective}`);
    setToolState((prevState) => ({ ...prevState, errorMsg: '' }));
    setCurrentOutputFilename(null);

    const sourceMeta = getToolMetadata(signal.sourceDirective);
    if (!sourceMeta) {
      setToolState((prevState) => ({ ...prevState, errorMsg: `Metadata not found for source tool: ${signal.sourceToolTitle}` }));
      return;
    }

    const resolvedPayload: ResolvedItdeData = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);

    if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none' || !resolvedPayload.data || resolvedPayload.data.length === 0) {
      setToolState((prevState) => ({ ...prevState, errorMsg: resolvedPayload.errorMessage || 'No transferable data received from source.' }));
      return;
    }

    let newInputText = '';
    let loadedFilename = null;

    const firstItem = resolvedPayload.data[0]; // Assume only one file/data item is sent

    if (firstItem) {
      try {
        newInputText = await firstItem.blob.text();
        if ('filename' in firstItem) {
          loadedFilename = firstItem.filename;
        }
      } catch (e) {
        setToolState((prevState) => ({ ...prevState, errorMsg: `Error reading text from received data: ${e instanceof Error ? e.message : String(e)}` }));
        return;
      }
    } else {
      setToolState((prevState) => ({ ...prevState, errorMsg: 'No data received from source.' }));
      return;
    }

    setToolState(prevState => ({
      ...prevState,
      inputText: newInputText,
      lastLoadedFilename: loadedFilename,
      outputValue: '',
      errorMsg: '',
    }));
    setUserDeferredAutoPopup(false);
  }, [getToolMetadata, setToolState]);


  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingState) {
      if (!initialToolStateLoadCompleteRef.current) {
        initialToolStateLoadCompleteRef.current = true;
      }
    } else {
      if (initialToolStateLoadCompleteRef.current) {
        initialToolStateLoadCompleteRef.current = false;
      }
    }
  }, [isLoadingState]);

  useEffect(() => {
    const canProceed = !isLoadingState && initialToolStateLoadCompleteRef.current;
    if (canProceed && itdeTarget.pendingSignals.length > 0 && !itdeTarget.isModalOpen && !userDeferredAutoPopup) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingState, itdeTarget, userDeferredAutoPopup, directiveName]);


  const convertCsvToJson = (csvText: string): { json: string; error: string } => {
    try {
      const lines = csvText.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const jsonResult = [];

      for (let i = 1; i < lines.length; i++) {
        const currentline = lines[i].split(',');
        const obj: Record<string, string> = {};
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = currentline[j]?.trim() || '';
        }
        jsonResult.push(obj);
      }
      return { json: JSON.stringify(jsonResult, null, 2), error: '' };
    } catch (error) {
      return { json: '', error: `Error converting CSV to JSON: ${error instanceof Error ? error.message : String(error)}` };
    }
  };

  const convertJsonToCsv = (jsonText: string): { csv: string; error: string } => {
    try {
      const jsonArray = JSON.parse(jsonText);

      if (!Array.isArray(jsonArray)) {
        return { csv: '', error: 'JSON must be an array of objects to convert to CSV.' };
      }
      if (jsonArray.length === 0) {
        return { csv: '', error: '' };
      }

      const headers = Object.keys(jsonArray[0]);
      let csv = headers.join(',') + '\n';

      jsonArray.forEach(obj => {
        const row = headers.map(header =>
          JSON.stringify(obj[header] === null || obj[header] === undefined ? '' : obj[header])
        ).join(',');
        csv += row + '\n';
      });

      return { csv, error: '' };
    } catch (error) {
      return { csv: '', error: `Error converting JSON to CSV: ${error instanceof Error ? error.message : String(error)}` };
    }
  };


  const performConversion = useCallback(
    (text: string, direction: ConversionDirection) => {
      setIsProcessing(true);
      setToolState((prevState) => ({ ...prevState, outputValue: '', errorMsg: '' }));
      setCopySuccess(false);
      setSaveSuccess(false);
      setDownloadSuccess(false);

      if (!text.trim()) {
        setCurrentOutputFilename(null);
        setIsProcessing(false);

        if (text === '') {
          setToolState((prevState) => ({ ...prevState, outputValue: '', errorMsg: '' }));
        }
        return;
      }

      let output = '';
      let error = '';

      if (direction === 'csvToJson') {
        const result = convertCsvToJson(text);
        output = result.json;
        error = result.error;
      } else {
        const result = convertJsonToCsv(text);
        output = result.csv;
        error = result.error;
      }

      const currentFilenameForOutput = toolState.inputText === text ? toolState.lastLoadedFilename : null;
      if (currentFilenameForOutput) {
        setCurrentOutputFilename(generateOutputFilename(currentFilenameForOutput, direction));
      } else {
        setCurrentOutputFilename(null);
      }

      setToolState((prevState) => ({
        ...prevState,
        outputValue: output,
        errorMsg: error,
        conversionDirection: direction,
      }));
      setIsProcessing(false);
    },
    [
      setToolState,
      convertCsvToJson,
      convertJsonToCsv,
      toolState.inputText,
      toolState.lastLoadedFilename,
      generateOutputFilename
    ]
  );

  const debouncedProcess = useDebouncedCallback(performConversion, AUTO_PROCESS_DEBOUNCE_MS);

  useEffect(() => {
    if (isLoadingState || initialUrlLoadProcessedRef.current || !initialToolStateLoadCompleteRef.current || !urlStateParams || urlStateParams.length === 0) {
      return;
    }
    initialUrlLoadProcessedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const updates: Partial<CsvJsonToolState> = {};
    let needsUpdate = false;

    const textFromUrl = params.get('text');
    if (textFromUrl !== null && textFromUrl !== toolState.inputText) {
      updates.inputText = textFromUrl;
      updates.lastLoadedFilename = null;
      needsUpdate = true;
    }

    const directionFromUrl = params.get('direction') as ConversionDirection | null;
    if (directionFromUrl && ['csvToJson', 'jsonToCsv'].includes(directionFromUrl) && directionFromUrl !== toolState.conversionDirection) {
      updates.conversionDirection = directionFromUrl;
      needsUpdate = true;
    }

    if (needsUpdate) {
      updates.outputValue = '';
      updates.errorMsg = '';
      setToolState(prev => ({ ...prev, ...updates }));
    }
  }, [isLoadingState, urlStateParams, toolState, setToolState]);


  useEffect(() => {
    if (isLoadingState || !initialToolStateLoadCompleteRef.current || isProcessing) {
      return;
    }

    debouncedProcess(toolState.inputText, toolState.conversionDirection);
  }, [toolState.inputText, toolState.conversionDirection, isLoadingState, debouncedProcess, isProcessing]);


  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({ inputText: event.target.value, lastLoadedFilename: null });
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
  };

  const handleConversionDirectionChange = (newDirection: ConversionDirection) => {
    setToolState({ conversionDirection: newDirection });
  };

  const handleClear = useCallback(async () => {
    const newState: CsvJsonToolState = {
      ...DEFAULT_CSV_JSON_TOOL_STATE,
      conversionDirection: toolState.conversionDirection
    };
    setToolState(newState);
    await saveStateNow(newState);

    setIsProcessing(false);
    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
    setDownloadSuccess(false);
    debouncedProcess.cancel();
  }, [setToolState, saveStateNow, toolState.conversionDirection, debouncedProcess]);


  const handleCopyToClipboard = useCallback(async () => {
    if (!toolState.outputValue) {
      setToolState(prev => ({ ...prev, errorMsg: 'No output to copy.' }));
      return;
    }
    try {
      await navigator.clipboard.writeText(toolState.outputValue);
      setCopySuccess(true);
      setToolState(prev => ({ ...prev, errorMsg: '' }));
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setToolState(prev => ({ ...prev, errorMsg: 'Failed to copy to clipboard.' }));
    }
  }, [toolState, setToolState]);

  const handleFileSelectedFromModal = useCallback(async (files: StoredFile[]) => {
    setIsLoadFileModalOpen(false);
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!file || !file.blob) {
      setToolState(prev => ({ ...prev, errorMsg: `Error: File "${file.filename || 'N/A'}" has no content.` }));
      return;
    }

    try {
      const text = await file.blob.text();
      setToolState(prev => ({
        ...prev,
        inputText: text,
        lastLoadedFilename: file.filename,
        errorMsg: '',
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setToolState(prev => ({
        ...prev,
        inputText: '',
        lastLoadedFilename: null,
        outputValue: '',
        errorMsg: `Error reading file "${file.filename}": ${msg}`,
      }));
      setCurrentOutputFilename(null);
    }
  }, [setToolState]);


  const handleFilenameConfirm = useCallback(
    async (chosenFilename: string) => {
      const action = filenameActionType;
      setIsFilenameModalOpen(false);
      setFilenameActionType(null);

      if (!action || !toolState.outputValue || toolState.errorMsg) return;

      let finalFilename = chosenFilename.trim();
      if (!finalFilename) {
        finalFilename = generateOutputFilename(toolState.lastLoadedFilename, toolState.conversionDirection);
      }

      if (toolState.conversionDirection === 'csvToJson' && !/\.json$/i.test(finalFilename)) {
        finalFilename += '.json';
      } else if (toolState.conversionDirection === 'jsonToCsv' && !/\.csv$/i.test(finalFilename)) {
        finalFilename += '.csv';
      }

      setCurrentOutputFilename(finalFilename);

      if (action === 'download') {
        try {
          const blob = new Blob([toolState.outputValue], { type: toolState.conversionDirection === 'csvToJson' ? 'application/json' : 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = finalFilename;
          document.body.appendChild(link);
          link.click();
          setDownloadSuccess(true);
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setToolState(prev => ({ ...prev, errorMsg: '' }));
          setTimeout(() => setDownloadSuccess(false), 2000);
        } catch (err) {
          setToolState(prev => ({ ...prev, errorMsg: `Download error: ${err instanceof Error ? err.message : String(err)}` }));
        }
      } else if (action === 'save') {
        try {
          const blob = new Blob([toolState.outputValue], { type: toolState.conversionDirection === 'csvToJson' ? 'application/json' : 'text/csv' });
          await addFileToLibrary(blob, finalFilename, toolState.conversionDirection === 'csvToJson' ? 'application/json' : 'text/csv', false);
          setSaveSuccess(true);
          setToolState(prev => ({ ...prev, errorMsg: '' }));
          setTimeout(() => setSaveSuccess(false), 2000);
        } catch (err) {
          setToolState(prev => ({ ...prev, errorMsg: `Save error: ${err instanceof Error ? err.message : String(err)}` }));
        }
      }
    },
    [
      filenameActionType,
      toolState,
      generateOutputFilename,
      addFileToLibrary,
      setToolState
    ]
  );

  const initiateOutputAction = (action: 'download' | 'save') => {
    if (!toolState.outputValue || toolState.errorMsg) {
      return;
    }

    if (currentOutputFilename) {
      handleFilenameConfirm(currentOutputFilename);
    } else {
      const suggestedName = generateOutputFilename(toolState.lastLoadedFilename, toolState.conversionDirection);
      setSuggestedFilenameForPrompt(suggestedName);
      setFilenameActionType(action);
      setIsFilenameModalOpen(true);
    }
  };

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
    if (itdeTarget.pendingSignals.filter(s => s.sourceDirective !== sourceDirective).length === 0) setUserDeferredAutoPopup(false);
  };


  if (isLoadingState && !initialToolStateLoadCompleteRef.current && !initialUrlLoadProcessedRef.current) {
    return <p className="text-center p-4 italic text-gray-500 animate-pulse">Loading CSV/JSON Converter...</p>;
  }

  const canPerformOutputActions = toolState.outputValue.trim() !== '' && !toolState.errorMsg && !isProcessing;

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div>
        <div className="flex justify-between items-center gap-2">
          <label htmlFor="csv-json-input" className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
            Input {toolState.conversionDirection === 'csvToJson' ? 'CSV' : 'JSON'}:
            {toolState.lastLoadedFilename && (
              <span className="ml-2 text-xs italic">
                ({toolState.lastLoadedFilename})
              </span>
            )}
          </label>
          <div className="flex items-center gap-2 mb-2">
            <ReceiveItdeDataTrigger
              hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
              pendingSignalCount={itdeTarget.pendingSignals.length}
              onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
            />
            <Button variant="neutral-outline" onClick={() => setIsLoadFileModalOpen(true)} iconLeft={<ArrowUpTrayIcon className="h-5 w-5" />} disabled={isProcessing}>
              Load from File
            </Button>
          </div>
        </div>
        <Textarea
          id="csv-json-input"
          label={`Input ${toolState.conversionDirection === 'csvToJson' ? 'CSV' : 'JSON'} Data`}
          labelClassName="sr-only"
          rows={8}
          value={toolState.inputText}
          onChange={handleInputChange}
          placeholder={toolState.conversionDirection === 'csvToJson' ? 'Paste your CSV data here...' : 'Paste your JSON data here...'}
          textareaClassName="text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
          spellCheck="false"
          disabled={isProcessing}
        />
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-center p-3 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <RadioGroup
          name="conversionDirection"
          legend="Conversion Direction:"
          options={directionOptions}
          selectedValue={toolState.conversionDirection}
          onChange={handleConversionDirectionChange}
          layout="horizontal"
          radioClassName="text-sm"
          labelClassName="font-medium"
          disabled={isProcessing}
        />
        <div className="flex-grow"></div> {/* This pushes the buttons to the right */}
        <OutputActionButtons
          canPerform={canPerformOutputActions}
          isSaveSuccess={saveSuccess}
          isCopySuccess={copySuccess}
          isDownloadSuccess={downloadSuccess}
          onInitiateSave={() => initiateOutputAction('save')}
          onInitiateDownload={() => initiateOutputAction('download')}
          onCopy={handleCopyToClipboard}
          onClear={handleClear}
          directiveName={directiveName}
          outputConfig={metadata.outputConfig}
        />
      </div>

      {toolState.errorMsg && (
        <div role="alert" className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm flex items-start gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong className="font-semibold">Error:</strong> {toolState.errorMsg}
          </div>
        </div>
      )}

      <Textarea
        label="Output:"
        id="csv-json-output"
        rows={8}
        value={isProcessing && !toolState.outputValue && !toolState.errorMsg ? 'Processing...' : toolState.outputValue}
        readOnly
        placeholder="Result will appear here..."
        textareaClassName={`text-base font-mono bg-[rgb(var(--color-bg-subtle))] ${isProcessing && !toolState.outputValue && !toolState.errorMsg ? 'animate-pulse' : ''
          }`}
        spellCheck="false"
        aria-live="polite"
        onClick={(e) => e.currentTarget.select()}
      />

      <FileSelectionModal
        isOpen={isLoadFileModalOpen}
        onClose={() => setIsLoadFileModalOpen(false)}
        onFilesSelected={handleFileSelectedFromModal}
        slurpContentOnly={true}
        mode="selectExistingOrUploadNew"
        accept=".csv,.json,text/*"
        selectionMode="single"
        initialTab="upload"
      />
      <FilenamePromptModal
        isOpen={isFilenameModalOpen}
        onClose={() => {
          setIsFilenameModalOpen(false);
          setFilenameActionType(null);
        }}
        onConfirm={handleFilenameConfirm}
        initialFilename={suggestedFilenameForPrompt}
        title={filenameActionType === 'download' ? 'Enter Download Filename' : 'Enter Filename for Library'}
        filenameAction={filenameActionType || 'download'}
        promptMessage={filenameActionType === 'download' ? 'Please enter a filename for the download:' : 'Please enter a filename to save to the library:'}
        confirmButtonText={filenameActionType === 'download' ? 'Download' : 'Save to Library'}
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