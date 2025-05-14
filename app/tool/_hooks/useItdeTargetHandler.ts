// FILE: app/tool/_hooks/useItdeTargetHandler.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getSourceSignalsForTarget,
  clearSourceSignal,
  clearAllSignalsForTarget,
} from '@/app/lib/sessionStorageUtils';
import { useMetadata } from '@/app/context/MetadataContext';

export interface IncomingSignal {
  sourceDirective: string;
  sourceToolTitle: string; // Now guaranteed to be resolved
}

interface UseItdeTargetHandlerOptions {
  targetToolDirective: string;
  // onProcessSignal now takes the specific signal object
  onProcessSignal: (signal: IncomingSignal) => void;
}

export interface UseItdeTargetHandlerReturn {
  isModalOpen: boolean;
  pendingSignals: IncomingSignal[]; // Array of resolved signal objects
  openModalIfSignalsExist: () => boolean;
  closeModal: () => void; // This will be our "defer" action from the modal
  acceptSignal: (sourceDirective: string) => void;
  ignoreSignal: (sourceDirective: string) => void;
  ignoreAllSignals: () => void;
}

export default function useItdeTargetHandler({
  targetToolDirective,
  onProcessSignal,
}: UseItdeTargetHandlerOptions): UseItdeTargetHandlerReturn {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rawSignals, setRawSignals] = useState<string[]>([]);
  const { getToolMetadata, isLoading: isLoadingMetadata } = useMetadata();

  const refreshRawSignals = useCallback(() => {
    if (!targetToolDirective) {
      console.log('targetToolDirective not defined');
      return;
    }
    const signals = getSourceSignalsForTarget(targetToolDirective);
    console.log('signals:', signals);
    setRawSignals(signals);
  }, [targetToolDirective]);

  useEffect(() => {
    refreshRawSignals();
  }, [refreshRawSignals]);

  const pendingSignals = useMemo((): IncomingSignal[] => {
    if (isLoadingMetadata || rawSignals.length === 0) {
      return [];
    }
    return rawSignals
      .map((directive) => {
        const meta = getToolMetadata(directive);
        return {
          sourceDirective: directive,
          sourceToolTitle: meta?.title || directive,
        };
      })
      .filter((signal): signal is IncomingSignal => signal !== null);
  }, [rawSignals, getToolMetadata, isLoadingMetadata]);

  const openModalIfSignalsExist = useCallback((): boolean => {
    if (pendingSignals.length > 0) {
      setIsModalOpen(true);
      return true;
    }
    setIsModalOpen(false); // Should not be needed if pendingSignals.length is 0
    return false;
  }, [pendingSignals]);

  const closeModal = useCallback(() => {
    // This becomes our "Defer All" action from the modal
    setIsModalOpen(false);
  }, []);

  const acceptSignal = useCallback(
    (sourceDirective: string) => {
      const signalToProcess = pendingSignals.find(
        (s) => s.sourceDirective === sourceDirective
      );
      if (signalToProcess) {
        onProcessSignal(signalToProcess);
        clearSourceSignal(targetToolDirective, sourceDirective);
        refreshRawSignals();
      }
    },
    [pendingSignals, onProcessSignal, targetToolDirective, refreshRawSignals]
  );

  const ignoreSignal = useCallback(
    (sourceDirective: string) => {
      clearSourceSignal(targetToolDirective, sourceDirective);
      refreshRawSignals();
    },
    [targetToolDirective, refreshRawSignals]
  );

  const ignoreAllSignals = useCallback(() => {
    clearAllSignalsForTarget(targetToolDirective);
    refreshRawSignals();
    setIsModalOpen(false);
  }, [targetToolDirective, refreshRawSignals]);

  // Effect to close modal if all signals are cleared by other means (e.g., all ignored/accepted)
  useEffect(() => {
    if (pendingSignals.length === 0 && isModalOpen) {
      setIsModalOpen(false);
    }
  }, [pendingSignals, isModalOpen]);

  return {
    isModalOpen,
    pendingSignals,
    openModalIfSignalsExist,
    closeModal, // Will be used as "Defer All (Close)" from the modal
    acceptSignal,
    ignoreSignal,
    ignoreAllSignals,
  };
}
