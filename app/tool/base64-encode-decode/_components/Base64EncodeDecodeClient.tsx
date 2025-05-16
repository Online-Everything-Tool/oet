// FILE: app/tool/base64-encode-decode/_components/Base64EncodeDecodeClient.tsx
'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import RadioGroup from '../../_components/form/RadioGroup';
import FileSelectionModal from '../../_components/shared/FileSelectionModal';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type {
  ParamConfig,
  ToolMetadata,
  OutputConfig,
} from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';
import { useDebouncedCallback } from 'use-debounce';
import {
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  DocumentPlusIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, {
  IncomingSignal,
} from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import SendToToolButton from '../../_components/shared/SendToToolButton';
import importedMetadata from '../metadata.json';

type Operation = 'encode' | 'decode';
type Base64Likelihood =
  | 'unknown'
  | 'likely_base64'
  | 'possibly_base64_or_text'
  | 'likely_text'
  | 'invalid_base64_chars';

interface Base64ToolState {
  inputText: string;
  operation: Operation;
  outputValue: string;
  lastLoadedFilename?: string | null;
}

const DEFAULT_BASE64_TOOL_STATE: Base64ToolState = {
  inputText: '',
  operation: 'encode',
  outputValue: '',
  lastLoadedFilename: null,
};

const AUTO_PROCESS_DEBOUNCE_MS = 300;
const metadata: ToolMetadata = importedMetadata as ToolMetadata;

interface Base64EncodeDecodeClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

const determineInitialOperationAndLikelihood = (
  text: string
): { operation: Operation; likelihood: Base64Likelihood } => {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return { operation: 'encode', likelihood: 'unknown' };
  }
  const cleanedForTest = trimmedText.replace(/\s/g, '');
  const strictBase64FormatWithPaddingRegex = /^[A-Za-z0-9+/]*={0,2}$/;

  if (
    strictBase64FormatWithPaddingRegex.test(cleanedForTest) &&
    cleanedForTest.length % 4 === 0
  ) {
    try {
      atob(cleanedForTest);
      return { operation: 'decode', likelihood: 'likely_base64' };
    } catch (_e) {
      return { operation: 'encode', likelihood: 'likely_text' };
    }
  }
  return { operation: 'encode', likelihood: 'likely_text' };
};

const calculateLikelihoodForCurrentOperation = (
  text: string,
  currentOperation: Operation
): Base64Likelihood => {
  const trimmedText = text.trim();
  if (!trimmedText) return 'unknown';
  const cleanedForTest = trimmedText.replace(/\s/g, '');

  const base64CharsOnlyStrictRegex = /^[A-Za-z0-9+/]*$/;
  const strictBase64FormatWithPaddingRegex = /^[A-Za-z0-9+/]*={0,2}$/;

  if (currentOperation === 'decode') {
    if (
      !strictBase64FormatWithPaddingRegex.test(cleanedForTest) ||
      cleanedForTest.length % 4 !== 0
    ) {
      return 'invalid_base64_chars';
    }
    try {
      atob(cleanedForTest);
      return 'likely_base64';
    } catch (_e) {
      return 'invalid_base64_chars';
    }
  } else {
    if (!base64CharsOnlyStrictRegex.test(cleanedForTest.replace(/=/g, ''))) {
      return 'likely_text';
    }
    return 'possibly_base64_or_text';
  }
};

interface OutputActionButtonsProps {
  canPerform: boolean;
  isSaveSuccess: boolean;
  isCopySuccess: boolean;
  onInitiateSave: () => void;
  onInitiateDownload: () => void;
  onCopy: () => void;
  directiveName: string;
  outputConfig: OutputConfig;
}

const OutputActionButtons = React.memo(function OutputActionButtons({
  canPerform,
  isSaveSuccess,
  isCopySuccess,
  onInitiateSave,
  onInitiateDownload,
  onCopy,
  directiveName,
  outputConfig,
}: OutputActionButtonsProps) {
  if (!canPerform) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-3 items-center p-3 border-y border-[rgb(var(--color-border-base))]">
      <SendToToolButton
        currentToolDirective={directiveName}
        currentToolOutputConfig={outputConfig}
        buttonText="Send Output To..."
      />
      <Button
        variant="primary-outline"
        onClick={onInitiateSave}
        disabled={isSaveSuccess}
        iconLeft={
          isSaveSuccess ? (
            <CheckIcon className="h-5 w-5" />
          ) : (
            <DocumentPlusIcon className="h-5 w-5" />
          )
        }
      >
        {isSaveSuccess ? 'Saved!' : 'Save to Library'}
      </Button>
      <Button
        variant="secondary"
        onClick={onInitiateDownload}
        iconLeft={<ArrowDownTrayIcon className="h-5 w-5" />}
      >
        Download Output
      </Button>
      <Button
        variant="neutral"
        onClick={onCopy}
        disabled={isCopySuccess}
        iconLeft={
          isCopySuccess ? (
            <CheckIcon className="h-5 w-5" />
          ) : (
            <ClipboardDocumentIcon className="h-5 w-5" />
          )
        }
      >
        {isCopySuccess ? 'Copied!' : 'Copy Output'}
      </Button>
    </div>
  );
});

export default function Base64EncodeDecodeClient({
  urlStateParams,
  toolRoute,
}: Base64EncodeDecodeClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState: isLoadingToolState,
    clearStateAndPersist,
    saveStateNow,
  } = useToolState<Base64ToolState>(toolRoute, DEFAULT_BASE64_TOOL_STATE);

  const [uiError, setUiError] = useState<string>('');
  const [base64Likelihood, setBase64Likelihood] =
    useState<Base64Likelihood>('unknown');
  const [isLoadFileModalOpen, setIsLoadFileModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [filenameAction, setFilenameAction] = useState<
    'download' | 'save' | null
  >(null);
  const [currentOutputFilename, setCurrentOutputFilename] = useState<
    string | null
  >(null);
  const [suggestedFilenameForPrompt, setSuggestedFilenameForPrompt] =
    useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);

  const { addFile: addFileToLibrary } = useFileLibrary();
  const { getToolMetadata } = useMetadata();

  const directiveName = useMemo(
    () => toolRoute.split('/').pop() || 'base64-encode-decode',
    [toolRoute]
  );

  const operationOptions = useMemo(
    () => [
      { value: 'encode' as Operation, label: 'Encode' },
      { value: 'decode' as Operation, label: 'Decode' },
    ],
    []
  );

  const generateOutputFilename = useCallback(
    (baseName?: string | null, chosenOperation?: Operation): string => {
      const op = chosenOperation || toolState.operation;
      const base =
        baseName?.replace(/\.[^/.]+$/, '') ||
        (op === 'encode' ? 'encoded-text' : 'decoded-text');
      const mainExtension = op === 'encode' ? '.b64' : '';
      return `${base}${mainExtension}.txt`;
    },
    [toolState.operation]
  );

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      console.log(
        `[Base64 ITDE Accept] Processing signal from: ${signal.sourceDirective}`
      );
      setUiError('');
      setCurrentOutputFilename(null);
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) {
        setUiError(
          `Metadata not found for source tool: ${signal.sourceToolTitle}`
        );
        return;
      }

      const resolvedPayload = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );

      if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none') {
        setUiError(
          resolvedPayload.errorMessage ||
            'No transferable data received from source.'
        );
        return;
      }

      let newText = '';

      if (
        resolvedPayload.type === 'text' &&
        typeof resolvedPayload.data === 'string'
      ) {
        newText = resolvedPayload.data;
      } else if (
        resolvedPayload.type === 'fileReference' &&
        resolvedPayload.data
      ) {
        const fileData = resolvedPayload.data as StoredFile;
        if (fileData.type?.startsWith('text/')) {
          try {
            newText = await fileData.blob.text();
          } catch (_e) {
            setUiError(
              `Error reading text from received file: ${fileData.name}`
            );
            return;
          }
        } else {
          setUiError(`Received file '${fileData.name}' is not a text file.`);
          return;
        }
      } else {
        setUiError(
          `Received unhandled data type '${resolvedPayload.type}' from ${signal.sourceToolTitle}.`
        );
        return;
      }

      const {
        operation: determinedOpFromText,
        likelihood: determinedLikelihoodFromText,
      } = determineInitialOperationAndLikelihood(newText);

      const newState: Base64ToolState = {
        inputText: newText,
        operation: determinedOpFromText,
        outputValue: '',
        lastLoadedFilename: null,
      };
      setToolState(newState);
      await saveStateNow(newState);
      setBase64Likelihood(determinedLikelihoodFromText);
      setUserDeferredAutoPopup(false);
    },
    [getToolMetadata, setToolState, saveStateNow]
  );

  const itdeTarget = useItdeTargetHandler({
    targetToolDirective: directiveName,
    onProcessSignal: handleProcessIncomingSignal,
  });

  useEffect(() => {
    if (!isLoadingToolState) {
      if (!initialToolStateLoadCompleteRef.current) {
        initialToolStateLoadCompleteRef.current = true;
      }
    } else {
      if (initialToolStateLoadCompleteRef.current) {
        initialToolStateLoadCompleteRef.current = false;
      }
    }
  }, [isLoadingToolState]);

  useEffect(() => {
    const canProceed =
      !isLoadingToolState && initialToolStateLoadCompleteRef.current;
    if (
      canProceed &&
      itdeTarget.pendingSignals.length > 0 &&
      !itdeTarget.isModalOpen &&
      !userDeferredAutoPopup
    ) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingToolState, itdeTarget, userDeferredAutoPopup, directiveName]);

  const handleEncodeDecode = useCallback(
    (
      textToProcess = toolState.inputText,
      opToPerform = toolState.operation
    ) => {
      let currentOutput = '';
      let currentError = '';
      let finalOperationForState = opToPerform;
      let finalLikelihoodForUIUpdate = base64Likelihood;

      const trimmedTextToProcess = textToProcess.trim();

      if (!trimmedTextToProcess) {
        setToolState({ outputValue: '' });
        setCurrentOutputFilename(null);
        if (uiError) setUiError('');
        return;
      }

      if (opToPerform === 'encode') {
        try {
          currentOutput = btoa(
            unescape(encodeURIComponent(trimmedTextToProcess))
          );
          finalLikelihoodForUIUpdate = calculateLikelihoodForCurrentOperation(
            textToProcess,
            'encode'
          );
          if (uiError) setUiError('');
        } catch (_err) {
          currentError = 'Failed to encode text. Ensure text is valid UTF-8.';
          finalLikelihoodForUIUpdate = calculateLikelihoodForCurrentOperation(
            textToProcess,
            'encode'
          );
        }
      } else {
        try {
          const cleanedTextToDecode = trimmedTextToProcess.replace(/\s/g, '');
          if (
            cleanedTextToDecode.length % 4 !== 0 ||
            !/^[A-Za-z0-9+/]*={0,2}$/.test(cleanedTextToDecode)
          ) {
            throw new DOMException(
              'Input is not valid Base64 (length or padding).',
              'InvalidCharacterError'
            );
          }
          const decodedBytes = atob(cleanedTextToDecode);
          currentOutput = decodeURIComponent(
            Array.from(decodedBytes)
              .map((byte) => ('0' + byte.charCodeAt(0).toString(16)).slice(-2))
              .join('%')
          );
          finalLikelihoodForUIUpdate = 'likely_base64';
          if (uiError) setUiError('');
        } catch (err) {
          const errMessage =
            err instanceof Error ? err.message : 'Unknown decode error';
          if (
            err instanceof DOMException &&
            err.name === 'InvalidCharacterError'
          ) {
            currentError = `Failed to decode: Input is not a valid Base64 string or contains invalid characters/padding. (${errMessage})`;
          } else {
            currentError = `An unexpected error occurred during decoding. (${errMessage})`;
          }
          finalOperationForState = 'encode';
          finalLikelihoodForUIUpdate = calculateLikelihoodForCurrentOperation(
            textToProcess,
            'encode'
          );
        }
      }

      if (currentError) {
        if (uiError !== currentError) setUiError(currentError);
        setToolState({ outputValue: '', operation: finalOperationForState });
        setCurrentOutputFilename(null);
      } else {
        if (uiError) setUiError('');
        setToolState({
          outputValue: currentOutput,
          operation: finalOperationForState,
        });

        if (toolState.lastLoadedFilename && !currentOutputFilename) {
          setCurrentOutputFilename(
            generateOutputFilename(toolState.lastLoadedFilename)
          );
        }
      }

      if (finalLikelihoodForUIUpdate !== base64Likelihood) {
        setBase64Likelihood(finalLikelihoodForUIUpdate);
      }
    },
    [
      setToolState,
      base64Likelihood,
      uiError,
      toolState.inputText,
      toolState.operation,
      toolState.lastLoadedFilename,
      currentOutputFilename,
      generateOutputFilename,
    ]
  );

  const debouncedProcess = useDebouncedCallback(
    handleEncodeDecode,
    AUTO_PROCESS_DEBOUNCE_MS
  );

  useEffect(() => {
    if (
      isLoadingToolState ||
      !initialToolStateLoadCompleteRef.current ||
      !urlStateParams ||
      urlStateParams.length === 0
    ) {
      if (
        !isLoadingToolState &&
        initialToolStateLoadCompleteRef.current &&
        toolState.inputText.trim() &&
        !toolState.outputValue.trim() &&
        !uiError
      ) {
        debouncedProcess(toolState.inputText, toolState.operation);
      }
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const textFromUrl = params.get('text');
    const opFromUrlExplicit = params.get('operation') as Operation | null;

    let textToSetForState = toolState.inputText;
    let opToSetForState = toolState.operation;
    let filenameToSetForState = toolState.lastLoadedFilename;
    let outputFilenameToSetForState = currentOutputFilename;
    let uiLikelihoodToSetInitially = base64Likelihood;
    let needsToolStateUpdate = false;

    if (textFromUrl !== null) {
      textToSetForState = textFromUrl;
      filenameToSetForState = null;
      outputFilenameToSetForState = null;
      needsToolStateUpdate = true;

      const {
        operation: determinedOpFromText,
        likelihood: determinedLikelihoodFromText,
      } = determineInitialOperationAndLikelihood(textToSetForState);
      opToSetForState = determinedOpFromText;
      uiLikelihoodToSetInitially = determinedLikelihoodFromText;
    }

    if (opFromUrlExplicit && ['encode', 'decode'].includes(opFromUrlExplicit)) {
      if (opFromUrlExplicit !== opToSetForState) {
        opToSetForState = opFromUrlExplicit;
        outputFilenameToSetForState = null;
        needsToolStateUpdate = true;
      }
      uiLikelihoodToSetInitially = calculateLikelihoodForCurrentOperation(
        textToSetForState,
        opToSetForState
      );
    }

    const updates: Partial<Base64ToolState> = {};
    if (textToSetForState !== toolState.inputText)
      updates.inputText = textToSetForState;
    if (opToSetForState !== toolState.operation)
      updates.operation = opToSetForState;
    if (filenameToSetForState !== toolState.lastLoadedFilename)
      updates.lastLoadedFilename = filenameToSetForState;

    if (Object.keys(updates).length > 0) {
      updates.outputValue = '';
      setToolState(updates);
    }
    if (outputFilenameToSetForState !== currentOutputFilename) {
      setCurrentOutputFilename(outputFilenameToSetForState);
    }

    if (uiLikelihoodToSetInitially !== base64Likelihood) {
      setBase64Likelihood(uiLikelihoodToSetInitially);
    }

    if (
      !needsToolStateUpdate &&
      textToSetForState.trim() &&
      !toolState.outputValue.trim() &&
      !uiError
    ) {
      const currentContextLikelihood = calculateLikelihoodForCurrentOperation(
        textToSetForState,
        opToSetForState
      );
      if (currentContextLikelihood !== base64Likelihood)
        setBase64Likelihood(currentContextLikelihood);

      handleEncodeDecode(textToSetForState, opToSetForState);
    } else if (!textToSetForState.trim() && base64Likelihood !== 'unknown') {
      setBase64Likelihood('unknown');
    }
  }, [
    isLoadingToolState,
    urlStateParams,
    base64Likelihood,
    uiError,
    handleEncodeDecode,
    setToolState,
    toolState.inputText,
    toolState.lastLoadedFilename,
    toolState.operation,
    toolState.outputValue,
    debouncedProcess,
    currentOutputFilename,
  ]);

  useEffect(() => {
    if (isLoadingToolState || !initialToolStateLoadCompleteRef.current) {
      return;
    }

    const text = toolState.inputText;
    const currentOperation = toolState.operation;

    const newUILikelihood = calculateLikelihoodForCurrentOperation(
      text,
      currentOperation
    );
    if (newUILikelihood !== base64Likelihood) {
      setBase64Likelihood(newUILikelihood);
    }

    if (!text.trim()) {
      if (toolState.outputValue !== '') setToolState({ outputValue: '' });
      if (currentOutputFilename !== null) setCurrentOutputFilename(null);
      if (uiError !== '') setUiError('');
      debouncedProcess.cancel();
      return;
    }

    debouncedProcess(text, currentOperation);
  }, [
    toolState.inputText,
    toolState.operation,
    isLoadingToolState,
    debouncedProcess,
    setToolState,
    base64Likelihood,
    uiError,
    toolState.outputValue,
    currentOutputFilename,
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setToolState({
      inputText: newText,
      lastLoadedFilename: null,
      outputValue: '',
    });
    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
  };

  const handleOperationChange = (newOperation: Operation) => {
    setToolState({ operation: newOperation, outputValue: '' });
    setCurrentOutputFilename(null);
  };

  const handleClear = useCallback(async () => {
    await clearStateAndPersist();
    setUiError('');
    setBase64Likelihood('unknown');
    setCurrentOutputFilename(null);
    setCopySuccess(false);
    setSaveSuccess(false);
    debouncedProcess.cancel();
    setUserDeferredAutoPopup(false);
  }, [clearStateAndPersist, debouncedProcess]);

  const handleFileSelectedFromModal = useCallback(
    async (files: StoredFile[]) => {
      setIsLoadFileModalOpen(false);
      if (files.length === 0) return;

      const file = files[0];
      if (!file.blob) {
        setUiError(`Error: File "${file.name}" has no content.`);
        return;
      }
      try {
        const text = await file.blob.text();
        const { operation: determinedOp, likelihood: determinedLikelihood } =
          determineInitialOperationAndLikelihood(text);

        let outputForState = '';
        let errorForUI = '';

        if (determinedOp === 'decode') {
          try {
            const cleanedTextToDecode = text.trim().replace(/\s/g, '');
            if (
              cleanedTextToDecode.length % 4 !== 0 ||
              !/^[A-Za-z0-9+/]*={0,2}$/.test(cleanedTextToDecode)
            ) {
              throw new DOMException(
                'Input is not valid Base64 (length or padding).',
                'InvalidCharacterError'
              );
            }
            const decodedBytes = atob(cleanedTextToDecode);
            outputForState = decodeURIComponent(
              Array.from(decodedBytes)
                .map((byte) =>
                  ('0' + byte.charCodeAt(0).toString(16)).slice(-2)
                )
                .join('%')
            );
          } catch (decodeError) {
            errorForUI =
              decodeError instanceof Error &&
              decodeError.name === 'InvalidCharacterError'
                ? 'Failed to decode: Input is not a valid Base64 string. Will try to Encode.'
                : 'Decode attempt failed. Will try to Encode.';
          }
        }

        setToolState({
          inputText: text,
          lastLoadedFilename: file.name,
          operation: errorForUI ? 'encode' : determinedOp,
          outputValue: errorForUI ? '' : outputForState,
        });
        setBase64Likelihood(
          errorForUI
            ? calculateLikelihoodForCurrentOperation(text, 'encode')
            : determinedLikelihood
        );
        setCurrentOutputFilename(generateOutputFilename(file.name));
        setUiError(errorForUI);
        setUserDeferredAutoPopup(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setUiError(`Error reading file "${file.name}": ${msg}`);
        setToolState({
          inputText: '',
          lastLoadedFilename: null,
          outputValue: '',
        });
        setBase64Likelihood('unknown');
        setCurrentOutputFilename(null);
      }
    },
    [setToolState, generateOutputFilename]
  );

  const handleFilenameConfirm = useCallback(
    (filename: string, actionOverride?: 'download' | 'save') => {
      setIsFilenameModalOpen(false);
      const currentAction = actionOverride || filenameAction;
      if (!currentAction) return;

      let finalFilename = filename.trim();
      if (!finalFilename) {
        finalFilename = generateOutputFilename(
          toolState.lastLoadedFilename,
          toolState.operation
        );
      }
      if (!/\.(txt|b64|text|json)$/i.test(finalFilename)) {
        finalFilename += toolState.operation === 'encode' ? '.b64.txt' : '.txt';
      }

      setCurrentOutputFilename(finalFilename);

      if (currentAction === 'download') {
        if (!toolState.outputValue) {
          setUiError('No output to download.');
          return;
        }
        try {
          const blob = new Blob([toolState.outputValue], {
            type: 'text/plain;charset=utf-8',
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = finalFilename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setUiError('');
        } catch (err) {
          setUiError(
            `Failed to prepare download: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
      } else if (currentAction === 'save') {
        if (!toolState.outputValue) {
          setUiError('No output to save.');
          return;
        }
        const blob = new Blob([toolState.outputValue], {
          type: 'text/plain;charset=utf-8',
        });
        addFileToLibrary(blob, finalFilename, 'text/plain', false)
          .then(() => {
            setSaveSuccess(true);
            setUiError('');
            setTimeout(() => setSaveSuccess(false), 2000);
          })
          .catch((err) =>
            setUiError(
              `Failed to save to library: ${err instanceof Error ? err.message : 'Unknown error'}`
            )
          );
      }
      setFilenameAction(null);
    },
    [
      filenameAction,
      toolState.lastLoadedFilename,
      toolState.operation,
      toolState.outputValue,
      addFileToLibrary,
      generateOutputFilename,
    ]
  );

  const initiateOutputAction = useCallback(
    (action: 'download' | 'save') => {
      if (!toolState.outputValue.trim()) {
        setUiError('No output to ' + action + '.');
        return;
      }
      if (uiError && toolState.outputValue.trim()) {
        setUiError(
          'Cannot ' + action + ' output due to existing input errors.'
        );
        return;
      }

      if (currentOutputFilename) {
        handleFilenameConfirm(currentOutputFilename, action);
      } else {
        setSuggestedFilenameForPrompt(
          generateOutputFilename(toolState.lastLoadedFilename)
        );
        setFilenameAction(action);
        setIsFilenameModalOpen(true);
      }
    },
    [
      currentOutputFilename,
      handleFilenameConfirm,
      toolState.outputValue,
      uiError,
      toolState.lastLoadedFilename,
      generateOutputFilename,
    ]
  );

  const handleCopyToClipboard = useCallback(async () => {
    if (!toolState.outputValue) {
      setUiError('No output to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(toolState.outputValue);
      setCopySuccess(true);
      setUiError('');
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (_err) {
      setUiError('Failed to copy to clipboard.');
    }
  }, [toolState.outputValue]);

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
    const remainingSignalsAfterIgnore = itdeTarget.pendingSignals.filter(
      (s) => s.sourceDirective !== sourceDirective
    );
    if (remainingSignalsAfterIgnore.length === 0) {
      setUserDeferredAutoPopup(false);
    }
  };

  const getLikelihoodBarState = useCallback(() => {
    switch (base64Likelihood) {
      case 'likely_base64':
        return {
          text: 'Input: Likely Base64 (Ready to Decode)',
          bgColor: 'bg-green-500',
          label: 'Base64',
          valueNow: 100,
        };
      case 'possibly_base64_or_text':
        return {
          text: `Input: ${toolState.operation === 'encode' ? 'Valid for Encode (may also be decodable Base64)' : 'Potentially Base64 (ambiguous for decode)'}`,
          bgColor: 'bg-[rgb(var(--color-indicator-ambiguous))]',
          label: 'Ambiguous',
          valueNow: 50,
        };
      case 'likely_text':
        return {
          text: 'Input: Likely Plain Text (Ready to Encode)',
          bgColor: 'bg-[rgb(var(--color-indicator-text))]',
          label: 'Text',
          valueNow: 10,
        };
      case 'invalid_base64_chars':
        return {
          text: `Input: Contains characters invalid for Base64 ${toolState.operation === 'decode' ? '(Decode will fail)' : '(Encode might work if invalid char is e.g. space that gets trimmed)'}`,
          bgColor: 'bg-[rgb(var(--color-text-error))]',
          label: 'Invalid Chars',
          valueNow: 80,
        };
      case 'unknown':
      default:
        return {
          text: 'Enter text to analyze format',
          bgColor: 'bg-[rgb(var(--color-indicator-base))]',
          label: 'Unknown',
          valueNow: 0,
        };
    }
  }, [base64Likelihood, toolState.operation]);

  const {
    text: likelihoodText,
    bgColor,
    label: likelihoodLabel,
    valueNow,
  } = getLikelihoodBarState();

  if (isLoadingToolState && !initialToolStateLoadCompleteRef.current) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Base64 Tool...
      </p>
    );
  }
  const canPerformOutputActions =
    toolState.outputValue.trim() !== '' && !uiError;

  return (
    <div className="flex flex-col gap-5 text-[rgb(var(--color-text-base))]">
      <div className="flex justify-between items-center gap-2">
        <label className="block text-sm font-medium text-[rgb(var(--color-text-muted))]">
          Input:
          {toolState.lastLoadedFilename && (
            <span className="ml-2 text-xs italic">
              ({toolState.lastLoadedFilename})
            </span>
          )}
        </label>
        <div className="flex items-center gap-2">
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
            variant="neutral-outline"
            size="sm"
            onClick={() => setIsLoadFileModalOpen(true)}
            iconLeft={<ArrowUpTrayIcon className="h-4 w-4" />}
          >
            Load from File
          </Button>
        </div>
      </div>
      <Textarea
        id="base64-input"
        rows={8}
        value={toolState.inputText}
        onChange={handleInputChange}
        placeholder="Paste text or Base64 string here..."
        textareaClassName="text-base font-mono placeholder:text-[rgb(var(--color-input-placeholder))]"
        spellCheck="false"
        aria-describedby="format-indicator"
      />
      <div
        className="relative h-3 -mt-4 bg-[rgb(var(--color-indicator-track-bg))] rounded-full overflow-hidden"
        title={`Input Format Likelihood: ${likelihoodLabel}`}
      >
        <div
          className={`absolute inset-y-0 left-0 ${bgColor} rounded-full transition-all duration-300 ease-in-out`}
          style={{ width: `${valueNow}%` }}
          role="progressbar"
          aria-label={`Input Format Likelihood: ${likelihoodLabel}`}
          aria-valuenow={valueNow}
          aria-valuemin={0}
          aria-valuemax={100}
        ></div>
      </div>
      <p
        className="text-xs text-[rgb(var(--color-text-muted))] -mt-3 h-4"
        id="format-indicator"
        aria-live="polite"
      >
        {likelihoodText}
      </p>
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-center p-3 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
        <RadioGroup
          name="base64Operation"
          legend="Operation:"
          options={operationOptions}
          selectedValue={toolState.operation}
          onChange={handleOperationChange}
          layout="horizontal"
          radioClassName="text-sm"
          labelClassName="font-medium"
        />
        <div className="flex-grow"></div>
        <Button
          variant="neutral"
          onClick={handleClear}
          title="Clear input and output"
          className="sm:ml-auto"
        >
          Clear
        </Button>
      </div>

      <OutputActionButtons
        canPerform={canPerformOutputActions}
        isSaveSuccess={saveSuccess}
        isCopySuccess={copySuccess}
        onInitiateSave={() => initiateOutputAction('save')}
        onInitiateDownload={() => initiateOutputAction('download')}
        onCopy={handleCopyToClipboard}
        directiveName={directiveName}
        outputConfig={metadata.outputConfig as OutputConfig}
      />

      {uiError && (
        <div
          role="alert"
          className="p-3 bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] rounded-md text-sm flex items-start gap-2"
        >
          <ExclamationTriangleIcon
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <strong className="font-semibold">Error:</strong> {uiError}
          </div>
        </div>
      )}
      <Textarea
        label="Output:"
        id="base64-output"
        rows={8}
        value={toolState.outputValue}
        readOnly
        placeholder="Result will appear here..."
        textareaClassName="text-base font-mono bg-[rgb(var(--color-bg-subtle))]"
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
        accept=".txt,text/*,.b64"
        selectionMode="single"
        libraryFilter={{ category: 'text' }}
        initialTab="upload"
      />
      <FilenamePromptModal
        isOpen={isFilenameModalOpen}
        onClose={() => setIsFilenameModalOpen(false)}
        onConfirm={handleFilenameConfirm}
        initialFilename={suggestedFilenameForPrompt}
        title={
          filenameAction === 'download'
            ? 'Enter Download Filename'
            : 'Enter Filename for Library'
        }
        promptMessage={
          filenameAction === 'download'
            ? 'Please enter a filename for the download:'
            : 'Please enter a filename to save to the library:'
        }
        confirmButtonText={
          filenameAction === 'download' ? 'Download' : 'Save to Library'
        }
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
