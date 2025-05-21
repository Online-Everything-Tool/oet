// scripts/bundle-individual-tool-contexts.mjs
import fs from 'fs/promises';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const TOOL_SRC_DIR = path.join(PROJECT_ROOT, 'app/tool');
const OUTPUT_BASE_DIR = path.join(
  PROJECT_ROOT,
  'app/api/generate-tool-resources/_contexts/tool_contexts'
);

// Directories within a tool's folder to exclude from bundling (e.g., if they contain non-code things)
// _prompts are usually for the API routes themselves, not for AI to learn from as tool structure.
const EXCLUDED_SUBDIRS_IN_TOOL = ['_prompts'];

function directiveToSnakeCase(directive) {
  return directive.replace(/-/g, '_');
}

async function bundleIndividualToolContexts() {
  console.log('Starting individual tool context bundling...');
  try {
    await fs.mkdir(OUTPUT_BASE_DIR, { recursive: true });
    const toolDirectives = await fs.readdir(TOOL_SRC_DIR, {
      withFileTypes: true,
    });

    for (const dirent of toolDirectives) {
      if (dirent.isDirectory() && !dirent.name.startsWith('_')) {
        // Process actual tool folders
        const toolDirective = dirent.name;
        const toolPath = path.join(TOOL_SRC_DIR, toolDirective);
        const toolContext = {};
        let filesProcessedForTool = 0;

        console.log(`[Tool Context] Processing tool: ${toolDirective}`);

        const collectFiles = async (currentPath, relativeBasePath) => {
          const entries = await fs.readdir(currentPath, {
            withFileTypes: true,
          });
          for (const entry of entries) {
            const entryPath = path.join(currentPath, entry.name);
            const relativeEntryPath = path.join(relativeBasePath, entry.name);

            if (entry.isDirectory()) {
              if (!EXCLUDED_SUBDIRS_IN_TOOL.includes(entry.name)) {
                await collectFiles(entryPath, relativeEntryPath);
              } else {
                console.log(
                  `[Tool Context] Skipping excluded subdir: ${relativeEntryPath} in ${toolDirective}`
                );
              }
            } else if (
              entry.isFile() &&
              (entry.name.endsWith('.tsx') ||
                entry.name.endsWith('.ts') ||
                entry.name.endsWith('.json'))
            ) {
              try {
                const content = await fs.readFile(entryPath, 'utf-8');
                // Store with project-relative path for clarity if AI refers to it
                const projectRelativeFilePath = path
                  .join('app/tool', toolDirective, relativeEntryPath)
                  .replace(/\\/g, '/');
                toolContext[projectRelativeFilePath] = content;
                filesProcessedForTool++;
              } catch (readError) {
                console.warn(
                  `[Tool Context] Warning: Could not read file ${entryPath} for tool ${toolDirective}: ${readError.message}`
                );
                toolContext[
                  path
                    .join(toolDirective, relativeEntryPath)
                    .replace(/\\/g, '/')
                ] = `// Error reading file: ${readError.message}`;
              }
            }
          }
        };

        await collectFiles(toolPath, ''); // Start with empty relative base path

        if (filesProcessedForTool > 0) {
          const snakeCaseDirective = directiveToSnakeCase(toolDirective);
          const outputFile = path.join(
            OUTPUT_BASE_DIR,
            `_${snakeCaseDirective}.json`
          );
          try {
            await fs.writeFile(
              outputFile,
              JSON.stringify(toolContext, null, 2)
            );
            console.log(
              `[Tool Context] Bundled context for ${toolDirective} to: ${outputFile}`
            );
          } catch (writeError) {
            console.error(
              `[Tool Context] Error writing context for ${toolDirective}: ${writeError.message}`
            );
          }
        } else {
          console.log(
            `[Tool Context] No relevant files found for tool: ${toolDirective}`
          );
        }
      }
    }
    console.log('Individual tool context bundling complete.');
  } catch (error) {
    console.error(
      `Error during individual tool context bundling: ${error.message}`
    );
    process.exit(1);
  }
}

bundleIndividualToolContexts();
