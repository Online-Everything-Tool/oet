// FILE: app/t/crypto-wallet-generator/_components/CryptoWalletGeneratorClient.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { useHistory, TriggerType } from '../../../context/HistoryContext';
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';
import { Keypair } from '@solana/web3.js';
import { v4 as uuidv4 } from 'uuid';

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

interface CryptoWalletGeneratorClientProps {
  toolTitle: string;
  toolRoute: string;
}

export default function CryptoWalletGeneratorClient({
  toolTitle,
  toolRoute
}: CryptoWalletGeneratorClientProps) {
  const [walletType, setWalletType] = useState<WalletType>('ethereum');
  const [generatedWallets, setGeneratedWallets] = useState<WalletEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<boolean>(false);
  const [lastCopiedId, setLastCopiedId] = useState<string | null>(null);

  const { addHistoryEntry } = useHistory();

  const toggleSpecificPrivateKeyVisibility = (id: string) => {
    setGeneratedWallets(prevWallets =>
      prevWallets.map(wallet =>
        wallet.id === id
          ? { ...wallet, isPrivateKeyVisible: !wallet.isPrivateKeyVisible }
          : wallet
      )
    );
    // No history log for visibility toggle
  };

  const handleGenerateWallet = useCallback(async () => {
    // console.log("Attempting to generate wallet. Type:", walletType);
    setGenerating(true);
    setError(null);

    let newWalletEntry: WalletEntry | null = null;
    let generatedPublicKey: string = '';
    let generatedPrivateKey: string = '';
    let privateKeyFormatNote: string | undefined = undefined;
    let status: 'success' | 'error' = 'success';
    let errorMessage = '';
    const inputDetails = { walletType: walletType };

    try {
      if (walletType === 'ethereum') {
        const wallet = ethers.Wallet.createRandom();
        generatedPrivateKey = wallet.privateKey;
        generatedPublicKey = wallet.address;
      } else if (walletType === 'bitcoin') {
        const keyPair = ECPair.makeRandom();
        generatedPrivateKey = keyPair.toWIF();
        const { address } = bitcoin.payments.p2pkh({ pubkey: Buffer.from(keyPair.publicKey) });
        if (!address) throw new Error('Failed to generate Bitcoin P2PKH address.');
        generatedPublicKey = address;
      } else if (walletType === 'solana') {
        const keypair = Keypair.generate();
        generatedPublicKey = keypair.publicKey.toBase58();
        generatedPrivateKey = ethers.encodeBase58(keypair.secretKey);
        privateKeyFormatNote = "Base58 encoded secret key bytes (NOT a mnemonic phrase)";
      } else {
        throw new Error('Invalid wallet type selected.');
      }

      newWalletEntry = {
        id: uuidv4(),
        type: walletType,
        privateKey: generatedPrivateKey,
        publicKey: generatedPublicKey,
        isPrivateKeyVisible: false,
        timestamp: Date.now(),
        privateKeyFormatNote: privateKeyFormatNote,
      };

      setGeneratedWallets(prev => [newWalletEntry!, ...prev]);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      console.error('Error generating wallet:', err);
      errorMessage = `Error: ${message}`;
      setError(errorMessage);
      status = 'error';
      (inputDetails as Record<string, unknown>).error = errorMessage;
    } finally {
      setGenerating(false);
      // Log ONLY the generation action
      addHistoryEntry({
        toolName: toolTitle, toolRoute: toolRoute,
        trigger: 'click',
        input: inputDetails,
        output: status === 'success' ? `Generated ${walletType}: ${generatedPublicKey}` : errorMessage,
        status: status,
      });
    }
  }, [walletType, addHistoryEntry, toolTitle, toolRoute]);

  const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newType = event.target.value as WalletType;
    setWalletType(newType);
    setError(null);
  };

  // --- UPDATED copyToClipboard to REMOVE history logging ---
  const copyToClipboard = useCallback(async (textToCopy: string, copyType: 'Address' | 'Private Key', walletId: string) => {
    setLastCopiedId(null);
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      // console.log(`${copyType} copied!`); // Keep for debug if needed
      setLastCopiedId(`${walletId}-${copyType}`);
      setTimeout(() => setLastCopiedId(null), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Clipboard write failed.';
      console.error(`Failed to copy ${copyType}:`, err);
      setError(`Failed to copy ${copyType}: ${message}`);
      // History logging removed
    }
    // History logging removed from finally block too
  }, []); // Removed generatedWallets, history dependencies if only used for logging
  // --- END UPDATE ---

  const handleClearAllWallets = useCallback(() => {
    setGeneratedWallets([]);
    setError(null);
    // No history log for clear
  }, []);


  return (
    // --- JSX Unchanged ---
    <div className="space-y-6 text-[rgb(var(--color-text-base))]">
        <div role="alert" className="p-4 text-sm rounded-lg bg-[rgb(var(--color-indicator-ambiguous)/0.1)] border border-[rgb(var(--color-indicator-ambiguous)/0.5)] text-[rgb(var(--color-text-muted))]">
           <strong className="font-medium text-[rgb(var(--color-text-base))]">⚠️ Security Warning:</strong> Generating keys in a browser is **NOT** recommended for storing significant value. Use dedicated hardware or software wallets for main funds. These generated keys are best for testing or learning purposes only. Always back up private keys securely offline and never share them.
        </div>

        <div className="flex flex-wrap gap-4 items-center p-3 rounded-md bg-[rgb(var(--color-bg-subtle))] border border-[rgb(var(--color-border-base))]">
          <fieldset className="flex-grow">
            <legend className="block text-sm font-medium text-[rgb(var(--color-text-muted))] mb-1">Select Wallet Type:</legend>
            <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
              <div className="flex items-center">
                <input id="type-ethereum" name="walletType" type="radio" value="ethereum" checked={walletType === 'ethereum'} onChange={handleTypeChange} className="h-4 w-4 border-[rgb(var(--color-border-base))] text-[rgb(var(--color-button-primary-bg))] focus:outline-none accent-[rgb(var(--color-button-primary-bg))]"/>
                <label htmlFor="type-ethereum" className="ml-2 block text-sm font-medium text-[rgb(var(--color-text-base))] cursor-pointer">Ethereum (EVM)</label>
              </div>
              <div className="flex items-center">
                <input id="type-bitcoin" name="walletType" type="radio" value="bitcoin" checked={walletType === 'bitcoin'} onChange={handleTypeChange} className="h-4 w-4 border-[rgb(var(--color-border-base))] text-[rgb(var(--color-button-primary-bg))] focus:outline-none accent-[rgb(var(--color-button-primary-bg))]"/>
                <label htmlFor="type-bitcoin" className="ml-2 block text-sm font-medium text-[rgb(var(--color-text-base))] cursor-pointer">Bitcoin (BTC)</label>
              </div>
               <div className="flex items-center">
                <input id="type-solana" name="walletType" type="radio" value="solana" checked={walletType === 'solana'} onChange={handleTypeChange} className="h-4 w-4 border-[rgb(var(--color-border-base))] text-[rgb(var(--color-button-primary-bg))] focus:outline-none accent-[rgb(var(--color-button-primary-bg))]"/>
                <label htmlFor="type-solana" className="ml-2 block text-sm font-medium text-[rgb(var(--color-text-base))] cursor-pointer">Solana (SOL)</label>
              </div>
            </div>
          </fieldset>

          <button type="button" onClick={handleGenerateWallet} disabled={generating} className="inline-flex items-center rounded-md bg-[rgb(var(--color-button-primary-bg))] px-3 py-2 text-sm font-semibold text-[rgb(var(--color-button-primary-text))] shadow-sm hover:bg-[rgb(var(--color-button-primary-hover-bg))] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
            {generating ? ( <><svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Generating...</> ) : ( 'Generate New Wallet' )}
          </button>
            <button type="button" onClick={handleClearAllWallets} disabled={generating || generatedWallets.length === 0} title="Clear all generated wallets" className="inline-flex items-center rounded-md bg-[rgb(var(--color-button-neutral-bg))] px-3 py-2 text-sm font-semibold text-[rgb(var(--color-button-neutral-text))] shadow-sm hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
               Clear All
           </button>
        </div>

        {error && (
          <div role="alert" className="p-4 text-sm rounded-lg bg-[rgb(var(--color-bg-error-subtle))] border border-[rgb(var(--color-border-error))] text-[rgb(var(--color-text-error))]">
            <strong className="font-medium">⛔ Error:</strong> {error.replace('Error: ','')}
          </div>
        )}

        <div className="space-y-4">
            {generatedWallets.length > 0 && (
                <h2 className="text-lg font-semibold text-[rgb(var(--color-text-muted))] border-b border-[rgb(var(--color-border-base))] pb-2">
                    Generated Wallets ({generatedWallets.length})
                </h2>
            )}
            {generatedWallets.map((wallet) => {
                 const isPublicKeyCopied = lastCopiedId === `${wallet.id}-Address`;
                 const isPrivateKeyCopied = lastCopiedId === `${wallet.id}-Private Key`;
                let addressLabel = 'Address';
                if(wallet.type === 'bitcoin') addressLabel = 'Bitcoin Address (P2PKH)';
                if(wallet.type === 'solana') addressLabel = 'Solana Address (Base58)';

                let privateKeyLabel = 'Private Key';
                 if(wallet.type === 'bitcoin') privateKeyLabel = 'Private Key (WIF)';
                 if(wallet.type === 'solana') privateKeyLabel = 'Private Key (Bytes, Base58)';

                 return (
                    <div key={wallet.id} className="space-y-4 border border-[rgb(var(--color-border-base))] p-4 rounded-md bg-[rgb(var(--color-bg-component))] shadow-sm animate-slide-down">
                        <h3 className="text-md font-medium text-[rgb(var(--color-text-base))] flex justify-between items-center">
                           <span>{wallet.type.charAt(0).toUpperCase() + wallet.type.slice(1)} Wallet</span>
                           <span className='text-xs font-normal text-gray-400'>Generated: {new Date(wallet.timestamp).toLocaleString()}</span>
                        </h3>
                        <div>
                           <label htmlFor={`publicKeyOutput-${wallet.id}`} className="block text-sm font-medium leading-6 text-[rgb(var(--color-text-base))]">
                             {addressLabel}
                           </label>
                           <div className="mt-1 flex rounded-md shadow-sm border border-[rgb(var(--color-input-border))]">
                              <input id={`publicKeyOutput-${wallet.id}`} type="text" value={wallet.publicKey} readOnly className="block w-full flex-1 rounded-l-md py-1.5 px-2 text-[rgb(var(--color-input-text))] focus:outline-none sm:text-sm sm:leading-6 bg-[rgb(var(--color-bg-subtle))]"/>
                              <button type="button" onClick={() => copyToClipboard(wallet.publicKey, 'Address', wallet.id)} title="Copy public address" className={`relative inline-flex items-center gap-x-1.5 rounded-r-md px-3 py-2 text-sm font-semibold border-l border-[rgb(var(--color-input-border))] focus:outline-none focus:z-10 transition-colors duration-150 ${isPublicKeyCopied ? 'bg-green-500 text-white hover:bg-green-600' : 'text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))]'} `}> {isPublicKeyCopied ? 'Copied!' : 'Copy'} </button>
                           </div>
                            <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">This is your public identifier, safe to share.</p>
                         </div>
                         <div>
                            <label htmlFor={`privateKeyOutput-${wallet.id}`} className="block text-sm font-medium leading-6 text-[rgb(var(--color-text-base))]">
                              {privateKeyLabel}
                           </label>
                           <div className="mt-1 flex rounded-md shadow-sm border border-[rgb(var(--color-input-border))]">
                              <input id={`privateKeyOutput-${wallet.id}`} type={wallet.isPrivateKeyVisible ? 'text' : 'password'} value={wallet.privateKey} readOnly className="block w-full flex-1 rounded-l-md py-1.5 px-2 font-mono text-[rgb(var(--color-input-text))] focus:outline-none sm:text-sm sm:leading-6 bg-[rgb(var(--color-bg-subtle))]"/>
                               <button type="button" onClick={() => toggleSpecificPrivateKeyVisibility(wallet.id)} title={wallet.isPrivateKeyVisible ? 'Hide Private Key' : 'Show Private Key'} className="relative inline-flex items-center gap-x-1.5 rounded-none px-3 py-2 text-sm font-semibold text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] border-l border-[rgb(var(--color-input-border))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none focus:z-10"> {wallet.isPrivateKeyVisible ? 'Hide' : 'Show'} </button>
                              <button type="button" onClick={() => copyToClipboard(wallet.privateKey, 'Private Key', wallet.id)} title="Copy private key (Use with extreme caution!)" className={`relative inline-flex items-center gap-x-1.5 rounded-r-md px-3 py-2 text-sm font-semibold border-l border-[rgb(var(--color-input-border))] focus:outline-none focus:z-10 transition-colors duration-150 ${isPrivateKeyCopied ? 'bg-green-500 text-white hover:bg-green-600' : 'text-[rgb(var(--color-button-neutral-text))] bg-[rgb(var(--color-button-neutral-bg))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))]'} `}> {isPrivateKeyCopied ? 'Copied!' : 'Copy'} </button>
                           </div>
                           {wallet.privateKeyFormatNote && ( <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))] italic">{wallet.privateKeyFormatNote}</p> )}
                           <p className="mt-1 text-xs text-[rgb(var(--color-text-error))] font-semibold">NEVER share this private key! Keep it safe and secret.</p>
                         </div>
                    </div>
                 );
            })}
        </div>
    </div>
  );
}