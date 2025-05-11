// FILE: app/tool/emoji-explorer/[emojiSlug]/page.tsx
import React from 'react';
import { getEmojis, RichEmojiData } from '@/src/constants/emojis';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import EmojiSearchClient from '../_components/EmojiExplorerClient';
import { notFound } from 'next/navigation';
import metadata from '../metadata.json'; // For toolTitle in this server component
import type { Metadata } from 'next'; // Import Next's Metadata type

// Define the shape of the params object directly
interface PageParams {
  emojiSlug: string;
}

// Props for the Page component
interface SingleEmojiPageProps {
  params: PageParams;
}

// Props for generateMetadata
interface GenerateMetadataProps {
  params: PageParams;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export async function generateStaticParams(): Promise<PageParams[]> {
  const emojis = getEmojis();
  if (!emojis || emojis.length === 0) return [];
  return emojis.map((emoji) => ({
    emojiSlug: generateSlug(emoji.name),
  }));
}

// Use the GenerateMetadataProps and explicitly return Promise<Metadata>
export async function generateMetadata({
  params,
}: GenerateMetadataProps): Promise<Metadata> {
  const emojis = getEmojis();
  const emoji = emojis.find((e) => generateSlug(e.name) === params.emojiSlug);
  if (!emoji) {
    return { title: 'Emoji Not Found | OET' };
  }
  return {
    title: `${emoji.emoji} ${emoji.name} | Emoji Explorer | OET`,
    description: `Details, codepoints, and usage for the ${emoji.name} emoji (${emoji.emoji}). Explore this and thousands more.`,
    openGraph: {
      title: `${emoji.emoji} ${emoji.name} | OET Emoji Explorer`,
      description: `All about the ${emoji.name} emoji.`,
    },
  };
}

// Use the SingleEmojiPageProps
export default async function SingleEmojiPage({
  params,
}: SingleEmojiPageProps) {
  const { emojiSlug } = params;
  const allEmojis = getEmojis();

  const featuredEmoji = allEmojis.find(
    (e) => generateSlug(e.name) === emojiSlug
  );

  if (!featuredEmoji) {
    notFound();
  }

  const toolTitle = metadata.title || 'Emoji Explorer';
  const toolRoute = '/tool/emoji-explorer';

  return (
    <div className="relative flex flex-col gap-6">
      <ToolSettings toolRoute={toolRoute} />
      <ToolHeader title={toolTitle} description={metadata.description || ''} />
      <EmojiSearchClient
        initialEmojis={allEmojis ?? []}
        featuredEmoji={featuredEmoji}
      />
    </div>
  );
}
