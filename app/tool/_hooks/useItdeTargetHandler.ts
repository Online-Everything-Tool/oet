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
  sourceToolTitle: string;
}

interface UseItdeTargetHandlerOptions {
  targetToolDirective: string;

  onProcessSignal: (signal: IncomingSignal) => void;
}

export interface UseItdeTargetHandlerReturn {
  isModalOpen: boolean;
  pendingSignals: IncomingSignal[];
  openModalIfSignalsExist: () => boolean;
  closeModal: () => void;
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
      return;
    }
    const signals = getSourceSignalsForTarget(targetToolDirective);
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
    setIsModalOpen(false);
    return false;
  }, [pendingSignals]);

  const closeModal = useCallback(() => {
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

  useEffect(() => {
    if (pendingSignals.length === 0 && isModalOpen) {
      setIsModalOpen(false);
    }
  }, [pendingSignals, isModalOpen]);

  return {
    isModalOpen,
    pendingSignals,
    openModalIfSignalsExist,
    closeModal,
    acceptSignal,
    ignoreSignal,
    ignoreAllSignals,
  };
}
