// FILE: app/tool/crypto-wallet-generator/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import CryptoWalletGeneratorClient from './_components/CryptoWalletGeneratorClient';
import { ParamConfig, ToolMetadata } from '@/src/types/tools';

export default function CryptoWalletGeneratorPage() {
  const typedMetadata = metadata as ToolMetadata;
  const urlStateParams = (typedMetadata.urlStateParams || []) as ParamConfig[];
  const toolTitle = metadata.title || 'Crypto Wallet Generator';
  const toolRoute = '/tool/crypto-wallet-generator';

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolRoute={toolRoute} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <ToolSuspenseWrapper>
        <CryptoWalletGeneratorClient
          toolRoute={toolRoute}
          urlStateParams={urlStateParams}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}
