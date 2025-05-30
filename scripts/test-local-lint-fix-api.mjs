// FILE: scripts/test-local-lint-fix-api.mjs
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const API_ENDPOINT = 'http://localhost:3000/api/fix-linting-errors';

// The full, raw build log output from VPR
const VPR_BUILD_LOG_CONTENT = `
⚠ No build cache found. Please configure build caching for faster rebuilds. Read more: https://nextjs.org/docs/messages/no-cache
Attention: Next.js now collects completely anonymous telemetry regarding usage.
This information is used to shape Next.js' roadmap and prioritize features.
You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
https://nextjs.org/telemetry

   ▲ Next.js 15.3.2

   Creating an optimized production build ...
 ✓ (serwist) Bundling the service worker script with the URL '/sw.js' and the scope '/'...
 ⚠ Compiled with warnings in 9.0s

./node_modules/face-api.js/build/es6/env/createFileSystem.js
Module not found: Can't resolve 'fs' in '/home/runner/work/oet/oet/node_modules/face-api.js/build/es6/env'

Import trace for requested module:
./node_modules/face-api.js/build/es6/env/createFileSystem.js
./node_modules/face-api.js/build/es6/env/index.js
./node_modules/face-api.js/build/es6/index.js
./app/tool/bitcoin-laser-eyes/_hooks/useFaceApiLoader.ts
./app/tool/bitcoin-laser-eyes/_components/BitcoinLaserEyesClient.tsx

./node_modules/@tensorflow/tfjs-core/node_modules/node-fetch/lib/index.es.js
Module not found: Can't resolve 'encoding' in '/home/runner/work/oet/oet/node_modules/@tensorflow/tfjs-core/node_modules/node-fetch/lib'

Import trace for requested module:
./node_modules/@tensorflow/tfjs-core/node_modules/node-fetch/lib/index.es.js
./node_modules/@tensorflow/tfjs-core/dist/tf-core.esm.js
./node_modules/face-api.js/build/es6/index.js
./app/tool/bitcoin-laser-eyes/_hooks/useFaceApiLoader.ts
./app/tool/bitcoin-laser-eyes/_components/BitcoinLaserEyesClient.tsx

   Linting and checking validity of types ...

Failed to compile.

./app/_components/RecentlyUsedToolsWidget.tsx
88:6  Warning: React Hook useEffect has a missing dependency: 'imageUrl'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps

./app/lib/directives/crypto-wallet-generator.ts
6:3  Warning: 'currentState' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars
7:3  Warning: 'metadata' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars

./app/lib/directives/password-generator.ts
6:3  Warning: 'currentState' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars
7:3  Warning: 'metadata' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars

./app/lib/directives/text-counter.ts
7:3  Warning: 'currentState' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars
8:3  Warning: 'metadata' is defined but never used. Allowed unused args must match /^_/u.  @typescript-eslint/no-unused-vars

./app/tool/bitcoin-laser-eyes/_components/BitcoinLaserEyesClient.tsx
281:5  Warning: React Hook useCallback has a missing dependency: 'faceApi'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
462:6  Warning: React Hook useEffect has missing dependencies: 'originalImageSrcForUI' and 'processedImageSrcForUI'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps

./app/tool/bitcoin-laser-eyes/_hooks/useFaceApiLoader.ts
18:68  Error: The \`{}\` ("empty object") type allows any non-nullish value, including literals like \`0\` and \`""\`.
- If that's what you want, disable this lint rule with an inline comment or configure the 'allowObjectTypes' rule option.
- If you want a type meaning "any object", you probably want \`object\` instead.
- If you want a type meaning "any value", you probably want \`unknown\` instead.  @typescript-eslint/no-empty-object-type
info  - Need to disable some ESLint rules? Learn more here: https://nextjs.org/docs/app/api-reference/config/eslint#disabling-rules
`;

const FILE_PATHS_IN_REPO = [
  'app/tool/bitcoin-laser-eyes/_components/BitcoinLaserEyesClient.tsx',
  'app/tool/bitcoin-laser-eyes/_hooks/useFaceApiLoader.ts',
  'app/tool/bitcoin-laser-eyes/page.tsx',
];
// --- End Configuration ---

async function main() {
  const filesToFix = [];
  for (const repoPath of FILE_PATHS_IN_REPO) {
    const fullPath = path.resolve(__dirname, '..', repoPath);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      filesToFix.push({
        path: repoPath, // Use the relative path from project root, as API expects
        currentContent: content,
      });
      console.log(
        `Successfully read and added to payload: ${repoPath} (${content.length} chars)`
      );
    } catch (error) {
      console.warn(
        `Could not read file ${fullPath}. It will not be included in the test. Error: ${error.message}`
      );
    }
  }

  if (filesToFix.length === 0) {
    console.error('No files could be read for the test. Exiting.');
    process.exit(1);
  }

  const payload = {
    filesToFix: filesToFix,
    lintErrors: VPR_BUILD_LOG_CONTENT.trim(), // Send the full build log
  };

  console.log(`\nSending payload to: ${API_ENDPOINT}`);
  console.log(`  Number of files in payload: ${payload.filesToFix.length}`);
  console.log(
    `  Total length of global lintErrors string: ${payload.lintErrors.length} chars`
  );
  console.log(
    `  Global lintErrors (first 300 chars):\n---\n${payload.lintErrors.substring(0, 300)}\n---\n`
  );

  try {
    const startTime = Date.now();
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const duration = Date.now() - startTime;

    console.log(`\n--- API Response ---`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Duration: ${duration}ms`);

    const responseBody = await response.json();

    if (!response.ok) {
      console.error('API call failed.');
      console.error('Response Body:', JSON.stringify(responseBody, null, 2));
      return;
    }

    console.log('API call successful.');
    console.log('Message from API:', responseBody.message);

    if (responseBody.fixedFiles) {
      console.log('\n--- Fixed Files Summary ---');
      for (const filePath in responseBody.fixedFiles) {
        const fixedContentOrNull = responseBody.fixedFiles[filePath];
        if (fixedContentOrNull === null) {
          console.log(`\nFile: ${filePath}`);
          console.log(`  Status: AI processing failed for this file.`);
        } else {
          const originalFileObj = filesToFix.find((f) => f.path === filePath);
          const originalLength = originalFileObj
            ? originalFileObj.currentContent.length
            : 'N/A';

          console.log(`\nFile: ${filePath}`);
          console.log(`  Original length: ${originalLength} chars`);
          console.log(
            `  Fixed content length: ${fixedContentOrNull.length} chars`
          );

          if (
            typeof originalLength === 'number' &&
            fixedContentOrNull.length < originalLength * 0.9 &&
            originalLength > 0
          ) {
            console.warn(
              '  WARNING: Fixed content is significantly shorter than original. Possible truncation.'
            );
          }
          if (
            originalFileObj &&
            fixedContentOrNull === originalFileObj.currentContent
          ) {
            console.log(
              '  NOTE: Fixed content is identical to original content (no changes made or needed).'
            );
          } else {
            console.log('  NOTE: Fixed content DIFFERS from original content.');
          }
          // console.log(`  Fixed content (last 100 chars for ${filePath}):\n  ${fixedContentOrNull.slice(-100).replace(/\n/g, '\n  ')}`);
        }
      }
    } else {
      console.log(`No 'fixedFiles' object returned in the response.`);
    }
  } catch (error) {
    console.error('\nError during fetch or processing:', error);
  }
}

main();
