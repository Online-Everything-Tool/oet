import { NextResponse } from 'next/server';
import fs from 'fs/promises'; // Use promises API for async/await
import path from 'path';

export async function GET() {
  // Define the base directory where tools reside
  const toolsDirPath = path.join(process.cwd(), 'app', 't');
  const directives: string[] = []; // Array to hold valid directive names

  console.log(`[API /list-directives] Reading tool directory: ${toolsDirPath}`);

  try {
    // Read directory entries, getting Dirent objects for type checking
    const entries = await fs.readdir(toolsDirPath, { withFileTypes: true });

    // Process each entry concurrently (optional, good for many dirs)
    await Promise.all(entries.map(async (entry) => {
      // Check if it's a directory and doesn't start with '_'
      if (entry.isDirectory() && !entry.name.startsWith('_')) {
        const directiveName = entry.name;
        const metadataPath = path.join(toolsDirPath, directiveName, 'metadata.json');

        try {
          // Check if metadata.json exists and is accessible
          await fs.access(metadataPath, fs.constants.R_OK); // R_OK checks read access
          // If access check succeeds, add the directive name
          directives.push(directiveName);
           console.log(`[API /list-directives] Found valid directive: ${directiveName}`);
        } catch (accessError: unknown) {
          // If fs.access fails, it throws an error.
          // We only care if the error is *not* 'File Not Found'.
          // Safely check the error code
          const isFsError = typeof accessError === 'object' && accessError !== null && 'code' in accessError;
          const errorCode = isFsError ? (accessError as { code: string }).code : null;

          if (errorCode === 'ENOENT') {
             console.log(`[API /list-directives] Skipping '${directiveName}': metadata.json not found.`);
          } else {
            // Log other errors (e.g., permissions) as warnings
             console.warn(`[API /list-directives] Warning checking metadata for '${directiveName}':`, accessError);
          }
        }
      } else if (entry.isDirectory() && entry.name.startsWith('_')) {
         console.log(`[API /list-directives] Skipping private directory: ${entry.name}`);
      }
    }));

    // Sort the directives alphabetically for consistent output
    directives.sort((a, b) => a.localeCompare(b));

    console.log(`[API /list-directives] Returning ${directives.length} directives.`);
    // Return the successful response
    return NextResponse.json({ directives });

  } catch (error: unknown) {
    // Handle errors during the initial directory read or other unexpected issues
    console.error("[API /list-directives] Error reading tools directory:", error);

    // Safely get error message
    const message = error instanceof Error ? error.message : "An unknown error occurred";

    return NextResponse.json(
      { error: `Failed to list directives: ${message}` },
      { status: 500 } // Internal Server Error
    );
  }
}