// /app/tool/emoji-explorer/page.tsx
import React from 'react';
import EmojiSearchClient from './_components/EmojiExplorerClient';
import ToolHeader from '../_components/ToolHeader';
import ToolSettings from '../_components/ToolSettings';
import metadata from './metadata.json';

import { getEmojis, RichEmojiData } from '@/src/constants/emojis';

export default async function EmojiExplorerPage() {
  const allEmojis: RichEmojiData[] = await getEmojis();
  const toolTitle = metadata.title || 'Emoji Explorer';
  const toolRoute = '/tool/emoji-explorer';
  return (
    <div className="relative p-0">
      <ToolSettings toolRoute={toolRoute} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <EmojiSearchClient initialEmojis={allEmojis ?? []} />
    </div>
  );
}
