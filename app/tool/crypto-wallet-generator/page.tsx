// FILE: app/tool/crypto-wallet-generator/page.tsx
import React from 'react';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings'; // Import ToolSettings
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../_components/ToolSuspenseWrapper';
import CryptoWalletGeneratorClient from './_components/CryptoWalletGeneratorClient';

export default function CryptoWalletGeneratorPage() {
  const toolTitle = metadata.title || "Crypto Wallet Generator";
  const toolRoute = "/tool/crypto-wallet-generator";

  return (
    // Add relative positioning for ToolSettings
    <div className="relative flex flex-col gap-6">
      {/* Render ToolSettings */}
      <ToolSettings toolRoute={toolRoute} />
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