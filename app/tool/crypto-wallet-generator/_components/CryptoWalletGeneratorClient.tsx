// FILE: app/tool/crypto-wallet-generator/_components/CryptoWalletGeneratorClient.tsx
'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react'; // Added useEffect
import { useHistory } from '../../../context/HistoryContext';
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';
import { Keypair } from '@solana/web3.js';
import { v4 as uuidv4 } from 'uuid';

import Button from '../../_components/form/Button';
import RadioGroup from '../../_components/form/RadioGroup';
import useToolState from '../../_hooks/useToolState'; // Import useToolState
import type { ParamConfig } from '@/src/types/tools'; // For urlStateParams if used
import {
  ArrowPathIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const ECPair = ECPairFactory(tinysecp);

type WalletType = 'ethereum' | 'bitcoin' | 'solana';

interface WalletEntry {
  id: string;
  type: WalletType;
  privateKey: string;
  publicKey: string;
  isPrivateKeyVisible: boolean;
  timestamp: number;
  privateKeyFormatNote?: string;
}

// Define state for useToolState
interface CryptoWalletToolState {
  walletType: WalletType;
}

const DEFAULT_CRYPTO_TOOL_STATE: CryptoWalletToolState = {
  walletType: 'ethereum',
};

interface CryptoWalletGeneratorClientProps {
  toolTitle: string;
  toolRoute: string;
  urlStateParams?: ParamConfig[]; // Make urlStateParams optional if not always used for this tool's state
}

export default function CryptoWalletGeneratorClient({
  toolTitle,
  toolRoute,
  urlStateParams, // Added to props
}: CryptoWalletGeneratorClientProps) {
  const {
    state: toolSettings, // Renamed to toolSettings for clarity
    setState: setToolSettings,
    isLoadingState: isLoadingToolSettings,
  } = useToolState<CryptoWalletToolState>(toolRoute, DEFAULT_CRYPTO_TOOL_STATE);

  // Local UI state for generated wallets and interaction feedback
  const [generatedWallets, setGeneratedWallets] = useState<WalletEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<boolean>(false);
  const [lastCopiedId, setLastCopiedId] = useState<string | null>(null);

  const { addHistoryEntry } = useHistory();

  // Effect for initial URL param load for walletType
  useEffect(() => {
    if (
      !isLoadingToolSettings &&
      urlStateParams &&
      urlStateParams?.length > 0
    ) {
      const params = new URLSearchParams(window.location.search);
      // Assuming 'type' or 'walletType' might be a URL parameter for default selection
      const typeFromUrl =
        (params.get('type') as WalletType) ||
        (params.get('walletType') as WalletType);

      if (
        typeFromUrl &&
        ['ethereum', 'bitcoin', 'solana'].includes(typeFromUrl)
      ) {
        if (typeFromUrl !== toolSettings.walletType) {
          setToolSettings({ walletType: typeFromUrl });
          // No automatic generation on URL type change, user must click "Generate"
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingToolSettings, urlStateParams, setToolSettings]); // toolSettings.walletType removed to avoid loop if URL matches initial default

  const toggleSpecificPrivateKeyVisibility = (id: string) => {
    setGeneratedWallets((prevWallets) =>
      prevWallets.map((wallet) =>
        wallet.id === id
          ? { ...wallet, isPrivateKeyVisible: !wallet.isPrivateKeyVisible }
          : wallet
      )
    );
  };

  const handleGenerateWallet = useCallback(async () => {
    setGenerating(true);
    setError(null);
    let newWalletEntry: WalletEntry | null = null;
    let generatedPublicKey: string = '';
    let generatedPrivateKey: string = '';
    let privateKeyFormatNote: string | undefined = undefined;
    let status: 'success' | 'error' = 'success';
    let errorMessage = '';
    const currentWalletType = toolSettings.walletType; // Use from toolSettings
    const inputDetails = { walletType: currentWalletType };

    try {
      if (currentWalletType === 'ethereum') {
        const wallet = ethers.Wallet.createRandom();
        generatedPrivateKey = wallet.privateKey;
        generatedPublicKey = wallet.address;
      } else if (currentWalletType === 'bitcoin') {
        const keyPair = ECPair.makeRandom();
        generatedPrivateKey = keyPair.toWIF();
        const { address } = bitcoin.payments.p2pkh({
          pubkey: Buffer.from(keyPair.publicKey),
        });
        if (!address)
          throw new Error('Failed to generate Bitcoin P2PKH address.');
        generatedPublicKey = address;
      } else if (currentWalletType === 'solana') {
        const keypair = Keypair.generate();
        generatedPublicKey = keypair.publicKey.toBase58();
        generatedPrivateKey = ethers.encodeBase58(keypair.secretKey);
        privateKeyFormatNote =
          'Base58 encoded secret key bytes (NOT a mnemonic phrase)';
      } else {
        throw new Error('Invalid wallet type selected.');
      }

      newWalletEntry = {
        id: uuidv4(),
        type: currentWalletType,
        privateKey: generatedPrivateKey,
        publicKey: generatedPublicKey,
        isPrivateKeyVisible: false,
        timestamp: Date.now(),
        privateKeyFormatNote: privateKeyFormatNote,
      };
      setGeneratedWallets((prev) => [newWalletEntry!, ...prev].slice(0, 10));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      errorMessage = `Error: ${message}`;
      setError(errorMessage);
      status = 'error';
      (inputDetails as Record<string, unknown>).error = errorMessage;
    } finally {
      setGenerating(false);
      addHistoryEntry({
        toolName: toolTitle,
        toolRoute: toolRoute,
        trigger: 'click',
        input: inputDetails,
        output:
          status === 'success'
            ? `Generated ${currentWalletType}: ${generatedPublicKey.substring(0, 20)}...`
            : errorMessage,
        status: status,
        eventTimestamp: Date.now(),
      });
    }
  }, [toolSettings.walletType, addHistoryEntry, toolTitle, toolRoute]);

  const handleTypeChange = (newType: WalletType) => {
    setToolSettings({ walletType: newType }); // Update persisted state
    setError(null);
  };

  const copyToClipboard = useCallback(
    async (
      textToCopy: string,
      copyType: 'Address' | 'Private Key',
      walletId: string
    ) => {
      setLastCopiedId(null);
      if (!textToCopy) return;
      try {
        await navigator.clipboard.writeText(textToCopy);
        setLastCopiedId(`${walletId}-${copyType}`);
        setTimeout(() => setLastCopiedId(null), 2000);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Clipboard write failed.';
        setError(`Failed to copy ${copyType}: ${message}`);
      }
    },
    []
  );

  const handleClearAllWallets = useCallback(() => {
    setGeneratedWallets([]);
    setError(null);
    addHistoryEntry({
      toolName: toolTitle,
      toolRoute,
      trigger: 'click',
      input: { action: 'clearAllWallets' },
      output: 'Cleared all generated wallets.',
      status: 'success',
      eventTimestamp: Date.now(),
    });
  }, [addHistoryEntry, toolTitle, toolRoute]);

  const walletTypeOptions = useMemo(
    () => [
      { value: 'ethereum' as WalletType, label: 'Ethereum (EVM)' },
      { value: 'bitcoin' as WalletType, label: 'Bitcoin (BTC)' },
      { value: 'solana' as WalletType, label: 'Solana (SOL)' },
    ],
    []
  );

  if (isLoadingToolSettings) {
    return (
      <p className="text-center p-4 italic text-gray-500 animate-pulse">
        Loading Wallet Generator...
      </p>
    );
  }

  return (
    <div className="space-y-6 text-[rgb(var(--color-text-base))]">
      <div
        role="alert"
        className="p-4 text-sm rounded-lg bg-[rgb(var(--color-indicator-ambiguous)/0.1)] border border-[rgb(var(--color-indicator-ambiguous)/0.5)] text-[rgb(var(--color-text-muted))] flex items-start gap-2"
      >
        <ExclamationTriangleIcon className="h-6 w-6 text-[rgb(var(--color-indicator-ambiguous))] flex-shrink-0 mt-0.5" />
        <div>
          <strong className="font-medium text-[rgb(var(--color-text-base))]">
            Security Warning:
          </strong>{' '}
          Generating keys in a browser is <strong>NOT</strong> recommended for
          storing significant value. Use dedicated hardware or software wallets
          for main funds. These generated keys are best for testing or learning
          purposes only. Always back up private keys securely offline and never
          share them.
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-center p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <RadioGroup
          name="walletType"
          legend="Select Wallet Type:"
          options={walletTypeOptions}
          selectedValue={toolSettings.walletType} // Use from toolSettings
          onChange={handleTypeChange}
          layout="horizontal"
          radioClassName="text-sm"
          labelClassName="font-medium cursor-pointer"
          className="flex-shrink-0 mb-2 sm:mb-0"
        />
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button
            variant="primary"
            onClick={handleGenerateWallet}
            disabled={generating}
            isLoading={generating}
            loadingText="Generating..."
            iconLeft={
              <ArrowPathIcon
                className={`h-5 w-5 ${generating ? 'animate-spin' : ''}`}
              />
            }
            className="w-full sm:w-auto"
          >
            Generate New Wallet
          </Button>
          <Button
            variant="neutral"
            onClick={handleClearAllWallets}
            disabled={generating || generatedWallets.length === 0}
            iconLeft={<TrashIcon className="h-5 w-5" />}
            className="w-full sm:w-auto"
          >
            Clear All ({generatedWallets.length})
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 text-sm rounded-lg bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))] flex items-start gap-2"
        >
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="font-medium">Error:</strong>{' '}
            {error.replace('Error: ', '')}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {generatedWallets.length > 0 && (
          <h2 className="text-lg font-semibold text-[rgb(var(--color-text-muted))] border-b border-[rgb(var(--color-border-base))] pb-2">
            Generated Wallets
          </h2>
        )}
        {generatedWallets.map((wallet) => {
          const isPublicKeyCopied = lastCopiedId === `${wallet.id}-Address`;
          const isPrivateKeyCopied =
            lastCopiedId === `${wallet.id}-Private Key`;
          let addressLabel = 'Address';
          if (wallet.type === 'bitcoin')
            addressLabel = 'Bitcoin Address (P2PKH)';
          if (wallet.type === 'solana')
            addressLabel = 'Solana Address (Base58)';
          let privateKeyLabel = 'Private Key';
          if (wallet.type === 'bitcoin') privateKeyLabel = 'Private Key (WIF)';
          if (wallet.type === 'solana')
            privateKeyLabel = 'Private Key (Bytes, Base58)';
          return (
            <div
              key={wallet.id}
              className="space-y-3 border border-[rgb(var(--color-border-base))] p-4 rounded-md bg-[rgb(var(--color-bg-component))] shadow-sm animate-slide-down"
            >
              <h3 className="text-md font-medium text-[rgb(var(--color-text-base))] flex justify-between items-center">
                <span>
                  {wallet.type.charAt(0).toUpperCase() + wallet.type.slice(1)}{' '}
                  Wallet
                </span>
                <span className="text-xs font-normal text-gray-400">
                  Generated: {new Date(wallet.timestamp).toLocaleString()}
                </span>
              </h3>
              <div>
                <label
                  htmlFor={`publicKeyOutput-${wallet.id}`}
                  className="block text-sm font-medium leading-6 text-[rgb(var(--color-text-base))]"
                >
                  {addressLabel}
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    id={`publicKeyOutput-${wallet.id}`}
                    type="text"
                    value={wallet.publicKey}
                    readOnly
                    className="block w-full flex-1 rounded-l-md border-0 py-1.5 px-2 text-[rgb(var(--color-input-text))] ring-1 ring-inset ring-[rgb(var(--color-input-border))] focus:ring-2 focus:ring-inset focus:ring-[rgb(var(--color-input-focus-border))] sm:text-sm sm:leading-6 bg-[rgb(var(--color-bg-subtle))]"
                  />
                  <Button
                    variant={isPublicKeyCopied ? 'secondary' : 'neutral'}
                    onClick={() =>
                      copyToClipboard(wallet.publicKey, 'Address', wallet.id)
                    }
                    className="rounded-l-none !py-1.5 px-3 border-l-0"
                    iconLeft={
                      isPublicKeyCopied ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        <ClipboardDocumentIcon className="h-4 w-4" />
                      )
                    }
                    title={isPublicKeyCopied ? 'Copied!' : 'Copy Address'}
                  >
                    <span className="sr-only">
                      {isPublicKeyCopied ? 'Copied Address' : 'Copy Address'}
                    </span>
                  </Button>
                </div>
                <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">
                  This is your public identifier, safe to share.
                </p>
              </div>
              <div>
                <label
                  htmlFor={`privateKeyOutput-${wallet.id}`}
                  className="block text-sm font-medium leading-6 text-[rgb(var(--color-text-base))]"
                >
                  {privateKeyLabel}
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    id={`privateKeyOutput-${wallet.id}`}
                    type={wallet.isPrivateKeyVisible ? 'text' : 'password'}
                    value={wallet.privateKey}
                    readOnly
                    className="block w-full flex-1 rounded-l-md border-0 py-1.5 px-2 font-mono text-[rgb(var(--color-input-text))] ring-1 ring-inset ring-[rgb(var(--color-input-border))] focus:ring-2 focus:ring-inset focus:ring-[rgb(var(--color-input-focus-border))] sm:text-sm sm:leading-6 bg-[rgb(var(--color-bg-subtle))]"
                  />
                  <Button
                    variant="neutral"
                    onClick={() =>
                      toggleSpecificPrivateKeyVisibility(wallet.id)
                    }
                    className="rounded-none !py-1.5 px-3 border-l-0"
                    iconLeft={
                      wallet.isPrivateKeyVisible ? (
                        <EyeSlashIcon className="h-4 w-4" />
                      ) : (
                        <EyeIcon className="h-4 w-4" />
                      )
                    }
                    title={wallet.isPrivateKeyVisible ? 'Hide Key' : 'Show Key'}
                  >
                    <span className="sr-only">
                      {wallet.isPrivateKeyVisible
                        ? 'Hide Private Key'
                        : 'Show Private Key'}
                    </span>
                  </Button>
                  <Button
                    variant={isPrivateKeyCopied ? 'secondary' : 'neutral'}
                    onClick={() =>
                      copyToClipboard(
                        wallet.privateKey,
                        'Private Key',
                        wallet.id
                      )
                    }
                    className="rounded-r-md !py-1.5 px-3 border-l-0"
                    iconLeft={
                      isPrivateKeyCopied ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        <ClipboardDocumentIcon className="h-4 w-4" />
                      )
                    }
                    title={isPrivateKeyCopied ? 'Copied!' : 'Copy Private Key'}
                  >
                    <span className="sr-only">
                      {isPrivateKeyCopied
                        ? 'Copied Private Key'
                        : 'Copy Private Key'}
                    </span>
                  </Button>
                </div>
                {wallet.privateKeyFormatNote && (
                  <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))] italic">
                    {wallet.privateKeyFormatNote}
                  </p>
                )}
                <p className="mt-1 text-xs text-[rgb(var(--color-text-error))] font-semibold">
                  NEVER share this private key! Keep it safe and secret.
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
