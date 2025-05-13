// --- FILE: app/tool/crypto-wallet-generator/_components/CryptoWalletGeneratorClient.tsx ---
'use client';

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';
import { Keypair } from '@solana/web3.js';
import { v4 as uuidv4 } from 'uuid';

import Button from '../../_components/form/Button';
import RadioGroup from '../../_components/form/RadioGroup';
import useToolState from '../../_hooks/useToolState';
import FilenamePromptModal from '../../_components/shared/FilenamePromptModal';
import type { ParamConfig } from '@/src/types/tools';
import {
  ArrowPathIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
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

interface CryptoWalletToolState {
  walletType: WalletType;
}

const DEFAULT_CRYPTO_TOOL_STATE: CryptoWalletToolState = {
  walletType: 'ethereum',
};

const MAX_DISPLAYED_WALLETS = 10;

interface CryptoWalletGeneratorClientProps {
  toolRoute: string;
  toolTitle: string;
  urlStateParams?: ParamConfig[];
}

export default function CryptoWalletGeneratorClient({
  toolRoute,
  urlStateParams,
}: CryptoWalletGeneratorClientProps) {
  const {
    state: toolSettings,
    setState: setToolSettings,
    isLoadingState: isLoadingToolSettings,
  } = useToolState<CryptoWalletToolState>(toolRoute, DEFAULT_CRYPTO_TOOL_STATE);

  const [generatedWallets, setGeneratedWallets] = useState<WalletEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<boolean>(false);
  const [lastCopiedId, setLastCopiedId] = useState<string | null>(null);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);

  const initialSetupRanRef = useRef(false); // To ensure setup logic runs only once

  console.log(
    `[CryptoGenerator] Render. isLoadingToolSettings: ${isLoadingToolSettings}, initialSetupRan: ${initialSetupRanRef.current}, toolSettings.walletType: ${toolSettings.walletType}, generatedWallets: ${generatedWallets.length}`
  );

  const handleGenerateWallet = useCallback(
    async (typeForGeneration: WalletType) => {
      if (generating) {
        console.log('[handleGenerateWallet] Bailed: Already generating.');
        return;
      }
      setGenerating(true);
      setError(null);
      console.log(
        `[handleGenerateWallet] START. Generating for type: ${typeForGeneration}`
      );

      let newWalletEntry: WalletEntry | null = null;
      try {
        let generatedPublicKey = '';
        let generatedPrivateKey = '';
        let privateKeyFormatNote: string | undefined = undefined;

        if (typeForGeneration === 'ethereum') {
          const wallet = ethers.Wallet.createRandom();
          generatedPrivateKey = wallet.privateKey;
          generatedPublicKey = wallet.address;
        } else if (typeForGeneration === 'bitcoin') {
          const keyPair = ECPair.makeRandom();
          generatedPrivateKey = keyPair.toWIF();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { address } = bitcoin.payments.p2pkh({
            pubkey: keyPair.publicKey as any,
          });
          if (!address)
            throw new Error('Failed to generate Bitcoin P2PKH address.');
          generatedPublicKey = address;
        } else if (typeForGeneration === 'solana') {
          const keypair = Keypair.generate();
          generatedPublicKey = keypair.publicKey.toBase58();
          generatedPrivateKey = ethers.encodeBase58(keypair.secretKey);
          privateKeyFormatNote =
            'Base58 encoded secret key bytes (NOT a mnemonic phrase)';
        } else {
          throw new Error(
            `Invalid wallet type for generation: ${typeForGeneration}`
          );
        }
        newWalletEntry = {
          id: uuidv4(),
          type: typeForGeneration,
          privateKey: generatedPrivateKey,
          publicKey: generatedPublicKey,
          isPrivateKeyVisible: false,
          timestamp: Date.now(),
          privateKeyFormatNote: privateKeyFormatNote,
        };
        setGeneratedWallets((prev) =>
          [newWalletEntry!, ...prev].slice(0, MAX_DISPLAYED_WALLETS)
        );
        console.log(
          '[handleGenerateWallet] Success. New wallet ID:',
          newWalletEntry.id,
          'Type:',
          newWalletEntry.type
        );
      } catch (err: unknown) {
        const errorMessage = `Error generating ${typeForGeneration} wallet: ${err instanceof Error ? err.message : 'An unexpected error occurred.'}`;
        setError(errorMessage);
        console.error('[handleGenerateWallet] Error:', err);
      } finally {
        setGenerating(false);
        console.log('[handleGenerateWallet] FINALLY. Generating set to false.');
      }
    },
    [generating]
  ); // Removed toolSettings.walletType, pass typeForGeneration explicitly

  // Single effect for initial setup after tool state is loaded
  useEffect(() => {
    console.log(
      `[CryptoGenerator InitialSetupEffect] Running. isLoadingToolSettings: ${isLoadingToolSettings}, initialSetupRan: ${initialSetupRanRef.current}`
    );
    if (isLoadingToolSettings || initialSetupRanRef.current) {
      console.log(
        `[CryptoGenerator InitialSetupEffect] Bailing or already ran. isLoading: ${isLoadingToolSettings}, ran: ${initialSetupRanRef.current}`
      );
      return;
    }
    initialSetupRanRef.current = true;
    console.log(
      `[CryptoGenerator InitialSetupEffect] Proceeding with setup. Current toolSettings.walletType: ${toolSettings.walletType}`
    );

    let typeFromUrl: WalletType | null = null;
    let shouldUpdateSettings = false;
    let finalWalletTypeForSettings = toolSettings.walletType;

    if (urlStateParams && urlStateParams.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const urlParamValue = params.get('walletType') as WalletType | null;
      console.log(
        `[CryptoGenerator InitialSetupEffect] URL Params string: '${params.toString()}'. Extracted 'walletType': ${urlParamValue}`
      );
      if (
        urlParamValue &&
        ['ethereum', 'bitcoin', 'solana'].includes(urlParamValue)
      ) {
        typeFromUrl = urlParamValue;
        console.log(
          `[CryptoGenerator InitialSetupEffect] Valid walletType from URL: ${typeFromUrl}`
        );
        if (typeFromUrl !== toolSettings.walletType) {
          finalWalletTypeForSettings = typeFromUrl;
          shouldUpdateSettings = true;
          console.log(
            `[CryptoGenerator InitialSetupEffect] URL type '${typeFromUrl}' differs from state '${toolSettings.walletType}'. Will update settings.`
          );
        } else {
          console.log(
            `[CryptoGenerator InitialSetupEffect] URL type '${typeFromUrl}' matches state '${toolSettings.walletType}'. No settings update needed from URL type directly.`
          );
        }
      } else {
        console.log(
          `[CryptoGenerator InitialSetupEffect] No valid 'walletType' in URL, or param invalid.`
        );
      }
    } else {
      console.log(
        `[CryptoGenerator InitialSetupEffect] urlStateParams prop not provided or empty. Skipping URL processing.`
      );
    }

    if (shouldUpdateSettings) {
      console.log(
        `[CryptoGenerator InitialSetupEffect] Applying setToolSettings with walletType: ${finalWalletTypeForSettings}`
      );
      setToolSettings({ walletType: finalWalletTypeForSettings });
    }

    // Auto-generation logic: only if a typeFromUrl was valid AND wallets are empty
    if (typeFromUrl && generatedWallets.length === 0 && !generating) {
      console.log(
        `[CryptoGenerator InitialSetupEffect] Auto-generating wallet of type: ${typeFromUrl} (wallets empty, URL param was present)`
      );
      handleGenerateWallet(typeFromUrl); // Generate with the type from URL
    } else if (typeFromUrl && generatedWallets.length > 0) {
      console.log(
        `[CryptoGenerator InitialSetupEffect] URL param present, but wallets NOT empty. No auto-generation.`
      );
    } else if (!typeFromUrl) {
      console.log(
        `[CryptoGenerator InitialSetupEffect] No URL param. No auto-generation.`
      );
    }
    console.log(`[CryptoGenerator InitialSetupEffect] END.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingToolSettings, urlStateParams, toolSettings.walletType]); // Key dependencies: isLoading, urlStateParams, and toolSettings.walletType to react if it changes *before* this effect runs (e.g. from persistence)
  // handleGenerateWallet and setToolSettings are stable due to useCallback/dispatch pattern

  const toggleSpecificPrivateKeyVisibility = useCallback((id: string) => {
    setGeneratedWallets((prevWallets) =>
      prevWallets.map((wallet) =>
        wallet.id === id
          ? { ...wallet, isPrivateKeyVisible: !wallet.isPrivateKeyVisible }
          : wallet
      )
    );
  }, []);

  const handleTypeChange = useCallback(
    (newType: WalletType) => {
      console.log(
        '[CryptoGenerator handleTypeChange] User manually selected new type:',
        newType
      );
      setToolSettings({ walletType: newType });
      setError(null);
    },
    [setToolSettings]
  );

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
        if (error) setError(null);
      } catch (err: unknown) {
        setError(
          `Failed to copy ${copyType}: ${err instanceof Error ? err.message : 'Clipboard write failed.'}`
        );
      }
    },
    [error]
  );

  const handleClearAllWallets = useCallback(() => {
    console.log(
      '[CryptoGenerator handleClearAllWallets] Clearing all wallets.'
    );
    setGeneratedWallets([]);
    setError(null);
  }, []);

  const walletTypeOptions = useMemo(
    () => [
      { value: 'ethereum' as WalletType, label: 'Ethereum (EVM)' },
      { value: 'bitcoin' as WalletType, label: 'Bitcoin (BTC)' },
      { value: 'solana' as WalletType, label: 'Solana (SOL)' },
    ],
    []
  );

  const handleInitiateDownload = useCallback(() => {
    if (generatedWallets.length === 0) {
      setError('No wallets generated to download.');
      return;
    }
    setIsFilenameModalOpen(true);
  }, [generatedWallets.length]);

  const handleFilenameConfirmForDownload = useCallback(
    (filename: string) => {
      setIsFilenameModalOpen(false);
      if (generatedWallets.length === 0) {
        setError('No wallets to download after prompt.');
        return;
      }
      const dataToDownload = generatedWallets
        .map((w) => ({
          walletType: w.type,
          address: w.publicKey,
          privateKey: w.privateKey,
          ...(w.privateKeyFormatNote && { note: w.privateKeyFormatNote }),
          generatedAt: new Date(w.timestamp).toISOString(),
        }))
        .reverse();
      const jsonString = JSON.stringify(dataToDownload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      let finalFilename = filename.trim();
      if (!finalFilename)
        finalFilename = `oet-wallets-${toolSettings.walletType}-${Date.now()}`;
      if (!finalFilename.toLowerCase().endsWith('.json')) {
        finalFilename += '.json';
      }
      link.href = url;
      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      if (error) setError(null);
    },
    [generatedWallets, toolSettings.walletType, error]
  );

  if (isLoadingToolSettings && !initialSetupRanRef.current) {
    console.log(
      '[CryptoGenerator] Showing main loading state (initial settings load & setup not run).'
    );
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
          storing significant value. These wallets are intended for testing and
          educational purposes only. Do not use for real assets.
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-start sm:items-center p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
        <RadioGroup
          name="walletType"
          legend="Select Wallet Type:"
          options={walletTypeOptions}
          selectedValue={toolSettings.walletType}
          onChange={handleTypeChange}
          layout="horizontal"
          radioClassName="text-sm"
          labelClassName="font-medium cursor-pointer"
          className="flex-shrink-0 mb-2 sm:mb-0"
          disabled={generating}
        />
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button
            variant="primary"
            onClick={() => handleGenerateWallet(toolSettings.walletType)} // Pass current type for manual generation
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
          <div className="flex justify-between items-center border-b border-[rgb(var(--color-border-base))] pb-2">
            <h2 className="text-lg font-semibold text-[rgb(var(--color-text-muted))]">
              Generated Wallets (
              {generatedWallets.length > MAX_DISPLAYED_WALLETS
                ? MAX_DISPLAYED_WALLETS + '+'
                : generatedWallets.length}
              )
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleInitiateDownload}
              iconLeft={<ArrowDownTrayIcon className="h-4 w-4" />}
              disabled={generating || generatedWallets.length === 0}
              title="Download all displayed wallet details as a single JSON file"
            >
              Download All (.json)
            </Button>
          </div>
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
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-md font-medium text-[rgb(var(--color-text-base))]">
                    {wallet.type.charAt(0).toUpperCase() + wallet.type.slice(1)}{' '}
                    Wallet
                  </h3>
                  <span className="block text-xs font-normal text-gray-400">
                    Generated: {new Date(wallet.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
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
      <FilenamePromptModal
        isOpen={isFilenameModalOpen}
        onClose={() => {
          setIsFilenameModalOpen(false);
        }}
        onConfirm={handleFilenameConfirmForDownload}
        initialFilename={`oet-wallets-${Date.now()}.json`}
        title="Download All Generated Wallets"
        promptMessage="Enter a filename for the JSON file containing all currently displayed wallets:"
        confirmButtonText="Download JSON"
      />
    </div>
  );
}
