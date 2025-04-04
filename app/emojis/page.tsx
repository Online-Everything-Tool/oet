// /app/emoji/page.tsx
import React from 'react';
import EmojiSearchClient from './EmojiSearchClient';

// Define the richer structure (remains the same)
export interface RichEmojiData {
  emoji: string;
  name: string;
  codePoints: string;
  version: string; // e.g., "13.1", "1.0"
  status: string; // e.g., "fully-qualified"
  group: string;
  subgroup: string;
}

// --- Updated Data Fetching and Parsing Function (Server-Side) ---
async function fetchAndParseEmojis(): Promise<RichEmojiData[]> {
  const EMOJI_DATA_URL = 'https://unicode.org/Public/emoji/latest/emoji-test.txt';
  console.log(`Server: Fetching emoji data from: ${EMOJI_DATA_URL}`);

  try {
    const response = await fetch(EMOJI_DATA_URL, {
      next: { revalidate: 60 * 60 * 24 }, // Revalidate daily
      // Add a User-Agent header, some servers might block default fetch agents
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; YourAppName/1.0; +http://yourappdomain.com/bot)'
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

    // --- The Updated Regex ---
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
        if (groupMatch) {
          currentGroup = groupMatch[1].trim();
          currentSubgroup = 'Unknown'; // Reset subgroup when group changes
          // console.log(`Server: Set group to: ${currentGroup}`); // Debugging groups
          continue;
        }
        const subgroupMatch = trimmedLine.match(subgroupRegex);
        if (subgroupMatch) {
          currentSubgroup = subgroupMatch[1].trim();
          // console.log(`Server: Set subgroup to: ${currentSubgroup}`); // Debugging subgroups
          continue;
        }
        // Skip other comments/empty lines
        continue;
      }

      // Attempt to match the data line format
      const match = trimmedLine.match(dataRegex);
      if (match) {
        const status = match[2];
        // Optional: Filter only for fully-qualified here if desired
        if (status !== 'fully-qualified') {
            continue; // Skip non-fully-qualified entries for the main list
        }

        const codePoints = match[1].trim();
        const emoji = match[3];
        const version = match[4];
        const name = match[5].trim();

        emojis.push({
          emoji,
          name,
          codePoints,
          version,
          status,
          group: currentGroup,
          subgroup: currentSubgroup,
        });
        parsedCount++;
      } else {
        // Log lines that *don't* match the regex, might indicate format issues
        // console.warn(`Server: Skipped line (no regex match): ${trimmedLine}`);
        skippedLines++;
      }
    }

    console.log(`Server: Successfully parsed ${parsedCount} fully-qualified emojis.`);
    if (skippedLines > 0) {
      console.warn(`Server: Skipped ${skippedLines} lines that did not match the expected data format.`);
    }
    if (parsedCount === 0 && lines.length > 100) { // Check if parsing failed badly
        console.error("Server: Parsing resulted in zero emojis. Check regex and fetched data content.");
    }

    return emojis;

  } catch (error) {
    console.error("Server: Error fetching or parsing emoji data:", error);
    return []; // Return empty array on any critical error
  }
}


// --- The Page Component (Server Component) ---
export default async function EmojiPage() {
  // Fetch data on the server during render/build
  const allEmojis = await fetchAndParseEmojis();

  // Add a check here for better feedback if fetching/parsing failed
  if (!allEmojis || allEmojis.length === 0) {
      console.error("EmojiPage: No emoji data loaded. Rendering client with empty array.");
      // Optionally render a message directly here, or let the client handle it
  }

  return (
    <main className="p-4 sm:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-gray-800">Emoji Explorer</h1>
      <p className="text-gray-600 mb-6">
        Search and filter through the official Unicode emoji dataset (v16.0).
      </p>
      {/* Render the client component responsible for search/display */}
      {/* Pass the potentially empty array if fetch/parse failed */}
      <EmojiSearchClient initialEmojis={allEmojis ?? []} />
    </main>
  );
}