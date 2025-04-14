// FILE: app/t/crypto-wallet-generator/_components/CryptoWalletGeneratorClient.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { useHistory } from '../../../context/HistoryContext';
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';

const ECPair = ECPairFactory(tinysecp);

type WalletType = 'ethereum' | 'bitcoin';

interface CryptoWalletGeneratorClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function CryptoWalletGeneratorClient({
  toolTitle,
  toolRoute
}: CryptoWalletGeneratorClientProps) {
  const [walletType, setWalletType] = useState<WalletType>('ethereum');
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isPrivateKeyVisible, setIsPrivateKeyVisible] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<boolean>(false);

  const { addHistoryEntry } = useHistory();

  const handleGenerateWallet = useCallback(async () => {
    console.log("Attempting to generate wallet. Type:", walletType);
    setGenerating(true); setError(null); setPrivateKey(null); setPublicKey(null); setIsPrivateKeyVisible(false);

    let generatedPublicKey: string = '';
    let status: 'success' | 'error' = 'success';
    let errorMessage = '';

    try {
      let generatedPrivateKey: string;

      if (walletType === 'ethereum') {
        const wallet = ethers.Wallet.createRandom();
        generatedPrivateKey = wallet.privateKey;
        generatedPublicKey = wallet.address;
      } else if (walletType === 'bitcoin') {
        const keyPair = ECPair.makeRandom();
        generatedPrivateKey = keyPair.toWIF();
        const { address } = bitcoin.payments.p2pkh({ pubkey: Buffer.from(keyPair.publicKey) });
        if (!address) throw new Error('Failed to generate Bitcoin address.');
        generatedPublicKey = address;
      } else {
        throw new Error('Invalid wallet type selected.');
      }

      setPrivateKey(generatedPrivateKey);
      setPublicKey(generatedPublicKey);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      console.error('Error generating wallet:', err);
      errorMessage = `Error: ${message}`;
      setError(errorMessage);
      status = 'error';
    } finally {
      setGenerating(false);
      addHistoryEntry({
        toolName: toolTitle, toolRoute: toolRoute,
        action: `generate-${walletType}${status === 'error' ? '-failed': ''}`,
        input: { walletType: walletType },
        output: status === 'success' ? `Generated: ${generatedPublicKey}` : errorMessage,
        status: status,
      });
    }
  }, [walletType, addHistoryEntry, toolTitle, toolRoute]);

  const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newType = event.target.value as WalletType;
    setWalletType(newType);
    setPrivateKey(null); setPublicKey(null); setError(null); setIsPrivateKeyVisible(false);
  };

  const togglePrivateKeyVisibility = () => { setIsPrivateKeyVisible(prev => !prev); };

  const copyToClipboard = useCallback(async (text: string | null, type: string) => {
    if (!text) return;
    const actionPrefix = `copy-${type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    let status: 'success' | 'error' = 'success';
    let outputMessage = 'Copied successfully';

    try {
      await navigator.clipboard.writeText(text);
      console.log(`${type} copied!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Clipboard write failed.';
      console.error(`Failed to copy ${type}:`, err);
      setError(`Failed to copy ${type}: ${message}`);
      outputMessage = `Copy Error: ${message}`;
      status = 'error';
    } finally {
      addHistoryEntry({
         toolName: toolTitle, toolRoute: toolRoute,
         action: `${actionPrefix}${status === 'error' ? '-failed': ''}`,
         input: { copiedType: type, walletType: walletType },
         output: outputMessage,
         status: status,
       });
    }
  }, [addHistoryEntry, walletType, toolTitle, toolRoute]);

  return (
    <div className="space-y-6 text-[rgb(var(--color-text-base))]">
        <div role="alert" className="p-4 text-sm rounded-lg bg-[rgb(var(--color-indicator-ambiguous)/0.1)] border border-[rgb(var(--color-indicator-ambiguous)/0.5)] text-[rgb(var(--color-text-muted))]">
           <strong className="font-medium text-[rgb(var(--color-text-base))]">⚠️ Security Warning:</strong> Generating keys in a browser is **NOT** recommended for storing significant value. Use dedicated hardware or software wallets for main funds. These generated keys are best for testing or learning purposes only. Always back up private keys securely offline and never share them.
        </div>

        <div className="flex flex-wrap gap-4 items-center p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
          <fieldset className="flex-grow">
            <legend className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Select Wallet Type:</legend>
            <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
              <div className="flex items-center">
                <input
                  id="type-ethereum" name="walletType" type="radio" value="ethereum"
                  checked={walletType === 'ethereum'} onChange={handleTypeChange}
                  className="h-4 w-4 border-[rgb(var(--color-border-base))] text-[rgb(var(--color-button-primary-bg))] focus:outline-none"
                />
                <label htmlFor="type-ethereum" className="ml-2 block text-sm font-medium text-[rgb(var(--color-text-base))]">
                  Ethereum (ETH & EVM)
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="type-bitcoin" name="walletType" type="radio" value="bitcoin"
                  checked={walletType === 'bitcoin'} onChange={handleTypeChange}
                  className="h-4 w-4 border-[rgb(var(--color-border-base))] text-[rgb(var(--color-button-primary-bg))] focus:outline-none"
                />
                <label htmlFor="type-bitcoin" className="ml-2 block text-sm font-medium text-[rgb(var(--color-text-base))]">
                  Bitcoin (BTC)
                </label>
              </div>
            </div>
          </fieldset>

          <button
            type="button"
            onClick={handleGenerateWallet}
            disabled={generating}
            className="inline-flex items-center rounded-md bg-[rgb(var(--color-button-primary-bg))] px-3 py-2 text-sm font-semibold text-[rgb(var(--color-button-primary-text))] shadow-sm hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {generating ? ( <><svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Generating...</> ) : ( 'Generate New Wallet' )}
          </button>
        </div>

        {error && (
          <div role="alert" className="p-4 text-sm rounded-lg bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))]">
            <strong className="font-medium">⛔ Error:</strong> {error.replace('Error: ','')}
          </div>
        )}

        {publicKey && privateKey && !error && (
          <div className="space-y-4 border border-[rgb(var(--color-border-base))] p-4 rounded-md bg-[rgb(var(--color-bg-component))]">
            <h2 className="text-lg font-semibold text-[rgb(var(--color-text-muted))]">Generated Wallet Details ({walletType.toUpperCase()})</h2>

            <div>
              <label htmlFor="publicKeyOutput" className="block text-sm font-medium leading-6 text-[rgb(var(--color-text-base))]">
                {walletType === 'ethereum' ? 'Address' : 'Bitcoin Address (P2PKH)'}
              </label>
              <div className="mt-1 flex rounded-md shadow-sm border border-[rgb(var(--color-input-border))]">
                 <input
                    id="publicKeyOutput" type="text" value={publicKey} readOnly
                    className="block w-full flex-1 rounded-l-md py-1.5 px-2 text-[rgb(var(--color-input-text))] focus:outline-none sm:text-sm sm:leading-6 bg-[rgb(var(--color-bg-subtle))]"
                 />
                 <button
                    type="button" onClick={() => copyToClipboard(publicKey, 'Address')} title="Copy public address"
                    className="relative inline-flex items-center gap-x-1.5 rounded-r-md px-3 py-2 text-sm font-semibold text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] border-l border-[rgb(var(--color-input-border))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none focus:z-10"
                 > 📋 Copy </button>
              </div>
               <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">This is your public identifier, safe to share.</p>
            </div>

            <div>
               <label htmlFor="privateKeyOutput" className="block text-sm font-medium leading-6 text-[rgb(var(--color-text-base))]">
                 Private Key ({walletType === 'bitcoin' ? 'WIF' : 'Hex'})
              </label>
              <div className="mt-1 flex rounded-md shadow-sm border border-[rgb(var(--color-input-border))]">
                 <input
                    id="privateKeyOutput" type={isPrivateKeyVisible ? 'text' : 'password'} value={privateKey} readOnly
                    className="block w-full flex-1 rounded-l-md py-1.5 px-2 font-mono text-[rgb(var(--color-input-text))] focus:outline-none sm:text-sm sm:leading-6 bg-[rgb(var(--color-bg-subtle))]"
                 />
                  <button
                    type="button" onClick={togglePrivateKeyVisibility} title={isPrivateKeyVisible ? 'Hide Private Key' : 'Show Private Key'}
                    className="relative inline-flex items-center gap-x-1.5 rounded-none px-3 py-2 text-sm font-semibold text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] border-l border-[rgb(var(--color-input-border))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none focus:z-10"
                 > {isPrivateKeyVisible ? '👁️ Hide' : '👁️ Show'} </button>
                 <button
                    type="button" onClick={() => copyToClipboard(privateKey, 'Private Key')} title="Copy private key (Use with extreme caution!)"
                    className="relative inline-flex items-center gap-x-1.5 rounded-r-md px-3 py-2 text-sm font-semibold text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] border-l border-[rgb(var(--color-input-border))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none focus:z-10"
                 > 📋 Copy </button>
              </div>
              <p className="mt-1 text-xs text-[rgb(var(--color-text-error))] font-semibold">NEVER share this private key! Keep it safe and secret.</p>
            </div>
          </div>
        )}
    </div>
  );
}