import type { ToolMetadata } from '@/src/types/tools';
import type { RecentToolEntry } from '@/app/context/RecentlyUsedContext';

export type CustomRecentActivityPreviewFn = (
  currentState: Record<string, unknown>,
  metadata: ToolMetadata
) => Partial<RecentToolEntry> | null;

import { getRecentActivityPreview as crypto_wallet_generatorPreview } from './crypto-wallet-generator';
import { getRecentActivityPreview as password_generatorPreview } from './password-generator';
import { getRecentActivityPreview as text_counterPreview } from './text-counter';

export const directivePreviewFunctions: Record<
  string,
  CustomRecentActivityPreviewFn | undefined
> = {
  'crypto-wallet-generator': crypto_wallet_generatorPreview,
  'password-generator': password_generatorPreview,
  'text-counter': text_counterPreview,
};
