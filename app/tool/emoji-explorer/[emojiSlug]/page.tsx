// FILE: app/tool/emoji-explorer/[emojiSlug]/page.tsx
import React from 'react';
import { getEmojis, RichEmojiData } from '@/src/constants/emojis';
import ToolHeader from '../../_components/ToolHeader'; // Adjusted path
import ToolSettings from '../../_components/ToolSettings'; // Adjusted path
import EmojiSearchClient from '../_components/EmojiExplorerClient'; // Path to client
import { notFound } from 'next/navigation'; // For handling missing slugs

interface EmojiPageParams {
  emojiSlug: string;
}

// Helper to generate slugs (ensure this matches how you find it)
// IMPORTANT: This slug generation must be robust and reversible, or you must store the slug with the emoji data.
// Using codepoints might be more reliable for slugs if names can have tricky characters.
// For this example, we'll stick to a simple name-based slug.
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export async function generateStaticParams(): Promise<EmojiPageParams[]> {
  const emojis = await getEmojis();
  if (!emojis || emojis.length === 0) return [];
  return emojis.map((emoji) => ({
    emojiSlug: generateSlug(emoji.name),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: EmojiPageParams;
}) {
  const emojis = await getEmojis();
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
      // You could even generate a simple OpenGraph image for each emoji
    },
  };
}

export default async function SingleEmojiPage({
  params,
}: {
  params: EmojiPageParams;
}) {
  const { emojiSlug } = params;
  const allEmojis = await getEmojis(); // Fetch all emojis

  // Find the specific emoji for this page
  const featuredEmoji = allEmojis.find(
    (e) => generateSlug(e.name) === emojiSlug
  );

  if (!featuredEmoji) {
    notFound(); // Triggers the not-found page if slug doesn't match any emoji
  }

  // These are for the overall tool, not specific to the featured emoji itself in terms of settings
  const toolTitle = metadata.title || 'Emoji Explorer';
  const toolRoute = '/tool/emoji-explorer'; // Main tool route for settings

  return (
    <div className="relative flex flex-col gap-6">
      {' '}
      {/* Removed p-0 from main explorer, add padding here or in client */}
      <ToolSettings toolRoute={toolRoute} />{' '}
      {/* Settings still point to the main tool route */}
      <ToolHeader
        title={toolTitle} // Main tool title
        description={metadata.description || ''} // Main tool description
      />
      {/* Pass all emojis for the explorer, and the specific one to feature */}
      <EmojiSearchClient
        initialEmojis={allEmojis ?? []}
        featuredEmoji={featuredEmoji} // Pass the specific emoji to feature
      />
    </div>
  );
}

// We still need the main metadata for the /tool/emoji-explorer route itself
// This would typically come from the main page.tsx for the explorer,
// but since this page is also /tool/emoji-explorer/[slug], we'll reference it here.
// (Actually, metadata should be fine as `page.tsx` in the parent handles its own)
import metadata from '../metadata.json'; // For toolTitle in this server component
