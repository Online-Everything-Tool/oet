// FILE: app/t/crypto-wallet-generator/page.tsx
import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import CryptoWalletGeneratorClient from './_components/CryptoWalletGeneratorClient';

export default function CryptoWalletGeneratorPage() {
  const toolTitle = metadata.title || "Crypto Wallet Generator";
  const toolRoute = "/t/crypto-wallet-generator";

  return (
    <div className="flex flex-col gap-6">
      <ToolHeader
        title={toolTitle}
        description={metadata.description || ""}
      />
      <ToolSuspenseWrapper>
        <CryptoWalletGeneratorClient
            toolTitle={toolTitle}
            toolRoute={toolRoute}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}