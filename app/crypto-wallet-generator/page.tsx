// /app/crypto-wallet-generator/page.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { useHistory } from '../context/HistoryContext'; // Adjust path if needed
import ClientOnly from '@/components/ClientOnly'; // Import the ClientOnly wrapper

// Crypto Libraries (ensure they are installed)
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';

// Shoelace components used (ensure base path/setup is correct in layout)
// These imports register the components
import '@shoelace-style/shoelace/dist/components/radio-group/radio-group.js';
import '@shoelace-style/shoelace/dist/components/radio/radio.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/alert/alert.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/copy-button/copy-button.js';

// Initialize ECPair for bitcoinjs-lib
const ECPair = ECPairFactory(tinysecp);

type WalletType = 'ethereum' | 'bitcoin';

export default function CryptoWalletGeneratorPage() {
  const [walletType, setWalletType] = useState<WalletType>('ethereum');
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null); // For ETH, this is the address
  const [isPrivateKeyVisible, setIsPrivateKeyVisible] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<boolean>(false); // Basic loading state

  const { addHistoryEntry } = useHistory();

  const handleGenerateWallet = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setPrivateKey(null);
    setPublicKey(null);
    setIsPrivateKeyVisible(false); // Hide private key on new generation

    try {
      let generatedPrivateKey: string;
      let generatedPublicKey: string; // Actually Address for ETH, Address for BTC

      if (walletType === 'ethereum') {
        const wallet = ethers.Wallet.createRandom();
        generatedPrivateKey = wallet.privateKey;
        generatedPublicKey = wallet.address; // Use address as the "public" identifier
        console.log('Generated ETH Wallet:', { address: generatedPublicKey, pk: generatedPrivateKey });
      } else if (walletType === 'bitcoin') {
        // Generate a random key pair (defaults to compressed)
        const keyPair = ECPair.makeRandom();
        generatedPrivateKey = keyPair.toWIF(); // Wallet Import Format

        // Generate P2PKH address (most common legacy/compatible type)
        const { address } = bitcoin.payments.p2pkh({ pubkey: Buffer.from(keyPair.publicKey) });
        if (!address) {
            throw new Error('Failed to generate Bitcoin address.');
        }
        generatedPublicKey = address;
        console.log('Generated BTC Wallet:', { address: generatedPublicKey, pk_wif: generatedPrivateKey });
      } else {
        throw new Error('Invalid wallet type selected.');
      }

      setPrivateKey(generatedPrivateKey);
      setPublicKey(generatedPublicKey);

      // Add to history - ONLY log public key/address
      addHistoryEntry({
        toolName: 'Wallet Generator',
        toolRoute: '/crypto-wallet-generator', // Ensure route matches file path if needed
        action: `generate-${walletType}`,
        input: { type: walletType },
        output: generatedPublicKey, // Log the public address/identifier
        status: 'success',
        // DO NOT LOG THE PRIVATE KEY
      });

    } catch (err: any) {
      console.error('Error generating wallet:', err);
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(`Error: ${message}`);
      // Optionally log error to history
      addHistoryEntry({
        toolName: 'Wallet Generator',
        toolRoute: '/crypto-wallet-generator', // Ensure route matches file path if needed
        action: `generate-${walletType}`,
        input: { type: walletType },
        output: `Error: ${message}`,
        status: 'error',
      });
    } finally {
      setGenerating(false);
    }
  }, [walletType, addHistoryEntry]);

  const handleTypeChange = (event: any /* SlChangeEvent */) => {
    // Reset on type change
    setWalletType((event.target as HTMLInputElement).value as WalletType);
    setPrivateKey(null);
    setPublicKey(null);
    setError(null);
    setIsPrivateKeyVisible(false);
  };

  const togglePrivateKeyVisibility = () => {
    setIsPrivateKeyVisible(!isPrivateKeyVisible);
  };

  return (
    <div className="space-y-6">
      {/* Non-Shoelace content can render immediately */}
      <h1 className="text-2xl font-bold text-gray-800">Wallet Generator</h1>
      <p className="text-gray-600 mb-4">
        Generate new cryptocurrency wallet keys client-side.
      </p>

      {/* Wrap all Shoelace-dependent UI in ClientOnly */}
      <ClientOnly>
        {/* Security Warning */}
        <sl-alert variant="warning" open class="mb-4">
          <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
          <strong>Security Warning:</strong> Generating keys in a web browser is convenient but less secure than offline methods. Do not use these keys for significant amounts. Always back up your private key securely offline and never share it. Be aware of potential malware or browser extensions that could compromise your keys.
        </sl-alert>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-center p-3 rounded-md bg-gray-50 border border-gray-200">
          <sl-radio-group
            label="Select Wallet Type:"
            value={walletType}
            onSlChange={handleTypeChange}
            class="flex-grow"
            name="walletType"
          >
            <sl-radio value="ethereum" class="mr-4">Ethereum (ETH)</sl-radio>
            <sl-radio value="bitcoin">Bitcoin (BTC)</sl-radio>
          </sl-radio-group>

          <sl-button
            variant="primary"
            onClick={handleGenerateWallet}
            loading={generating} // Show loading state on button
            disabled={generating}
            class="flex-shrink-0"
          >
            {generating ? 'Generating...' : 'Generate New Wallet'}
          </sl-button>
        </div>

        {/* Error Display */}
        {error && (
           <sl-alert variant="danger" open closable onSlAfterHide={() => setError(null)}>
               <sl-icon slot="icon" name="exclamation-octagon"></sl-icon>
               {error}
           </sl-alert>
        )}

        {/* Results Area - Conditionally rendered based on state */}
        {/* This condition now happens *inside* ClientOnly, which is fine */}
        {publicKey && privateKey && !error && (
          <div className="space-y-4 border border-gray-200 p-4 rounded-md">
            <h2 className="text-lg font-semibold text-gray-700">Generated Wallet Details ({walletType.toUpperCase()})</h2>

            {/* Public Key / Address */}
            <div>
              <sl-input
                label={walletType === 'ethereum' ? 'Address' : 'Bitcoin Address (P2PKH)'}
                value={publicKey}
                readonly
                class="input-display" // Add a class for potential shared styling
              >
                <sl-copy-button
                  slot="label"
                  value={publicKey}
                  copy-label="Copy Address"
                  success-label="Address Copied!"
                  error-label="Error Copying"
                  style={{ marginLeft: '8px' }}
                  title="Copy public address"
                ></sl-copy-button>
              </sl-input>
               <div className="text-xs text-gray-500 mt-1">This is your public identifier, safe to share.</div>
            </div>

            {/* Private Key */}
            <div>
              <sl-input
                label={`Private Key (${walletType === 'bitcoin' ? 'WIF format' : 'Hex'})`}
                value={isPrivateKeyVisible ? privateKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                readonly
                class="input-display font-mono" // Use mono font for keys
              >
                 {/* Visibility Toggle Button */}
                 <sl-icon-button
                   name={isPrivateKeyVisible ? 'eye-slash' : 'eye'}
                   label={isPrivateKeyVisible ? 'Hide Private Key' : 'Show Private Key'}
                   slot="suffix"
                   onClick={togglePrivateKeyVisibility}
                   title={isPrivateKeyVisible ? 'Hide Private Key' : 'Show Private Key'}
                 ></sl-icon-button>

                 {/* Copy Button */}
                 <sl-copy-button
                   slot="suffix"
                   value={privateKey} // Ensure privateKey is not null here due to outer condition
                   copy-label="Copy Private Key"
                   success-label="Private Key Copied!"
                   error-label="Error Copying"
                   title="Copy private key (Use with extreme caution!)"
                   style={{ marginLeft: '4px' }}
                 ></sl-copy-button>
              </sl-input>
              <div className="text-xs text-red-600 font-semibold mt-1">NEVER share this private key! Keep it safe and secret.</div>
            </div>

          </div>
        )}
      </ClientOnly> {/* End of ClientOnly wrapper */}
    </div>
  );
}