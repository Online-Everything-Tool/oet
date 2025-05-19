'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import DiffViewer from 'react-diff-viewer';
import useToolState from '../../_hooks/useToolState';
import Textarea from '../../_components/form/Textarea';
import Button from '../../_components/form/Button';
import ReceiveItdeDataTrigger from '../../_components/shared/ReceiveItdeDataTrigger';
import IncomingDataModal from '../../_components/shared/IncomingDataModal';
import { useMetadata } from '@/app/context/MetadataContext';
import useItdeTargetHandler, { IncomingSignal } from '../../_hooks/useItdeTargetHandler';
import { resolveItdeData } from '@/app/lib/itdeDataUtils';
import { ToolMetadata, ParamConfig } from '@/src/types/tools';
import { StoredFile } from '@/src/types/storage';
import importedMetadata from '../metadata.json';

const metadata = importedMetadata as ToolMetadata;

interface DiffCheckerToolState {
  text1: string;
  text2: string;
}

const DEFAULT_DIFF_CHECKER_STATE: DiffCheckerToolState = {
  text1: '',
  text2: '',
};

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

      const textItems = resolvedPayload.data.filter((item) => item.type.startsWith('text/')) as StoredFile[];

      if (textItems.length >= 1) {
        const newText1Promise = textItems[0].blob.text();
        const newText2Promise = textItems.length >= 2 ? textItems[1].blob.text() : Promise.resolve('');
        const [newText1, newText2] = await Promise.all([newText1Promise, newText2Promise]);
        setToolState({ text1: newText1, text2: newText2 });
      }
      setUserDeferredAutoPopup(false);
    },
    [getToolMetadata, setToolState]
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
  }, [isLoadingState, itdeTarget, userDeferredAutoPopup]);

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
    if (itdeTarget.pendingSignals.filter((s) => s.sourceDirective !== sourceDirective).length === 0) setUserDeferredAutoPopup(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-2">
        <ReceiveItdeDataTrigger
          hasDeferredSignals={itdeTarget.pendingSignals.length > 0 && userDeferredAutoPopup && !itdeTarget.isModalOpen}
          pendingSignalCount={itdeTarget.pendingSignals.length}
          onReviewIncomingClick={itdeTarget.openModalIfSignalsExist}
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <Textarea
          label="Text 1:"
          value={toolState.text1}
          onChange={handleText1Change}
          placeholder="Enter the first text..."
          textareaClassName="text-sm font-mono"
          spellCheck="false"
        />
        <Textarea
          label="Text 2:"
          value={toolState.text2}
          onChange={handleText2Change}
          placeholder="Enter the second text..."
          textareaClassName="text-sm font-mono"
          spellCheck="false"
        />
      </div>
      <DiffViewer
        oldValue={toolState.text1}
        newValue={toolState.text2}
        splitView={true}
        hideLineNumbers={false}
        showDiffOnly={false}
        styles={{
          variables: {
            dark: {
              diffViewerBackground: 'rgb(var(--color-bg-subtle))',
              diffViewerTitleBackground: '#22272e', // Example, adjust as needed
              diffViewerColor: 'rgb(var(--color-text-base))',
              addedBackground: '#acf2bd',
              addedColor: '#000',
              removedBackground: '#fdb8c0',
              removedColor: '#000',
              wordAddedBackground: '#acf2bd',
              wordRemovedBackground: '#fdb8c0',
              lineNumberBackground: '#f6f8fa', // Or similar light color
              lineNumberColor: '#6a737d', // Or similar dark color
            },
          },
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