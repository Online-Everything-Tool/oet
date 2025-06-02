// FILE: app/sitemap.ts
import { MetadataRoute } from 'next';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-static';

const baseUrl = 'https://online-everything-tool.com';

async function shouldIncludeTool(toolDirName: string): Promise<boolean> {
  const metadataPath = path.join(
    process.cwd(),
    'app',
    'tool',
    toolDirName,
    'metadata.json'
  );
  try {
    await fs.access(metadataPath);
    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);

    return metadata.includeInSitemap !== false;
  } catch (error) {
    const isFsError =
      typeof error === 'object' && error !== null && 'code' in error;
    const errorCode = isFsError ? (error as { code: string }).code : null;
    if (errorCode === 'ENOENT') {
      console.warn(
        `[Sitemap] Metadata file not found for tool '${toolDirName}'. Including in sitemap by default.`
      );
    } else {
      console.error(
        `[Sitemap] Error reading metadata for tool '${toolDirName}':`,
        error
      );
    }
    return true;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/build/tool/`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];

  const toolEntries: MetadataRoute.Sitemap = [];
  const toolsDirPath = path.join(process.cwd(), 'app', 'tool');

  try {
    const entries = await fs.readdir(toolsDirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('_')) {
        const toolDirName = entry.name;
        const include = await shouldIncludeTool(toolDirName);

        if (include) {
          toolEntries.push({
            url: `${baseUrl}/tool/${toolDirName}/`,
            lastModified: new Date().toISOString(),
            changeFrequency: 'monthly',
            priority: 0.6,
          });
        } else {
          console.log(
            `[Sitemap] Excluding tool '${toolDirName}' based on metadata.`
          );
        }
      }
    }
  } catch (error) {
    console.error('[Sitemap] Error reading tools directory:', error);
  }

  return [...staticEntries, ...toolEntries];
}
