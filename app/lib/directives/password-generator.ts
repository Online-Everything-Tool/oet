// FILE: app/lib/directives/password-generator.ts
import { getDisplayInfoForFilePreview } from '@/app/lib/utils';
import { CustomRecentActivityPreviewFn } from '@/src/types/tools';

export const getRecentActivityPreview: CustomRecentActivityPreviewFn = (
  currentState,
  metadata
) => {
  const displayInfo = getDisplayInfoForFilePreview(
    'application/pgp-keys',
    'Generated Password'
  );

  return {
    previewType: 'icon',
    previewIconClassContent: displayInfo.iconName,
    displayableItemName: 'Password Activity',

    previewSource: 'custom',
  };
};
