import type { ToolMetadata } from '@/src/types/tools';
import type { RecentToolEntry } from '@/app/context/RecentlyUsedContext'; // Adjust path

// Define the common signature for the preview functions in this file for clarity
export type CustomRecentActivityPreviewFn = (
  currentState: Record<string, unknown>,
  metadata: ToolMetadata
) => Partial<RecentToolEntry> | null;

import { getRecentActivityPreview as crypto_wallet_generatorPreview } from './crypto-wallet-generator';
import { getRecentActivityPreview as password_generatorPreview } from './password-generator';
import { getRecentActivityPreview as text_counterPreview } from './text-counter';

// Create a map of directive names to their preview functions
export const directivePreviewFunctions: Record<string, CustomRecentActivityPreviewFn | undefined> = {
  'crypto-wallet-generator': crypto_wallet_generatorPreview,
  'password-generator': password_generatorPreview,
  'text-counter': text_counterPreview,
};
