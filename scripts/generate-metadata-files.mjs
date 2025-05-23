// scripts/generate-metadata-files.mjs
import fs from 'fs/promises';
import path from 'path';

const toolsDir = path.join(process.cwd(), 'app', 'tool');
const apiOutputDir = path.join(process.cwd(), 'public', 'api'); // Base output directory
const bundledMetadataPath = path.join(apiOutputDir, 'all-tool-metadata.json');

async function generateBundledMetadata() {
  console.log('Generating bundled tool metadata (all-tool-metadata.json)...');

  try {
    // Ensure the /public/api output directory exists
    await fs.mkdir(apiOutputDir, { recursive: true });
    console.log(`Ensured output directory exists: ${apiOutputDir}`);

    const entries = await fs.readdir(toolsDir, { withFileTypes: true });
    let errorCount = 0;
    const allMetadata = {}; // Accumulator for all metadata

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('_')) {
        const directive = entry.name;
        const metadataPath = path.join(toolsDir, directive, 'metadata.json');

        try {
          await fs.access(metadataPath); // Check if metadata.json exists
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          const parsedMetadata = JSON.parse(metadataContent); // Validate JSON and parse

          // Add to the accumulator for the bundle
          allMetadata[directive] = parsedMetadata;
          console.log(`  ✓ Added metadata for: ${directive}`);
        } catch (error) {
          errorCount++;
          const message =
            error instanceof Error ? error.message : String(error);
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'ENOENT'
          ) {
            console.warn(`  ⚠️ Skipped (No metadata.json): ${directive}`);
          } else if (error instanceof SyntaxError) {
            console.error(
              `  ❌ Metadata Error (Invalid JSON): ${directive}/metadata.json - ${message}`
            );
          } else {
            console.error(
              `  ❌ Metadata Error processing ${directive}: ${message}`
            );
          }
        }
      }
    }

    // Generate the bundled all-tool-metadata.json file
    const bundledMetadataContent = JSON.stringify(allMetadata, null, 2); // Pretty print
    await fs.writeFile(bundledMetadataPath, bundledMetadataContent, 'utf-8');
    console.log(
      `  ✓ Bundled Metadata Generated: ${path.relative(process.cwd(), bundledMetadataPath)} (Contains ${Object.keys(allMetadata).length} tools)`
    );

    console.log(
      `\nGeneration complete. Bundled Metadata: 1, Errors/Skipped: ${errorCount}`
    );
    if (errorCount > 0) {
      console.warn('Generation finished with some errors/warnings.');
    }
  } catch (error) {
    console.error('\n❌ Failed to generate bundled metadata:', error);
    process.exit(1);
  }
}

generateBundledMetadata();
