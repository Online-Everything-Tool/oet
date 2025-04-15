// FILE: app/sitemap.ts
import { MetadataRoute } from 'next';
import fs from 'fs/promises';
import path from 'path';

// Define your site's base URL
const baseUrl = 'https://online-everything-tool.com';

// Helper function to read metadata and check sitemap inclusion
async function shouldIncludeTool(toolDirName: string): Promise<boolean> {
    const metadataPath = path.join(process.cwd(), 'app', 't', toolDirName, 'metadata.json');
    try {
        await fs.access(metadataPath); // Check if file exists
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        // Default to true if includeInSitemap is missing or not explicitly false
        return metadata.includeInSitemap !== false;
    } catch (error) {
        // If metadata file is missing or unreadable, default to including it
        // Log a warning for missing metadata
        const isFsError = typeof error === 'object' && error !== null && 'code' in error;
        const errorCode = isFsError ? (error as { code: string }).code : null;
        if (errorCode === 'ENOENT') {
             console.warn(`[Sitemap] Metadata file not found for tool '${toolDirName}'. Including in sitemap by default.`);
        } else {
             console.error(`[Sitemap] Error reading metadata for tool '${toolDirName}':`, error);
        }
        return true;
    }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // --- Static Pages ---
    const staticEntries: MetadataRoute.Sitemap = [
        {
            url: `${baseUrl}/`,
            lastModified: new Date().toISOString(),
            changeFrequency: 'weekly',
            priority: 1.0,
        },
        {
            url: `${baseUrl}/build-tool/`, // Ensure trailing slash matches next.config.js
            lastModified: new Date().toISOString(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/history/`, // Ensure trailing slash matches next.config.js
            lastModified: new Date().toISOString(),
            changeFrequency: 'daily', // History changes often for the user
            priority: 0.5, // Less important for SEO than core pages/tools
        },
    ];

    // --- Dynamic Tool Pages ---
    const toolEntries: MetadataRoute.Sitemap = [];
    const toolsDirPath = path.join(process.cwd(), 'app', 't');

    try {
        const entries = await fs.readdir(toolsDirPath, { withFileTypes: true });
        for (const entry of entries) {
            // Include only directories that don't start with '_'
            if (entry.isDirectory() && !entry.name.startsWith('_')) {
                const toolDirName = entry.name;
                const include = await shouldIncludeTool(toolDirName);

                if (include) {
                    toolEntries.push({
                        url: `${baseUrl}/t/${toolDirName}/`, // Ensure trailing slash matches next.config.js
                        lastModified: new Date().toISOString(), // Use current date, or get file mod time if needed
                        changeFrequency: 'monthly', // Tools themselves don't change frequently
                        priority: 0.6, // Slightly higher than history, lower than core pages
                    });
                } else {
                    console.log(`[Sitemap] Excluding tool '${toolDirName}' based on metadata.`);
                }
            }
        }
    } catch (error) {
        console.error("[Sitemap] Error reading tools directory:", error);
        // Proceed without tool entries if directory reading fails
    }

    return [...staticEntries, ...toolEntries];
}