// FILE: app/lib/directives/crypto-wallet-generator.ts
import { getDisplayInfoForFilePreview } from '@/app/lib/utils';
import { CustomRecentActivityPreviewFn } from '@/src/types/tools';

export const getRecentActivityPreview: CustomRecentActivityPreviewFn = (
  currentState,
  metadata
) => {
  const displayInfo = getDisplayInfoForFilePreview(
    'application/octet-stream',
    'Wallet Data'
  );
  return {
    previewType: 'icon',
    previewIconClassContent: displayInfo.iconName,
    displayableItemName: 'Wallet Activity',
    previewSource: 'custom',
  };
};
