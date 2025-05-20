// scripts/generate-directive-index.mjs
import fs from 'fs/promises';
import path from 'path';

const directivesDir = path.join(process.cwd(), 'app', 'lib', 'directives');
const indexFile = path.join(directivesDir, 'index.ts');

async function generateIndex() {
  try {
    const files = await fs.readdir(directivesDir);
    const directiveModules = [];
    const imports = [
      `import type { ToolMetadata } from '@/src/types/tools';`,
      `import type { RecentToolEntry } from '@/app/context/RecentlyUsedContext'; // Adjust path`,
      `\n// Define the common signature for the preview functions in this file for clarity`,
      `export type CustomRecentActivityPreviewFn = (`,
      `  currentState: Record<string, unknown>,`,
      `  metadata: ToolMetadata`,
      `) => Partial<RecentToolEntry> | null;\n`,
    ];
    const mapEntries = [];

    for (const file of files) {
      if (
        file.endsWith('.ts') &&
        file !== 'index.ts' &&
        !file.endsWith('.d.ts')
      ) {
        const directiveNameFromFile = file.replace(/\.ts$/, ''); // e.g., "password-generator"
        // Assuming the exported function is always getRecentActivityPreview
        // And we create an alias for it based on the directive name for clarity in the map
        const importAlias = `${directiveNameFromFile.replace(/-/g, '_')}Preview`;

        imports.push(
          `import { getRecentActivityPreview as ${importAlias} } from './${directiveNameFromFile}';`
        );
        mapEntries.push(`  '${directiveNameFromFile}': ${importAlias},`);
        directiveModules.push(directiveNameFromFile);
      }
    }

    let indexContent = imports.join('\n') + '\n\n';
    indexContent +=
      '// Create a map of directive names to their preview functions\n';
    indexContent +=
      'export const directivePreviewFunctions: Record<string, CustomRecentActivityPreviewFn | undefined> = {\n';
    indexContent += mapEntries.join('\n') + '\n';
    indexContent += '};\n';

    await fs.writeFile(indexFile, indexContent, 'utf-8');
    console.log(
      `Successfully generated app/lib/directives/index.ts with ${directiveModules.length} directive modules:`
    );
    console.log(directiveModules.join(', '));
  } catch (error) {
    console.error('Error generating app/lib/directives/index.ts:', error);
    process.exit(1);
  }
}

generateIndex();
