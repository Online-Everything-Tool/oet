// FILE: app/tool/emoji-explorer/[emojiSlug]/page.tsx
import React from 'react';
import { getEmojis, RichEmojiData } from '@/src/constants/emojis';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import EmojiSearchClient from '../_components/EmojiExplorerClient';
import { notFound } from 'next/navigation';
import metadata from '../metadata.json'; // For toolTitle in this server component

interface EmojiPageProps {
  params: { emojiSlug: string }; // Standard Next.js way to type params for dynamic routes
  // searchParams?: { [key: string]: string | string[] | undefined }; // If you were using searchParams
}

// Helper to generate slugs (ensure this matches how you find it)
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export async function generateStaticParams(): Promise<{ emojiSlug: string }[]> {
  const emojis = getEmojis(); // No need for await if getEmojis is synchronous
  if (!emojis || emojis.length === 0) return [];
  return emojis.map((emoji) => ({
    emojiSlug: generateSlug(emoji.name),
  }));
}

export async function generateMetadata({ params }: EmojiPageProps) {
  // Use EmojiPageProps
  const emojis = getEmojis(); // No need for await
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

export default async function SingleEmojiPage({ params }: EmojiPageProps) {
  // Use EmojiPageProps
  const { emojiSlug } = params;
  const allEmojis = getEmojis(); // No need for await

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
