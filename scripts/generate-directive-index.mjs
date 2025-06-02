// FILE: scripts/generate-directive-index.mjs
import fs from 'fs/promises';
import path from 'path';

const directivesLibDir = path.join(process.cwd(), 'app', 'lib', 'directives');
const indexFile = path.join(directivesLibDir, 'index.ts');

// Helper function to convert kebab-case to camelCase
function toCamelCase(str) {
  return str.replace(/-([a-z0-9])/g, (g) => g[1].toUpperCase()); // Modified to handle digits too
}

async function generateIndex() {
  try {
    const itemsInDirectivesLibDir = await fs.readdir(directivesLibDir);
    const directiveModules = [];
    const imports = [
      `import type { ToolMetadata } from '@/src/types/tools';`,
      `import type { RecentToolEntry } from '@/app/context/RecentlyUsedContext'; // Adjust path as needed`,
      `\n// Define the common signature for the preview functions in this file for clarity`,
      `export type CustomRecentActivityPreviewFn = (`,
      `  currentState: Record<string, unknown>,`,
      `  metadata: ToolMetadata`,
      `) => Partial<RecentToolEntry> | null;\n`,
    ];
    const mapEntries = [];

    for (const itemName of itemsInDirectivesLibDir) {
      const itemPath = path.join(directivesLibDir, itemName);
      const stats = await fs.stat(itemPath);

      if (stats.isDirectory()) {
        const previewFilePath = path.join(
          itemPath,
          'RecentActivityPreview.tsx'
        );
        const previewFileExists = await fs
          .access(previewFilePath)
          .then(() => true)
          .catch(() => false);

        if (previewFileExists) {
          const directiveName = itemName;
          const importAlias = `${toCamelCase(directiveName)}Preview`;
          imports.push(
            `import { getRecentActivityPreview as ${importAlias} } from './${directiveName}/RecentActivityPreview';`
          );
          // Add the comma directly to each map entry
          mapEntries.push(`  '${directiveName}': ${importAlias},`);
          directiveModules.push(directiveName);
        }
      }
    }

    let indexContent = imports.join('\n') + '\n\n';
    indexContent +=
      '// Create a map of directive names to their preview functions\n';
    indexContent +=
      'export const directivePreviewFunctions: Record<string, CustomRecentActivityPreviewFn | undefined> = {\n';
    // Join entries. If mapEntries is not empty, the last entry will have an extra comma,
    // which is fine in modern JS/TS object literals.
    // If it's an issue for a specific linter, we can strip the last comma after joining.
    indexContent += mapEntries.join('\n') + '\n';
    indexContent += '};\n';

    // Refined way to handle potential trailing comma if strictly needed (though often allowed)
    if (mapEntries.length > 0 && indexContent.endsWith(',\n')) {
      indexContent = indexContent.substring(0, indexContent.length - 2) + '\n'; // Remove trailing comma
    }

    await fs.writeFile(indexFile, indexContent, 'utf-8');
    console.log(
      `Successfully generated app/lib/directives/index.ts with ${directiveModules.length} directive preview functions:`
    );
    if (directiveModules.length > 0) {
      console.log(directiveModules.join(', '));
    } else {
      console.log('No directive preview functions found.');
    }
  } catch (error) {
    console.error('Error generating app/lib/directives/index.ts:', error);
    process.exit(1);
  }
}

generateIndex();
