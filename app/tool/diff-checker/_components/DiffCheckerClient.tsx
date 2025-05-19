'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import DiffViewer from 'react-diff-viewer';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import { useItdeTargetHandler, IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { useMetadata } from '@/app/context/MetadataContext';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import importedMetadata from '../metadata.json';
import type { ToolMetadata } from '@/src/types/tools';
import type { StoredFile } from '@/src/types/storage';

interface DiffCheckerToolState {
  text1: string;
  text2: string;
}

const DEFAULT_DIFF_CHECKER_STATE: DiffCheckerToolState = {
  text1: '',
  text2: '',
};

const metadata = importedMetadata as ToolMetadata;

interface DiffCheckerClientProps {
  toolRoute: string;
}

export default function DiffCheckerClient({ toolRoute }: DiffCheckerClientProps) {
  const {
    state: toolState,
    setState: setToolState,
    isLoadingState,
    saveStateNow
  } = useToolState<DiffCheckerToolState>(toolRoute, DEFAULT_DIFF_CHECKER_STATE);

  const [userDeferredAutoPopup, setUserDeferredAutoPopup] = useState(false);
  const initialToolStateLoadCompleteRef = useRef(false);
  const { getToolMetadata } = useMetadata();
  const directiveName = metadata.directive;

  const handleProcessIncomingSignal = useCallback(
    async (signal: IncomingSignal) => {
      const sourceMeta = getToolMetadata(signal.sourceDirective);
      if (!sourceMeta) return;

      const resolvedPayload: ResolvedItdeData = await resolveItdeData(
        signal.sourceDirective,
        sourceMeta.outputConfig
      );

      if (resolvedPayload.type === 'error' || resolvedPayload.type === 'none' || !resolvedPayload.data) {
        return;
      }

      const firstItem: StoredFile | undefined = resolvedPayload.data[0] as StoredFile;

      if (firstItem && firstItem.type.startsWith('text/')) {
        try {
          const textContent = await firstItem.blob.text();
          setToolState((prev) => ({
            ...prev,
            text1: prev.text1 === '' ? textContent : prev.text1,
            text2: prev.text2 === '' ? textContent : prev.text2
          }));
          await saveStateNow();
        } catch (error) {
          console.error('Error reading incoming text data:', error);
        }
      }
      setUserDeferredAutoPopup(false);
    },
    [getToolMetadata, setToolState, saveStateNow, toolState]
  );

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
    if (
      canProceed &&
      itdeTarget.pendingSignals.length > 0 &&
      !itdeTarget.isModalOpen &&
      !userDeferredAutoPopup
    ) {
      itdeTarget.openModalIfSignalsExist();
    }
  }, [isLoadingState, itdeTarget, userDeferredAutoPopup, directiveName]);

  const handleText1Change = useCallback((e) => {
    setToolState({ text1: e.target.value });
  }, [setToolState]);

  const handleText2Change = useCallback((e) => {
    setToolState({ text2: e.target.value });
  }, [setToolState]);

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
    if (
      itdeTarget.pendingSignals.filter((s) => s.sourceDirective !== sourceDirective).length === 0
    )
      setUserDeferredAutoPopup(false);
  };

  if (isLoadingState && !initialToolStateLoadCompleteRef.current) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Diff Checker...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Textarea
          label="Text 1"
          value={toolState.text1}
          onChange={handleText1Change}
          placeholder="Enter the first text here."
        />
        <ReceiveItdeDataTrigger
          hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
          pendingSignalCount={itdeTarget.pendingSignals.length}
          onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
        />
      </div>
      <Textarea
        label="Text 2"
        value={toolState.text2}
        onChange={handleText2Change}
        placeholder="Enter the second text here."
      />
      <DiffViewer
        oldValue={toolState.text1}
        newValue={toolState.text2}
        splitView={false}
        hideLineNumbers={true}
        showDiffOnly={false}
        styles={{
          diffContainer: { wordWrap: 'break-word', whiteSpace: 'pre-wrap' },
          line: { whiteSpace: 'pre-wrap' }
        }}
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