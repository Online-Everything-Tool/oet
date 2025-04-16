// scripts/generate-metadata-files.mjs
import fs from 'fs/promises';
import path from 'path';

const toolsDir = path.join(process.cwd(), 'app', 'tool');
const outputDir = path.join(process.cwd(), 'public', 'api', 'tool-metadata');

async function generateMetadataFiles() {
    console.log('Generating static tool metadata JSON files...');

    try {
        await fs.mkdir(outputDir, { recursive: true });
        console.log(`Ensured output directory exists: ${outputDir}`);

        const entries = await fs.readdir(toolsDir, { withFileTypes: true });
        let generatedCount = 0;
        let errorCount = 0;

        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('_')) {
                const directive = entry.name;
                const metadataPath = path.join(toolsDir, directive, 'metadata.json');
                const outputPath = path.join(outputDir, `${directive}.json`);

                try {
                    await fs.access(metadataPath);
                    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
                    JSON.parse(metadataContent);
                    await fs.writeFile(outputPath, metadataContent, 'utf-8');
                    console.log(`  ✓ Generated: ${path.relative(process.cwd(), outputPath)}`);
                    generatedCount++;
                } catch (error) {
                    errorCount++;
                    const message = error instanceof Error ? error.message : String(error);
                    // Check type and property existence before accessing .code
                    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') { // FIXED LINE
                         console.warn(`  ⚠️ Skipped (No metadata.json): ${directive}`);
                    } else if (error instanceof SyntaxError) {
                         console.error(`  ❌ Error (Invalid JSON): ${directive}/metadata.json - ${message}`);
                    } else {
                         console.error(`  ❌ Error processing ${directive}: ${message}`);
                    }
                }
            }
        }

        console.log(`\nMetadata generation complete. Generated: ${generatedCount}, Errors/Skipped: ${errorCount}`);
        if (errorCount > 0) {
             console.warn("Metadata generation finished with some errors/warnings.");
        }

    } catch (error) {
        console.error('\n❌ Failed to generate metadata files:', error);
        process.exit(1);
    }
}

generateMetadataFiles();