// /app/api/tool-metadata/route.ts

import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
// Adjust import path if your hook lives elsewhere relative to api routes
import { ParamConfig } from '@/app/t/_hooks/useToolUrlState';

// Define expected structure of metadata JSON for validation/typing
export interface ToolMetadata {
    title?: string;
    description?: string;
    urlStateParams?: ParamConfig[];
    tags?: string[];
    // Add other potential fields from your metadata.json structure
    [key: string]: unknown; // Allow other fields
}

// Define response types
interface SuccessResponse {
    success: true;
    metadata: ToolMetadata;
}
interface ErrorResponse {
    success: false;
    error: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
    const { searchParams } = new URL(request.url);
    // --- CHANGE: Expect 'directive' parameter instead of 'route' ---
    const directiveName = searchParams.get('directive');

    console.log(`[API /tool-metadata] Received GET request for directive: ${directiveName}`);

    // --- Input Validation (Updated) ---
    if (!directiveName) {
        console.error('[API /tool-metadata] Missing directive parameter.');
        return NextResponse.json({ success: false, error: "Missing required 'directive' parameter." }, { status: 400 });
    }
    // Validate the directive name format directly
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(directiveName) || directiveName.startsWith('_')) {
         console.error(`[API /tool-metadata] Invalid directive received: '${directiveName}'`);
        return NextResponse.json({ success: false, error: 'Invalid tool directive format.' }, { status: 400 });
    }

    // --- File Reading (Path construction uses directiveName directly) ---
    const metadataPath = path.join(process.cwd(), 'app', 't', directiveName, 'metadata.json');
    console.log(`[API /tool-metadata] Attempting to read: ${metadataPath}`);

    try {
        await fs.access(metadataPath, fs.constants.R_OK);
        const fileContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata: ToolMetadata = JSON.parse(fileContent);

        if (typeof metadata !== 'object' || metadata === null) {
             throw new Error("Parsed metadata is not a valid object.");
        }

        console.log(`[API /tool-metadata] Successfully read and parsed metadata for '${directiveName}'.`);
        return NextResponse.json({ success: true, metadata: metadata });

    } catch (error: unknown) {
        let errorMessage = `Failed to retrieve metadata for directive: ${directiveName}`; // Updated message
        let status = 500;
        const isFsError = typeof error === 'object' && error !== null && 'code' in error;
        const errorCode = isFsError ? (error as { code: string }).code : null;

        if (errorCode === 'ENOENT') {
            errorMessage = `Metadata file not found for directive: ${directiveName}`;
            status = 404;
            console.warn(`[API /tool-metadata] ${errorMessage}`);
        } else if (error instanceof SyntaxError) {
             errorMessage = `Invalid JSON format in metadata file for directive: ${directiveName}`;
             status = 500;
             console.error(`[API /tool-metadata] JSON Parse Error for ${directiveName}:`, error);
        } else if (error instanceof Error){
             errorMessage = error.message;
             console.error(`[API /tool-metadata] Error processing metadata for ${directiveName}:`, error);
        } else {
             console.error(`[API /tool-metadata] Unknown error for ${directiveName}:`, error);
        }

        return NextResponse.json({ success: false, error: errorMessage }, { status: status });
    }
}