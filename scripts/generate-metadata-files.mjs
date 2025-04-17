// scripts/generate-metadata-files.mjs
import fs from 'fs/promises';
import path from 'path';

const toolsDir = path.join(process.cwd(), 'app', 'tool');
// Output dir for individual metadata files
const metadataOutputDir = path.join(process.cwd(), 'public', 'api', 'tool-metadata');
// Output path for the aggregated list of directives
const directivesListOutputDir = path.join(process.cwd(), 'public', 'api'); // Place directives.json in public/api
const directivesListOutputPath = path.join(directivesListOutputDir, 'directives.json');

async function generateFiles() {
    console.log('Generating static tool metadata and directive list...');

    try {
        // Ensure output directories exist
        await fs.mkdir(metadataOutputDir, { recursive: true });
        await fs.mkdir(directivesListOutputDir, { recursive: true }); // Ensure parent /api exists
        console.log(`Ensured output directories exist: ${metadataOutputDir} and ${directivesListOutputDir}`);

        const entries = await fs.readdir(toolsDir, { withFileTypes: true });
        let generatedMetadataCount = 0;
        let errorCount = 0;
        const validDirectives = []; // Array to store valid directive names

        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('_')) {
                const directive = entry.name;
                const metadataPath = path.join(toolsDir, directive, 'metadata.json');
                const outputPath = path.join(metadataOutputDir, `${directive}.json`);

                try {
                    await fs.access(metadataPath);
                    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
                    JSON.parse(metadataContent); // Validate JSON
                    await fs.writeFile(outputPath, metadataContent, 'utf-8');
                    console.log(`  ✓ Metadata Generated: ${path.relative(process.cwd(), outputPath)}`);
                    generatedMetadataCount++;
                    validDirectives.push(directive); // Add valid directive to the list

                } catch (error) {
                    errorCount++;
                    const message = error instanceof Error ? error.message : String(error);
                    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
                         console.warn(`  ⚠️ Skipped Metadata (No metadata.json): ${directive}`);
                    } else if (error instanceof SyntaxError) {
                         console.error(`  ❌ Metadata Error (Invalid JSON): ${directive}/metadata.json - ${message}`);
                    } else {
                         console.error(`  ❌ Metadata Error processing ${directive}: ${message}`);
                    }
                }
            }
        }

        // Sort the directives alphabetically
        validDirectives.sort((a, b) => a.localeCompare(b));

        // Generate the directives.json file
        const directivesJsonContent = JSON.stringify({ directives: validDirectives }, null, 2); // Pretty print
        await fs.writeFile(directivesListOutputPath, directivesJsonContent, 'utf-8');
        console.log(`  ✓ Directives List Generated: ${path.relative(process.cwd(), directivesListOutputPath)} (${validDirectives.length} directives)`);

        console.log(`\nGeneration complete. Metadata Files: ${generatedMetadataCount}, Directives List: 1, Errors/Skipped: ${errorCount}`);
        if (errorCount > 0) {
             console.warn("Generation finished with some errors/warnings.");
        }

    } catch (error) {
        console.error('\n❌ Failed to generate files:', error);
        process.exit(1);
    }
}

generateFiles(); // Rename the main function for clarity