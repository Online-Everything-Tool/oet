// scripts/bundle-core-context.mjs
import fs from 'fs/promises';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const OUTPUT_FILE = path.join(
  PROJECT_ROOT,
  'app/api/generate-tool-resources/_contexts/_core_context_files.json'
);

// Define the core files that provide overall project context
const CORE_CONTEXT_FILES_TO_BUNDLE = [
  'package.json',
  'tsconfig.json',
  'next.config.ts', // Added next.config.ts as it's important context
  'app/page.tsx',
  'app/layout.tsx',
  'app/globals.css',
  'src/types/tools.ts',
  'src/types/storage.ts',
  'src/types/build.ts', // Added build types
  'app/lib/db.ts',
  'app/lib/itdeDataUtils.ts',
  'app/lib/sessionStorageUtils.ts',
  'app/lib/utils.ts',
  'app/lib/colorUtils.ts', // Added colorUtils
  'app/context/FileLibraryContext.tsx',
  'app/context/MetadataContext.tsx',
  'app/context/RecentlyUsedContext.tsx', // Added
  'app/context/FavoritesContext.tsx', // Added
  'app/tool/_hooks/useImageProcessing.ts',
  'app/tool/_hooks/useItdeDiscovery.ts',
  'app/tool/_hooks/useItdeTargetHandler.ts',
  'app/tool/_hooks/useToolState.ts',
  'app/tool/_hooks/useToolUrlState.ts',
  'app/tool/_components/form/Button.tsx',
  'app/tool/_components/form/Checkbox.tsx',
  'app/tool/_components/form/Input.tsx',
  'app/tool/_components/form/RadioGroup.tsx',
  'app/tool/_components/form/Range.tsx',
  'app/tool/_components/form/Select.tsx',
  'app/tool/_components/form/Textarea.tsx',
  'app/tool/_components/shared/FilenamePromptModal.tsx',
  'app/tool/_components/shared/FileSelectionModal.tsx',
  'app/tool/_components/shared/IncomingDataModal.tsx',
  'app/tool/_components/shared/ItdeAcceptChoiceModal.tsx',
  'app/tool/_components/shared/ReceiveItdeDataTrigger.tsx',
  'app/tool/_components/shared/SendToToolButton.tsx',
  'app/tool/_components/shared/OutputActionButtons.tsx', // Added
  'app/tool/_components/storage/FileDropZone.tsx', // Added
  'app/tool/_components/storage/FileGridView.tsx', // Added
  'app/tool/_components/storage/FileListView.tsx', // Added
  'app/tool/_components/storage/GenericStorageClient.tsx', // Added
  'app/tool/_components/storage/StorageControls.tsx', // Added
  // Add any other crucial shared components/hooks/types here
];

async function getFileContent(projectRelativePath) {
  try {
    const fullPath = path.join(PROJECT_ROOT, projectRelativePath);
    return await fs.readFile(fullPath, 'utf-8');
  } catch (error) {
    console.warn(
      `[Core Context] Warning: Could not read file ${projectRelativePath}: ${error.message}`
    );
    return `// File not found or error reading: ${projectRelativePath}\nContent not available.\n`;
  }
}

async function bundleCoreContext() {
  console.log('Starting core AI context bundling...');
  const bundledCoreFiles = {};

  for (const filePath of CORE_CONTEXT_FILES_TO_BUNDLE) {
    console.log(`[Core Context] Bundling: ${filePath}`);
    const content = await getFileContent(filePath);
    bundledCoreFiles[filePath] = content;
  }

  try {
    // Ensure the directory exists
    await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(bundledCoreFiles, null, 2));
    console.log(`Successfully bundled core AI context to: ${OUTPUT_FILE}`);
  } catch (error) {
    console.error(
      `[Core Context] Error writing bundled core context file: ${error.message}`
    );
    process.exit(1);
  }
}

bundleCoreContext();
