// /app/t/crypto-wallet-generator/page.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { useHistory } from '../../context/HistoryContext'; // Adjust path if needed

// Crypto Libraries
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';

// Initialize ECPair for bitcoinjs-lib
const ECPair = ECPairFactory(tinysecp);

type WalletType = 'ethereum' | 'bitcoin';

export default function CryptoWalletGeneratorPage() {
  const [walletType, setWalletType] = useState<WalletType>('ethereum');
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null); // For ETH, this is the address; for BTC, address
  const [isPrivateKeyVisible, setIsPrivateKeyVisible] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<boolean>(false);

  const { addHistoryEntry } = useHistory();

  const handleGenerateWallet = useCallback(async () => {
    console.log("[HTML Version] Attempting to generate wallet. Current walletType state:", walletType);

    setGenerating(true);
    setError(null);
    setPrivateKey(null);
    setPublicKey(null);
    setIsPrivateKeyVisible(false); // Reset visibility on new generation

    try {
      let generatedPrivateKey: string;
      let generatedPublicKey: string; // Will hold address for both types

      if (walletType === 'ethereum') {
        console.log("[HTML Version] Executing Ethereum generation block.");
        const wallet = ethers.Wallet.createRandom();
        generatedPrivateKey = wallet.privateKey;
        generatedPublicKey = wallet.address; // Ethereum address
        console.log('[HTML Version] Generated ETH Wallet:', { address: generatedPublicKey });
      } else if (walletType === 'bitcoin') {
        console.log("[HTML Version] Executing Bitcoin generation block.");
        const keyPair = ECPair.makeRandom();
        generatedPrivateKey = keyPair.toWIF(); // Wallet Import Format for private key
        // Generate P2PKH address (most common legacy address type)
        const { address } = bitcoin.payments.p2pkh({ pubkey: Buffer.from(keyPair.publicKey) });
        if (!address) {
            throw new Error('Failed to generate Bitcoin address.');
        }
        generatedPublicKey = address; // Bitcoin address
        console.log('[HTML Version] Generated BTC Wallet:', { address: generatedPublicKey });
      } else {
        // This case should ideally not be reachable if UI controls are correct
        console.log("[HTML Version] Executing ELSE block (Invalid type).");
        throw new Error('Invalid wallet type selected.');
      }

      setPrivateKey(generatedPrivateKey);
      setPublicKey(generatedPublicKey); // Set the derived address

      // Add successful generation to history (omits private key for security)
      addHistoryEntry({
        toolName: 'Wallet Generator',
        toolRoute: '/t/crypto-wallet-generator', // Corrected path
        action: `generate-${walletType}`,
        input: { type: walletType }, // Log the type generated
        output: generatedPublicKey, // Log the public address
        status: 'success',
      });
    } catch (err: unknown) { // Use unknown for the caught error
      console.error('[HTML Version] Error generating wallet:', err);
      // Safely get error message
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(`Error: ${message}`);

      // Add error to history (omits private key)
      addHistoryEntry({
        toolName: 'Wallet Generator',
        toolRoute: '/t/crypto-wallet-generator', // Corrected path
        action: `generate-${walletType}`,
        input: { type: walletType },
        output: `Error: ${message}`, // Log the error message
        status: 'error',
      });
    } finally {
      setGenerating(false); // Ensure loading state is always reset
    }
  }, [walletType, addHistoryEntry]); // Dependencies for the callback

  // Handler for standard HTML radio button changes
  const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newType = event.target.value as WalletType;
    console.log("[HTML Version] Wallet type selected via UI:", newType);
    setWalletType(newType);
    // Reset state when type changes
    setPrivateKey(null);
    setPublicKey(null);
    setError(null);
    setIsPrivateKeyVisible(false);
  };

  // Toggle visibility of the private key
  const togglePrivateKeyVisibility = () => {
    setIsPrivateKeyVisible(prev => !prev); // Use functional update for toggle
  };

  // Basic copy to clipboard function
  const copyToClipboard = useCallback(async (text: string | null, type: string) => {
    if (!text) return; // Do nothing if text is null/empty
    try {
      await navigator.clipboard.writeText(text);
      console.log(`${type} copied to clipboard!`);
      // Add history entry for copy action
      addHistoryEntry({
        toolName: 'Wallet Generator',
        toolRoute: '/t/crypto-wallet-generator',
        action: `copy-${type.toLowerCase().replace(' ', '-')}`, // e.g., copy-address, copy-private-key
        input: type, // Log what was copied
        output: 'Copied successfully',
        status: 'success',
      });
      // TODO: Add brief visual feedback (e.g., change button text to "Copied!")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Clipboard write failed.';
      console.error(`Failed to copy ${type}:`, err);
      setError(`Failed to copy ${type}: ${message}`); // Show error to user
       addHistoryEntry({
        toolName: 'Wallet Generator',
        toolRoute: '/t/crypto-wallet-generator',
        action: `copy-${type.toLowerCase().replace(' ', '-')}-failed`,
        input: type,
        output: `Copy Error: ${message}`,
        status: 'error',
      });
    }
  }, [addHistoryEntry]); // Dependency

  // --- JSX Structure ---
  return (
    <div className="space-y-6 p-4"> {/* Added padding */}
      <h1 className="text-2xl font-bold text-gray-800">Wallet Generator</h1>
      <p className="text-gray-600 mb-4">
        Generate new cryptocurrency wallet keys client-side.
      </p>

      {/* Security Warning */}
      <div role="alert" className="p-4 mb-4 text-sm text-yellow-800 rounded-lg bg-yellow-50 border border-yellow-300">
         <span className="font-medium">⚠️ Security Warning:</span> Generating keys in a browser is **NOT** recommended for storing significant value. Use dedicated hardware or software wallets for main funds. These generated keys are best for testing or learning purposes only. Always back up private keys securely offline and never share them.
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center p-3 rounded-md bg-gray-50 border border-gray-200">
        <fieldset className="flex-grow">
          <legend className="block text-sm font-medium text-gray-700 mb-1">Select Wallet Type:</legend>
          <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
            {/* Ethereum Radio */}
            <div className="flex items-center">
              <input
                id="type-ethereum" name="walletType" type="radio" value="ethereum"
                checked={walletType === 'ethereum'} onChange={handleTypeChange}
                className="h-4 w-4 border-gray-300 text-[#900027] focus:ring-[#7a0021]" // Use theme color
              />
              <label htmlFor="type-ethereum" className="ml-2 block text-sm font-medium leading-6 text-gray-900">
                Ethereum (ETH & EVM)
              </label>
            </div>
            {/* Bitcoin Radio */}
            <div className="flex items-center">
              <input
                id="type-bitcoin" name="walletType" type="radio" value="bitcoin"
                checked={walletType === 'bitcoin'} onChange={handleTypeChange}
                className="h-4 w-4 border-gray-300 text-[#900027] focus:ring-[#7a0021]" // Use theme color
              />
              <label htmlFor="type-bitcoin" className="ml-2 block text-sm font-medium leading-6 text-gray-900">
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
          className="inline-flex items-center rounded-md bg-[#900027] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#7a0021] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#900027] disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0" // Use theme color
        >
          {generating ? ( /* Loading Spinner SVG */ <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Generating...</> ) : ( 'Generate New Wallet' )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div role="alert" className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 border border-red-300">
          <span className="font-medium">⛔ Error:</span> {error.replace('Error: ','')}
        </div>
      )}

      {/* Results Area */}
      {publicKey && privateKey && !error && (
        <div className="space-y-4 border border-gray-200 p-4 rounded-md">
          <h2 className="text-lg font-semibold text-gray-700">Generated Wallet Details ({walletType.toUpperCase()})</h2>

          {/* Public Key / Address */}
          <div>
            <label htmlFor="publicKeyOutput" className="block text-sm font-medium leading-6 text-gray-900">
              {walletType === 'ethereum' ? 'Address' : 'Bitcoin Address (P2PKH)'}
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
               <input
                  id="publicKeyOutput" type="text" value={publicKey} readOnly
                  className="block w-full flex-1 rounded-none rounded-l-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-none sm:text-sm sm:leading-6 bg-gray-100" // Use bg-gray-100 for readonly
               />
               <button
                  type="button" onClick={() => copyToClipboard(publicKey, 'Address')} title="Copy public address"
                  className="relative -ml-px inline-flex items-center gap-x-1.5 rounded-r-md px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-100 focus:outline-none focus:z-10" // Added focus:z-10
               > 📋 Copy </button>
            </div>
             <p className="mt-1 text-xs text-gray-500">This is your public identifier, safe to share.</p>
          </div>

          {/* Private Key */}
          <div>
             <label htmlFor="privateKeyOutput" className="block text-sm font-medium leading-6 text-gray-900">
               Private Key ({walletType === 'bitcoin' ? 'WIF' : 'Hex'})
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
               <input
                  id="privateKeyOutput"
                  type={isPrivateKeyVisible ? 'text' : 'password'}
                  value={privateKey} readOnly
                  className="block w-full flex-1 rounded-none rounded-l-md border-0 py-1.5 font-mono text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-none sm:text-sm sm:leading-6 bg-gray-100" // Use bg-gray-100
               />
                <button
                  type="button" onClick={togglePrivateKeyVisibility} title={isPrivateKeyVisible ? 'Hide Private Key' : 'Show Private Key'}
                  className="relative -ml-px inline-flex items-center gap-x-1.5 rounded-none px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-100 focus:outline-none focus:z-10" // Added focus:z-10
               > {isPrivateKeyVisible ? '👁️ Hide' : '👁️ Show'} </button>
               <button
                  type="button" onClick={() => copyToClipboard(privateKey, 'Private Key')} title="Copy private key (Use with extreme caution!)"
                  className="relative -ml-px inline-flex items-center gap-x-1.5 rounded-r-md px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-100 focus:outline-none focus:z-10" // Added focus:z-10
               > 📋 Copy </button>
            </div>
            <p className="mt-1 text-xs text-red-600 font-semibold">NEVER share this private key! Keep it safe and secret.</p>
          </div>
        </div>
      )}
    </div>
  );
}