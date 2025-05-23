// scripts/generate-metadata-files.mjs
import fs from 'fs/promises';
import path from 'path';

const toolsDir = path.join(process.cwd(), 'app', 'tool');
// Output dir for individual metadata files (optional, can be removed later if not needed)
const metadataOutputDir = path.join(
  process.cwd(),
  'public',
  'api',
  'tool-metadata'
);
// Output path for the aggregated list of directives (optional, can be removed later)
const directivesListOutputDir = path.join(process.cwd(), 'public', 'api');
const directivesListOutputPath = path.join(
  directivesListOutputDir,
  'directives.json'
);

// New: Output path for the bundled metadata file
const bundledMetadataPath = path.join(
  process.cwd(),
  'public',
  'api',
  'all-tool-metadata.json'
);

async function generateMetadataBundle() {
  console.log(
    'Generating static tool metadata, directive list, and bundled metadata...'
  );

  try {
    // Ensure output directories exist
    await fs.mkdir(metadataOutputDir, { recursive: true });
    await fs.mkdir(directivesListOutputDir, { recursive: true });
    console.log(
      `Ensured output directories exist: ${metadataOutputDir} and ${directivesListOutputDir}`
    );

    const entries = await fs.readdir(toolsDir, { withFileTypes: true });
    let generatedIndividualMetadataCount = 0;
    let errorCount = 0;
    const validDirectives = [];
    const allMetadata = {}; // New: Accumulator for all metadata

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('_')) {
        const directive = entry.name;
        const metadataPath = path.join(toolsDir, directive, 'metadata.json');
        const individualOutputPath = path.join(
          metadataOutputDir,
          `${directive}.json`
        );

        try {
          await fs.access(metadataPath);
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          const parsedMetadata = JSON.parse(metadataContent); // Validate JSON and parse

          // Write individual metadata file (can be made optional later)
          await fs.writeFile(individualOutputPath, metadataContent, 'utf-8');
          console.log(
            `  ✓ Individual Metadata Generated: ${path.relative(process.cwd(), individualOutputPath)}`
          );
          generatedIndividualMetadataCount++;

          // Add to the accumulator for the bundle
          allMetadata[directive] = parsedMetadata;
          validDirectives.push(directive);
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
            console.warn(
              `  ⚠️ Skipped Metadata (No metadata.json): ${directive}`
            );
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

    // Sort the directives alphabetically (for directives.json)
    validDirectives.sort((a, b) => a.localeCompare(b));

    // Generate the directives.json file (can be made optional later)
    const directivesJsonContent = JSON.stringify(
      { directives: validDirectives },
      null,
      2
    );
    await fs.writeFile(
      directivesListOutputPath,
      directivesJsonContent,
      'utf-8'
    );
    console.log(
      `  ✓ Directives List Generated: ${path.relative(process.cwd(), directivesListOutputPath)} (${validDirectives.length} directives)`
    );

    // New: Generate the bundled all-tool-metadata.json file
    const bundledMetadataContent = JSON.stringify(allMetadata, null, 2); // Pretty print
    await fs.writeFile(bundledMetadataPath, bundledMetadataContent, 'utf-8');
    console.log(
      `  ✓ Bundled Metadata Generated: ${path.relative(process.cwd(), bundledMetadataPath)} (Contains ${Object.keys(allMetadata).length} tools)`
    );

    console.log(
      `\nGeneration complete. Individual Metadata Files: ${generatedIndividualMetadataCount}, Directives List: 1, Bundled Metadata: 1, Errors/Skipped: ${errorCount}`
    );
    if (errorCount > 0) {
      console.warn('Generation finished with some errors/warnings.');
    }
  } catch (error) {
    console.error('\n❌ Failed to generate files:', error);
    process.exit(1);
  }
}

generateMetadataBundle();
