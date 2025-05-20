// /app/tool/emoji-explorer/page.tsx
import React from 'react';
import EmojiSearchClient from './_components/EmojiExplorerClient';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import metadata from './metadata.json';

import { getEmojis, RichEmojiData } from '@/src/constants/emojis';
import { ToolMetadata } from '@/src/types/tools';

export default async function EmojiExplorerPage() {
  const typedMetadata = metadata as ToolMetadata;
  const allEmojis: RichEmojiData[] = await getEmojis();
  const toolTitle = metadata.title || 'Emoji Explorer';

  return (
    <div className="relative p-0">
      <ToolSettings toolMetadata={typedMetadata} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <EmojiSearchClient initialEmojis={allEmojis ?? []} />
    </div>
  );
}
