// FILE: app/tool/crypto-wallet-generator/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import CryptoWalletGeneratorClient from './_components/CryptoWalletGeneratorClient';
import { ParamConfig, ToolMetadata } from '@/src/types/tools';
import { toolRoute } from '@/app/lib/utils';

export default function CryptoWalletGeneratorPage() {
  const typedMetadata = metadata as ToolMetadata;
  const urlStateParams = (typedMetadata.urlStateParams || []) as ParamConfig[];

  return (
    <div className="relative flex flex-col gap-4">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader toolMetadata={typedMetadata} />
      <ToolSuspenseWrapper>
        <CryptoWalletGeneratorClient
          urlStateParams={urlStateParams}
          toolRoute={toolRoute(typedMetadata)}
        />
      </ToolSuspenseWrapper>
    </div>
  );
}
