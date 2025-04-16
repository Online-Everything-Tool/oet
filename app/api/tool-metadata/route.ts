import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import type { ParamConfig } from '@/app/tool/_hooks/useToolUrlState';

// Export the ToolMetadata interface
export interface ToolMetadata {
  title?: string;
  description?: string;
  outputConfig?: {
    summaryField?: string;
    referenceType?: 'imageLibraryId';
    referenceField?: string;
  };
  urlStateParams?: ParamConfig[]; // Optional
  tags?: string[];
  iconName?: string | null;
  includeInSitemap?: boolean;
  status?: string;
  defaultLogging?: 'on' | 'restrictive' | 'off';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const directive = searchParams.get('directive');

  if (!directive) {
    return NextResponse.json({ success: false, error: 'Missing directive parameter' }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), 'app', 'tool', directive, 'metadata.json');

  try {
    await fs.access(filePath); // Verify file exists
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const metadata: ToolMetadata = JSON.parse(fileContent);

    if (typeof metadata === 'object' && metadata !== null) {
       // Added check that description is a string if it exists and same with title
       if(typeof metadata.description === 'string' && typeof metadata.title === 'string'){
          return NextResponse.json({ success: true, metadata: metadata });
       } else {
           console.warn(`[API:tool-metadata] Metadata for ${directive} missing title or description.`);
           return NextResponse.json({ success: true, metadata: metadata }); // Still return, but warn
       }
    } else {
       console.error(`[API:tool-metadata] Invalid metadata format for ${directive}.`);
       return NextResponse.json({ success: false, error: 'Invalid metadata format' }, { status: 500 });
    }
  } catch (error: unknown) {
    let message: string;
    if (error instanceof Error) {
        message = error.message;
    } else {
        message = String(error); // Fallback in case it's not an Error object
    }
    console.error(`[API:tool-metadata] Error reading metadata for ${directive}:`, message);
    return NextResponse.json({ success: false, error: `Tool metadata not found or accessible for ${directive}` }, { status: 404 });
  }
}