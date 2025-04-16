// FILE: app/api/tool-metadata/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { LoggingPreference } from '@/app/context/HistoryContext'; // Import the type
import type { ParamConfig } from '@/app/tool/_hooks/useToolUrlState'; // Import ParamConfig type

// --- Updated Interface to be more specific ---
interface ToolMetadata {
    title?: string;
    description?: string;
    urlStateParams?: ParamConfig[]; // Use the specific type
    outputConfig?: { // Add outputConfig definition
        summaryField?: string;
        displayField?: string;
        referenceType?: 'imageLibraryId';
        referenceField?: string;
    };
    defaultLogging?: LoggingPreference;
    tags?: string[];
    iconName?: string | null;
    includeInSitemap?: boolean;
    status?: string;
    // Allow other fields, but keep it minimal if possible
    [key: string]: unknown;
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

    if (directive.includes('..') || directive.includes('/')) {
         return NextResponse.json({ success: false, error: 'Invalid directive format' }, { status: 400 });
    }

    // *** CORRECTED PATH ***
    const metadataPath = path.join(process.cwd(), 'app', 'tool', directive, 'metadata.json');
    // *********************

    try {
        await fs.access(metadataPath);
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        // Parse carefully, but trust the structure for now
        const metadata: ToolMetadata = JSON.parse(metadataContent);

        // Validate defaultLogging (unchanged)
        const validPrefs: LoggingPreference[] = ['on', 'restrictive', 'off'];
        if (metadata.defaultLogging && !validPrefs.includes(metadata.defaultLogging)) {
            console.warn(`[API tool-metadata] Invalid defaultLogging value "${metadata.defaultLogging}" for "${directive}". Falling back.`);
            metadata.defaultLogging = GLOBAL_DEFAULT_LOGGING;
        } else if (!metadata.defaultLogging) {
            // console.log(`[API tool-metadata] No defaultLogging found for "${directive}". Falling back.`); // Less verbose
            metadata.defaultLogging = GLOBAL_DEFAULT_LOGGING;
        }

        // Return the *full* metadata object as read from the file
        return NextResponse.json({ success: true, metadata });

    } catch (error: unknown) {
        const isFsError = typeof error === 'object' && error !== null && 'code' in error;
        const errorCode = isFsError ? (error as { code: string }).code : null;
        const message = error instanceof Error ? error.message : String(error);

        if (errorCode === 'ENOENT') {
            console.warn(`[API tool-metadata] Metadata file not found for directive: ${directive}`);
            // Return success:false when not found, so consumers know it's missing
            return NextResponse.json({ success: false, error: `Metadata not found for directive: ${directive}` }, { status: 404 });
            // Or return the fallback like before if preferred:
            /*
            return NextResponse.json({
                 success: true, // Or false? Indicate it's a fallback? Let's keep false.
                 metadata: {
                     title: directive.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                     description: 'Tool description not found.',
                     defaultLogging: GLOBAL_DEFAULT_LOGGING
                 }
             });
            */
        } else if (error instanceof SyntaxError) {
             console.error(`[API tool-metadata] Error parsing JSON for '${directive}':`, message);
             return NextResponse.json({ success: false, error: `Failed to parse metadata JSON: ${message}` }, { status: 500 });
        } else {
             console.error(`[API tool-metadata] Error reading metadata for '${directive}':`, message);
             return NextResponse.json({ success: false, error: `Failed to read metadata: ${message}` }, { status: 500 });
        }
    }
}

// Ensure edge runtime is not enabled if using Node.js fs module
// export const runtime = 'nodejs'; // Default runtime should be Node.js unless specified otherwise