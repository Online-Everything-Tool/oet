// FILE: app/api/tool-metadata/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { LoggingPreference } from '@/app/context/HistoryContext'; // Import the type

// --- Interfaces ---
interface ToolMetadata {
    title?: string;
    description?: string;
    urlStateParams?: unknown[]; // Keep existing fields
    defaultLogging?: LoggingPreference; // Add the new field
    [key: string]: unknown; // Allow other fields
}

interface MetadataApiResponse {
    success: boolean;
    metadata?: ToolMetadata;
    error?: string;
}

const GLOBAL_DEFAULT_LOGGING: LoggingPreference = 'on'; // Define fallback

export async function GET(request: NextRequest): Promise<NextResponse<MetadataApiResponse>> {
    const { searchParams } = new URL(request.url);
    const directive = searchParams.get('directive');

    if (!directive) {
        return NextResponse.json({ success: false, error: 'Missing "directive" query parameter' }, { status: 400 });
    }

    // Basic validation to prevent directory traversal
    if (directive.includes('..') || directive.includes('/')) {
         return NextResponse.json({ success: false, error: 'Invalid directive format' }, { status: 400 });
    }

    const metadataPath = path.join(process.cwd(), 'app', 't', directive, 'metadata.json');

    try {
        await fs.access(metadataPath); // Check if file exists
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata: ToolMetadata = JSON.parse(metadataContent);

        // --- Ensure defaultLogging is valid or set a fallback ---
        const validPrefs: LoggingPreference[] = ['on', 'restrictive', 'off'];
        if (metadata.defaultLogging && !validPrefs.includes(metadata.defaultLogging)) {
            console.warn(`[API tool-metadata] Invalid defaultLogging value "${metadata.defaultLogging}" for directive "${directive}". Falling back to "${GLOBAL_DEFAULT_LOGGING}".`);
            metadata.defaultLogging = GLOBAL_DEFAULT_LOGGING;
        } else if (!metadata.defaultLogging) {
             console.log(`[API tool-metadata] No defaultLogging found for directive "${directive}". Falling back to "${GLOBAL_DEFAULT_LOGGING}".`);
            metadata.defaultLogging = GLOBAL_DEFAULT_LOGGING;
        }
        // --- End validation ---

        return NextResponse.json({ success: true, metadata });

    } catch (error: unknown) {
        const isFsError = typeof error === 'object' && error !== null && 'code' in error;
        const errorCode = isFsError ? (error as { code: string }).code : null;
        const message = error instanceof Error ? error.message : String(error);

        if (errorCode === 'ENOENT') {
            console.warn(`[API tool-metadata] Metadata file not found for directive: ${directive}`);
            // Still return success, but provide fallback metadata
            return NextResponse.json({
                 success: true,
                 metadata: {
                     title: directive.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // Generate a basic title
                     description: 'Tool description not found.',
                     defaultLogging: GLOBAL_DEFAULT_LOGGING // Provide fallback default
                 }
             });
        } else if (error instanceof SyntaxError) {
             console.error(`[API tool-metadata] Error parsing JSON for directive '${directive}':`, message);
             return NextResponse.json({ success: false, error: `Failed to parse metadata JSON: ${message}` }, { status: 500 });
        } else {
             console.error(`[API tool-metadata] Error reading metadata for directive '${directive}':`, message);
             return NextResponse.json({ success: false, error: `Failed to read metadata: ${message}` }, { status: 500 });
        }
    }
}

// Ensure edge runtime is not enabled if using Node.js fs module
// export const runtime = 'nodejs'; // or remove if default is okay