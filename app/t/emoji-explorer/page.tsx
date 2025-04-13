// /app/t/emoji-explorer/page.tsx
import React from 'react';

// Import the client component and the shared type
import EmojiSearchClient from './_components/EmojiSearchClient';
import type { RichEmojiData } from './_components/EmojiSearchClient'; // Import type from client

// Import ToolHeader and Metadata
import ToolHeader from '../_components/ToolHeader';
import metadata from './metadata.json';

// --- Data Fetching and Parsing Function (Server-Side) ---
// (Keep the fetchAndParseEmojis function exactly as you provided it,
// including the console logs for server-side debugging and the User-Agent header)
async function fetchAndParseEmojis(): Promise<RichEmojiData[]> {
  const EMOJI_DATA_URL = 'https://unicode.org/Public/emoji/latest/emoji-test.txt';
  console.log(`Server: Fetching emoji data from: ${EMOJI_DATA_URL}`);
  try {
    const response = await fetch(EMOJI_DATA_URL, {
      next: { revalidate: 60 * 60 * 24 }, // Revalidate daily
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OET/1.0; +https://online-everything-tool.com)' // Example User-Agent
      }
    });

    if (!response.ok) {
      throw new Error(`Server: Failed to fetch emoji data (${response.status}): ${response.statusText}`);
    }

    const textData = await response.text();
    const lines = textData.split('\n');
    const emojis: RichEmojiData[] = [];

    let currentGroup = 'Unknown';
    let currentSubgroup = 'Unknown';

    const dataRegex = /^([0-9A-Fa-f\s]+)\s+;\s+([\w-]+)\s+#\s+(\S+)\s+E([\d.]+)\s+(.*)$/;
    const groupRegex = /^#\s+group:\s+(.*)$/;
    const subgroupRegex = /^#\s+subgroup:\s+(.*)$/;
    let parsedCount = 0;
    let skippedLines = 0;

    console.log(`Server: Starting parse of ${lines.length} lines...`);

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Handle comments and empty lines
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        const groupMatch = trimmedLine.match(groupRegex);
        if (groupMatch) { currentGroup = groupMatch[1].trim(); currentSubgroup = 'Unknown'; continue; }
        const subgroupMatch = trimmedLine.match(subgroupRegex);
        if (subgroupMatch) { currentSubgroup = subgroupMatch[1].trim(); continue; }
        continue;
      }

      // Attempt to match the data line format
      const match = trimmedLine.match(dataRegex);
      if (match) {
        const status = match[2];
        // Only parse fully-qualified emojis for primary display
        if (status !== 'fully-qualified') { continue; }

        const codePoints = match[1].trim(); const emoji = match[3];
        const version = match[4]; const name = match[5].trim();

        emojis.push({ emoji, name, codePoints, version, status, group: currentGroup, subgroup: currentSubgroup });
        parsedCount++;
      } else {
        skippedLines++;
      }
    }

    console.log(`Server: Successfully parsed ${parsedCount} fully-qualified emojis.`);
    if (skippedLines > 0) { console.warn(`Server: Skipped ${skippedLines} lines that did not match format.`); }
    if (parsedCount === 0 && lines.length > 100) { console.error("Server: Parsing resulted in zero emojis."); }

    return emojis;

  } catch (error) {
    console.error("Server: Error fetching or parsing emoji data:", error);
    return []; // Return empty array on error
  }
}


// --- The Page Component (Server Component) ---
export default async function EmojiExplorerPage() {
  // Fetch data on the server
  const allEmojis = await fetchAndParseEmojis();

  return (
    <div className="p-0"> {/* Layout provides padding */}
        <ToolHeader
            title={metadata.title}
            description={metadata.description}
        />
      {/* Render the client component responsible for search/display */}
      {/* Pass the fetched data (potentially empty) as initialEmojis */}
      <EmojiSearchClient initialEmojis={allEmojis ?? []} />
    </div>
  );
}