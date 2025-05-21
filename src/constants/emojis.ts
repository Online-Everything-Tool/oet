import fs from 'fs/promises';

export interface RichEmojiData {
  emoji: string;
  name: string;
  codePoints: string;
  version: string;
  status: string;
  group: string;
  subgroup: string;
}

export const getEmojis = async (): Promise<RichEmojiData[]> => {
  try {
    const fileContent = await fs.readFile(
      './src/constants/emojis.txt',
      'utf-8'
    );
    const lines = fileContent.split('\n');
    const emojis: RichEmojiData[] = [];
    let currentGroup = 'Unknown';
    let currentSubgroup = 'Unknown';
    const dataRegex =
      /^([0-9A-Fa-f\s]+)\s+;\s+([\w-]+)\s+#\s+(\S+)\s+E([\d.]+)\s+(.*)$/;
    const groupRegex = /^#\s+group:\s+(.*)$/;
    const subgroupRegex = /^#\s+subgroup:\s+(.*)$/;
    let parsedCount = 0;
    let skippedLines = 0;
    console.log(`Server: Starting parse of ${lines.length} lines...`);
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        const groupMatch = trimmedLine.match(groupRegex);
        if (groupMatch) {
          currentGroup = groupMatch[1].trim();
          currentSubgroup = 'Unknown';
          continue;
        }
        const subgroupMatch = trimmedLine.match(subgroupRegex);
        if (subgroupMatch) {
          currentSubgroup = subgroupMatch[1].trim();
          continue;
        }
        continue;
      }
      const match = trimmedLine.match(dataRegex);
      if (match) {
        const status = match[2];
        if (status !== 'fully-qualified') {
          continue;
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
        skippedLines++;
      }
    }
    console.log(
      `Server: Successfully parsed ${parsedCount} fully-qualified emojis.`
    );
    if (skippedLines > 0) {
      console.warn(
        `Server: Skipped ${skippedLines} lines that did not match format.`
      );
    }
    if (parsedCount === 0 && lines.length > 100) {
      console.error('Server: Parsing resulted in zero emojis.');
    }
    return emojis;
  } catch (error) {
    console.error('Server: Error fetching or parsing emoji data:', error);
    return [];
  }
};
