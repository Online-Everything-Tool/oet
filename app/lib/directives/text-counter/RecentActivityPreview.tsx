// FILE: app/lib/directives/text-counter.ts

import { getDisplayInfoForFilePreview } from '@/app/lib/utils';
import { CustomRecentActivityPreviewFn } from '@/src/types/tools';

export const getRecentActivityPreview: CustomRecentActivityPreviewFn = (
  currentState,
  metadata
) => {
  const displayInfo = getDisplayInfoForFilePreview(
    'application/vnd.oasis.opendocument.text',
    'Text Analysis'
  );
  return {
    previewType: 'icon',
    previewIconClassContent: displayInfo.iconName,
    displayableItemName: 'Text Count Activity',
    previewSource: 'custom',
  };
};
