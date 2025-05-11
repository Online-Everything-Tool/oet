// FILE: app/tool/emoji-explorer/[emojiSlug]/page.tsx
import React from 'react';
import { getEmojis } from '@/src/constants/emojis';
import ToolHeader from '../../_components/ToolHeader';
import ToolSettings from '../../_components/ToolSettings';
import EmojiSearchClient from '../_components/EmojiExplorerClient';
import { notFound } from 'next/navigation';
import metadata from '../metadata.json';
import type { Metadata } from 'next';

// Let Next.js infer the params structure for these functions as much as possible
// We know 'emojiSlug' will be in params.

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

const emojis = getEmojis();

export async function generateStaticParams() {
  // Return type will be inferred
  if (!emojis || emojis.length === 0) return [];
  return emojis.map((emoji) => ({
    emojiSlug: generateSlug(emoji.name),
  }));
}

// For generateMetadata and the page component,
// specify the params type as simply as possible for a dynamic segment.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ emojiSlug: string }>; // Direct and standard
}): Promise<Metadata> {
  const { emojiSlug } = await params;
  const emoji = emojis.find((e) => generateSlug(e.name) === emojiSlug);
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

export default async function SingleEmojiPage({
  params,
}: {
  params: Promise<{ emojiSlug: string }>; // Direct and standard
}) {
  const { emojiSlug } = await params;

  const featuredEmoji = emojis.find(
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
        initialEmojis={emojis ?? []}
        featuredEmoji={featuredEmoji}
      />
    </div>
  );
}