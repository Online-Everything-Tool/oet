// /app/t/crypto-wallet-generator/page.tsx
'use client';

import React, { useState, useCallback } from 'react';
// Assuming useHistory context setup exists elsewhere and works
import { useHistory } from '../../context/HistoryContext';

// Crypto Libraries
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';

// Import ToolHeader and Metadata
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';

// Initialize ECPair for bitcoinjs-lib
const ECPair = ECPairFactory(tinysecp);

type WalletType = 'ethereum' | 'bitcoin';

export default function CryptoWalletGeneratorPage() {
  const [walletType, setWalletType] = useState<WalletType>('ethereum');
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isPrivateKeyVisible, setIsPrivateKeyVisible] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<boolean>(false);

  const { addHistoryEntry } = useHistory();

  // --- Generate Wallet Logic ---
  const handleGenerateWallet = useCallback(async () => {
    console.log("Attempting to generate wallet. Type:", walletType);
    setGenerating(true); setError(null); setPrivateKey(null); setPublicKey(null); setIsPrivateKeyVisible(false);

    try {
      let generatedPrivateKey: string;
      let generatedPublicKey: string; // Holds address

      if (walletType === 'ethereum') {
        const wallet = ethers.Wallet.createRandom();
        generatedPrivateKey = wallet.privateKey;
        generatedPublicKey = wallet.address;
      } else if (walletType === 'bitcoin') {
        const keyPair = ECPair.makeRandom();
        generatedPrivateKey = keyPair.toWIF();
        // --- FIX: Convert Uint8Array publicKey to Buffer ---
        const { address } = bitcoin.payments.p2pkh({ pubkey: Buffer.from(keyPair.publicKey) });
        // --- End Fix ---
        if (!address) throw new Error('Failed to generate Bitcoin address.');
        generatedPublicKey = address;
      } else {
        throw new Error('Invalid wallet type selected.');
      }

      setPrivateKey(generatedPrivateKey);
      setPublicKey(generatedPublicKey);

      addHistoryEntry({
        toolName: metadata.title, toolRoute: '/t/crypto-wallet-generator',
        action: `generate-${walletType}`, input: { type: walletType },
        output: generatedPublicKey, status: 'success',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      console.error('Error generating wallet:', err);
      setError(`Error: ${message}`);
      addHistoryEntry({
        toolName: metadata.title, toolRoute: '/t/crypto-wallet-generator',
        action: `generate-${walletType}`, input: { type: walletType },
        output: `Error: ${message}`, status: 'error',
      });
    } finally {
      setGenerating(false);
    }
  }, [walletType, addHistoryEntry]);

  // --- UI Event Handlers ---
  const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newType = event.target.value as WalletType;
    setWalletType(newType);
    setPrivateKey(null); setPublicKey(null); setError(null); setIsPrivateKeyVisible(false);
  };

  const togglePrivateKeyVisibility = () => { setIsPrivateKeyVisible(prev => !prev); };

  const copyToClipboard = useCallback(async (text: string | null, type: string) => {
    if (!text) return;
    const actionPrefix = `copy-${type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    try {
      await navigator.clipboard.writeText(text);
      console.log(`${type} copied!`);
      addHistoryEntry({
        toolName: metadata.title, toolRoute: '/t/crypto-wallet-generator',
        action: actionPrefix, input: type, output: 'Copied successfully', status: 'success',
      });
      // TODO: Add visual feedback
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Clipboard write failed.';
      console.error(`Failed to copy ${type}:`, err);
      setError(`Failed to copy ${type}: ${message}`);
       addHistoryEntry({
         toolName: metadata.title, toolRoute: '/t/crypto-wallet-generator',
         action: `${actionPrefix}-failed`, input: type, output: `Copy Error: ${message}`, status: 'error',
       });
    }
  }, [addHistoryEntry]);

  // --- JSX ---
  return (
    <div className="p-0"> {/* Layout provides padding */}
      <ToolHeader
        title={metadata.title}
        description={metadata.description}
      />

      <div className="space-y-6 text-[rgb(var(--color-text-base))]">

        {/* Security Warning */}
        <div role="alert" className="p-4 text-sm rounded-lg bg-[rgb(var(--color-indicator-ambiguous)/0.1)] border border-[rgb(var(--color-indicator-ambiguous)/0.5)] text-[rgb(var(--color-text-muted))]">
           <strong className="font-medium text-[rgb(var(--color-text-base))]">⚠️ Security Warning:</strong> Generating keys in a browser is **NOT** recommended for storing significant value. Use dedicated hardware or software wallets for main funds. These generated keys are best for testing or learning purposes only. Always back up private keys securely offline and never share them.
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-center p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
          <fieldset className="flex-grow">
            <legend className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Select Wallet Type:</legend>
            <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
              {/* Ethereum Radio */}
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
              {/* Bitcoin Radio */}
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

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerateWallet}
            disabled={generating}
            className="inline-flex items-center rounded-md bg-[rgb(var(--color-button-primary-bg))] px-3 py-2 text-sm font-semibold text-[rgb(var(--color-button-primary-text))] shadow-sm hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {generating ? ( <><svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Generating...</> ) : ( 'Generate New Wallet' )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div role="alert" className="p-4 text-sm rounded-lg bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))]">
            <strong className="font-medium">⛔ Error:</strong> {error.replace('Error: ','')}
          </div>
        )}

        {/* Results Area */}
        {publicKey && privateKey && !error && (
          <div className="space-y-4 border border-[rgb(var(--color-border-base))] p-4 rounded-md bg-[rgb(var(--color-bg-component))]">
            <h2 className="text-lg font-semibold text-[rgb(var(--color-text-muted))]">Generated Wallet Details ({walletType.toUpperCase()})</h2>

            {/* Public Key / Address */}
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

            {/* Private Key */}
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
    </div>
  );
}