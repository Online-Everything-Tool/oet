'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import DiffViewer from 'react-diff-viewer';
import type { ParamConfig, ToolMetadata } from '@/src/types/tools';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData, ResolvedItdeData } from '@/app/lib/itdeDataUtils';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import importedMetadata from '../metadata.json';
import { OutputActionButtons } from '../../_components/shared/OutputActionButtons';

interface DiffCheckerToolState {
  text1: string;
  text2: string;
  outputValue: string;
}

const DEFAULT_DIFF_CHECKER_STATE: DiffCheckerToolState = {
  text1: '',
  text2: '',
  outputValue: '',
};

const metadata = importedMetadata as ToolMetadata;

interface DiffCheckerClientProps {
  urlStateParams: ParamConfig[];
  toolRoute: string;
}

export default function DiffCheckerClient({
  urlStateParams,
  toolRoute,
}: DiffCheckerClientProps) {
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

      const resolvedPayload = await resolveItdeData(signal.sourceDirective, sourceMeta.outputConfig);
      if (resolvedPayload.type !== 'itemList' || !resolvedPayload.data) return;

      const textItems = resolvedPayload.data.filter((item) => item.type.startsWith('text/'));
      if (textItems.length < 2) return;

      try {
        const newText1 = await textItems[0].blob.text();
        const newText2 = await textItems[1].blob.text();
        setToolState({ text1: newText1, text2: newText2 });
        await saveStateNow({ ...toolState, text1: newText1, text2: newText2 });
        setUserDeferredAutoPopup(false);
      } catch (error) {
        console.error('Error processing incoming data:', error);
      }
    },
    [getToolMetadata, setToolState, toolState, saveStateNow]
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

  const handleText1Change = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({ text1: event.target.value });
  };

  const handleText2Change = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToolState({ text2: event.target.value });
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
    if (
      itdeTarget.pendingSignals.filter(
        (s) => s.sourceDirective !== sourceDirective
      ).length === 0
    )
      setUserDeferredAutoPopup(false);
  };

  useEffect(() => {
    setToolState((prev) => ({ ...prev, outputValue: toolState.text1 })); // Initialize outputValue
  }, []);

  return (
    <div className="flex flex-col gap-4 text-[rgb(var(--color-text-base))]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Textarea
          label="Text 1:"
          value={toolState.text1}
          onChange={handleText1Change}
          id="diff-text1"
          textareaClassName="font-mono"
        />
        <Textarea
          label="Text 2:"
          value={toolState.text2}
          onChange={handleText2Change}
          id="diff-text2"
          textareaClassName="font-mono"
        />
      </div>
      <DiffViewer
        oldValue={toolState.text1}
        newValue={toolState.text2}
        splitView={false}
        hideLineNumbers={true}
        styles={{
          diffContainer: "p-2",
          line: {
            padding: '0px'
          },
          contentText: {
            fontSize: '14px',
          }
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
      <ReceiveItdeDataTrigger
        hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
        pendingSignalCount={itdeTarget.pendingSignals.length}
        onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
      />
      <OutputActionButtons
        canPerform={true} // Always allow sending output
        directiveName={directiveName}
        outputConfig={metadata.outputConfig}
        selectedOutputItems={[{ blob: new Blob([toolState.text1], { type: 'text/plain' }), type: 'text/plain', id: 'text1', name: 'Text 1', createdAt: new Date(), size: new Blob([toolState.text1]).size }, { blob: new Blob([toolState.text2], { type: 'text/plain' }), type: 'text/plain', id: 'text2', name: 'Text 2', createdAt: new Date(), size: new Blob([toolState.text2]).size }]}
      />
    </div>
  );
}