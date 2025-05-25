// scripts/generate-test-pr.mjs
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to load .env (basic version)
async function loadEnv() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const envPath = path.resolve(__dirname, '..', '.env');
    // console.log(`[Test PR Script - loadEnv] Attempting to load .env from: ${envPath}`); // Verbose

    const envFile = await fs.readFile(envPath, 'utf-8');
    // console.log('[Test PR Script - loadEnv] .env file content read successfully.'); // Verbose

    envFile.split('\n').forEach((line) => {
      // const originalLine = line; // For debugging
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove surrounding quotes

        const trimmedKey = key ? key.trim() : null;
        const trimmedValue = value ? value.trim() : null; // Trim value here

        if (trimmedKey && trimmedValue) {
          process.env[trimmedKey] = trimmedValue; // Use trimmedValue
          // console.log(`[Test PR Script - loadEnv] Setting process.env.${trimmedKey}`); // Verbose
        } else {
          // console.log(`[Test PR Script - loadEnv] Skipped line (key or value empty after parse/trim): "${originalLine}"`); // Verbose
        }
      }
    });
    console.log('[Test PR Script - loadEnv] Finished parsing .env.');
  } catch (error) {
    console.warn(
      '[Test PR Script - loadEnv] Could not load .env file. Error: ' +
        error.message
    );
  }
}

// Module-scoped variables to be populated by main() after loadEnv()
let appId;
let privateKeyBase64;

const GITHUB_REPO_OWNER =
  process.env.GITHUB_TEST_REPO_OWNER || 'Online-Everything-Tool';
const GITHUB_REPO_NAME = process.env.GITHUB_TEST_REPO_NAME || 'oet';
const BASE_BRANCH = process.env.GITHUB_DEFAULT_BRANCH || 'main';

let octokitInstance;

async function getInstallationOctokit() {
  if (octokitInstance) return octokitInstance;

  console.log(
    `[Test PR Script - getInstallationOctokit] Using GITHUB_APP_ID from script var.`
  );
  console.log(
    `[Test PR Script - getInstallationOctokit] GITHUB_PRIVATE_KEY_BASE64 is ${privateKeyBase64 ? 'SET' : 'NOT SET'} in script var.`
  );

  if (!appId || !privateKeyBase64) {
    throw new Error(
      '[Test PR Script] GitHub App ID or Private Key missing or empty after loading. Check .env or environment variables.'
    );
  }

  let privateKeyPem;
  try {
    privateKeyPem = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
    if (!privateKeyPem.startsWith('-----BEGIN')) {
      throw new Error(
        'Decoded private key does not appear to be in PEM format.'
      );
    }
  } catch (e) {
    throw new Error(
      '[Test PR Script] Failed to decode GITHUB_PRIVATE_KEY_BASE64: ' +
        e.message
    );
  }

  const appAuth = createAppAuth({ appId, privateKey: privateKeyPem });
  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey: privateKeyPem },
  });

  let installation;
  try {
    const { data } = await appOctokit.rest.apps.getRepoInstallation({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
    });
    installation = data;
  } catch (e) {
    console.error(
      `[Test PR Script] Failed to get repo installation for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}. Status: ${e.status}`
    );
    throw new Error(
      `App installation not found or accessible for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}. Ensure the GitHub App is installed and has permissions.`
    );
  }

  if (!installation.id) {
    throw new Error(
      `[Test PR Script] App installation ID not found for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`
    );
  }

  const { token } = await appAuth({
    type: 'installation',
    installationId: installation.id,
  });

  octokitInstance = new Octokit({ auth: token });
  console.log('[Test PR Script] GitHub App authentication successful.');
  return octokitInstance;
}

function toPascalCase(kebabCase) {
  if (!kebabCase) return 'DummyTool';
  return kebabCase
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

async function createDummyToolFiles(toolDirective, includeLintError = false) {
  const projectRoot = path.resolve(fileURLToPath(import.meta.url), '..', '..');
  const toolDir = path.join(projectRoot, 'app', 'tool', toolDirective);
  const componentsDir = path.join(toolDir, '_components');

  console.log(`[Test PR Script] Creating dummy files in: ${toolDir}`);
  await fs.mkdir(componentsDir, { recursive: true });

  const pascalCaseName = toPascalCase(toolDirective);

  const metadataContent = JSON.stringify(
    {
      title: `CI Test: ${pascalCaseName}${includeLintError ? ' (With Lint Error)' : ''}`,
      directive: toolDirective,
      description: `A dummy tool for testing CI workflows: ${toolDirective}${includeLintError ? '. This version includes intentional lint errors.' : '.'}`,
      inputConfig: { acceptsMimeTypes: ['text/plain'], stateFiles: 'none' },
      outputConfig: { transferableContent: 'none' },
      tags: ['test', 'ci', 'dummy'],
      includeInSitemap: false,
      status: 'stable',
    },
    null,
    2
  );
  await fs.writeFile(path.join(toolDir, 'metadata.json'), metadataContent);

  const pageContent = `
// FILE: app/tool/${toolDirective}/page.tsx
import React from 'react';
import ToolHeader from '../../_components/ToolHeader';
import metadata from './metadata.json';
import ToolSuspenseWrapper from '../../_components/ToolSuspenseWrapper';
import ${pascalCaseName}Client from './_components/${pascalCaseName}Client';
import { ToolMetadata } from '@/src/types/tools';

export default function ${pascalCaseName}Page() {
  const typedMetadata = metadata as ToolMetadata;
  return (
    <div className="relative flex flex-col gap-4">
      <ToolHeader title={typedMetadata.title} description={typedMetadata.description} />
      <ToolSuspenseWrapper>
        <${pascalCaseName}Client toolRoute="/tool/${toolDirective}" />
      </ToolSuspenseWrapper>
    </div>
  );
}`;
  await fs.writeFile(path.join(toolDir, 'page.tsx'), pageContent.trim());

  let clientContentJs = `
// FILE: app/tool/${toolDirective}/_components/${pascalCaseName}Client.tsx
'use client';
import React, { useEffect } from 'react';

export default function ${pascalCaseName}Client({ toolRoute }: { toolRoute: string }) {
  // Minimal client component for testing

  // --- Start of Intentionally Problematic Code (if includeLintError is true) ---
  // --- End of Intentionally Problematic Code ---

  return (
    <div>
      <h2>Hello from ${pascalCaseName}Client! (Tool Route: {toolRoute})</h2>
      <p>This is a dummy tool for CI testing.</p>
      <p>Current Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}`;

  if (includeLintError) {
    const lintErrorBlock = `
  let usedAny: any = { message: "I am used and explicitly any." };
  console.log('Logging usedAny to ensure it is used:', usedAny.message);
  
  const unusedAny: any = { value: "I am unused and explicitly any" }; 
  // This 'unusedAny' should trigger @typescript-eslint/no-unused-vars (likely error in Next.js)
  // The 'any' type itself might trigger @typescript-eslint/no-explicit-any (error or warning based on config)

  function problematicFunction(param1: any, param2) { // param2 implicitly any
    const anotherUnused: number = 123; // Another unused variable
    let result: any = param1 + (param2 || 0); // Using any again
    return result;
  }
  // problematicFunction is defined but not used, which can also be an error/warning.
`;
    clientContentJs = clientContentJs.replace(
      '  // --- End of Intentionally Problematic Code ---',
      lintErrorBlock + '\n  // --- End of Intentionally Problematic Code ---'
    );
  } else {
    clientContentJs = clientContentJs.replace(
      '  // --- Start of Intentionally Problematic Code (if includeLintError is true) ---\n  // --- End of Intentionally Problematic Code ---',
      '  const normallyFineVariable = "This should be fine.";\n  console.log(normallyFineVariable); // Use it to avoid unused var warning if not including other errors'
    );
  }

  await fs.writeFile(
    path.join(componentsDir, `${pascalCaseName}Client.tsx`),
    clientContentJs.trim()
  );

  console.log(
    `[Test PR Script] Dummy files created locally for tool: ${toolDirective}${includeLintError ? ' (with intentional lint errors)' : ''}`
  );
  return [
    `app/tool/${toolDirective}/metadata.json`,
    `app/tool/${toolDirective}/page.tsx`,
    `app/tool/${toolDirective}/_components/${pascalCaseName}Client.tsx`,
  ];
}

async function createBlob(octokit, content) {
  const { data: blobData } = await octokit.rest.git.createBlob({
    owner: GITHUB_REPO_OWNER,
    repo: GITHUB_REPO_NAME,
    content: content,
    encoding: 'utf-8',
  });
  return blobData.sha;
}

async function main() {
  await loadEnv();

  appId = process.env.GITHUB_APP_ID;
  privateKeyBase64 = process.env.GITHUB_PRIVATE_KEY_BASE64;

  console.log(`[Test PR Script - main] GITHUB_APP_ID: "${appId}"`);
  console.log(
    `[Test PR Script - main] GITHUB_PRIVATE_KEY_BASE64 is ${privateKeyBase64 ? 'SET' : 'NOT SET'}`
  );

  const octokit = await getInstallationOctokit();

  const args = process.argv.slice(2);
  let toolName = args.find((arg) => !arg.startsWith('--'));
  const prTitleArg = args
    .find((arg) => arg.startsWith('--title='))
    ?.split('=')[1];
  const prBodyArg = args
    .find((arg) => arg.startsWith('--body='))
    ?.split('=')[1];
  const makeExternalCall = args.includes('--external-call');
  const includeLintErrorFlag = args.includes('--lint-errors');

  if (!toolName) {
    const timestamp = Date.now().toString().slice(-6);
    toolName = `ci-test-${timestamp}`;
    console.log(
      `[Test PR Script] No tool name provided, using generated: ${toolName}`
    );
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(toolName)) {
    console.error(
      `[Test PR Script] Error: Invalid tool name format: "${toolName}". Must be kebab-case.`
    );
    process.exit(1);
  }

  const newBranchName = `feat/gen-${toolName}-${Date.now().toString().slice(-5)}`;
  let prTitle = prTitleArg || `feat(CI): Add Test Tool - ${toolName}`;
  if (includeLintErrorFlag) {
    prTitle += ' (with lint errors)';
  }
  let prBody =
    prBodyArg ||
    `This PR was automatically generated by the generate-test-pr.mjs script for testing CI workflows.\n\nTool: \`${toolName}\`\n\n---START_DEPS---\n[]\n---END_DEPS---`;

  if (includeLintErrorFlag) {
    prBody +=
      '\n\n**Note:** This PR intentionally includes lint errors for testing the AI Lint Fixer workflow.';
  }
  if (makeExternalCall) {
    prBody +=
      '\n\n**Note:** This tool is configured to make a test external network call to verify Douglas checker functionality.';
  }

  const projectRoot = path.resolve(fileURLToPath(import.meta.url), '..', '..');

  try {
    console.log(
      `[Test PR Script] Fetching SHA for base branch: ${BASE_BRANCH}...`
    );
    const { data: baseBranchData } = await octokit.rest.repos.getBranch({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      branch: BASE_BRANCH,
    });
    const baseSha = baseBranchData.commit.sha;
    console.log(`[Test PR Script] Base SHA (${BASE_BRANCH}): ${baseSha}`);

    console.log(
      `[Test PR Script] Creating new branch: ${newBranchName} from ${BASE_BRANCH} (SHA: ${baseSha})...`
    );
    await octokit.rest.git.createRef({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      ref: `refs/heads/${newBranchName}`,
      sha: baseSha,
    });
    console.log(`[Test PR Script] Branch ${newBranchName} created.`);

    const filePaths = await createDummyToolFiles(
      toolName,
      includeLintErrorFlag
    );

    if (makeExternalCall) {
      const clientComponentPath = path.join(
        projectRoot,
        `app/tool/${toolName}/_components/${toPascalCase(toolName)}Client.tsx`
      );
      let clientContent = await fs.readFile(clientComponentPath, 'utf-8');
      const useEffectImportOriginal = "import React from 'react';";
      const useEffectImportReplacement =
        "import React, { useEffect } from 'react';";

      if (
        clientContent.includes(useEffectImportOriginal) &&
        !clientContent.includes("useEffect } from 'react'") &&
        !clientContent.includes("import React, { useEffect } from 'react';")
      ) {
        clientContent = clientContent.replace(
          useEffectImportOriginal,
          useEffectImportReplacement
        );
      } else if (
        !clientContent.includes("import React, { useEffect } from 'react';") &&
        clientContent.includes("import React from 'react';")
      ) {
        clientContent = clientContent.replace(
          "import React from 'react';",
          "import React, { useEffect } from 'react';"
        );
      } else if (!clientContent.match(/import React[ ,{]/)) {
        clientContent = useEffectImportReplacement + '\n' + clientContent;
      }

      const externalCallEffect = `
  useEffect(() => {
    console.log('[${toPascalCase(toolName)}Client] Making deliberate external call for Douglas test...');
    fetch('https://jsonplaceholder.typicode.com/todos/1')
      .then(res => res.json())
      .then(data => console.log('[${toPascalCase(toolName)}Client] External call data:', data))
      .catch(err => console.error('[${toPascalCase(toolName)}Client] External call error:', err));
  }, []);`;
      const returnStatementIndex = clientContent.lastIndexOf('return (');
      if (returnStatementIndex !== -1) {
        clientContent =
          clientContent.slice(0, returnStatementIndex) +
          externalCallEffect +
          clientContent.slice(returnStatementIndex);
        await fs.writeFile(clientComponentPath, clientContent);
        console.log(
          `[Test PR Script] Modified ${toPascalCase(toolName)}Client.tsx to include an external call.`
        );
      } else {
        console.warn(
          `[Test PR Script] Could not find "return (" to inject useEffect for external call in ${clientComponentPath}.`
        );
      }
    }

    const treeObjects = [];
    for (const relativeFilePath of filePaths) {
      const fullFilePath = path.join(projectRoot, relativeFilePath);
      const content = await fs.readFile(fullFilePath, 'utf-8');
      const blobSha = await createBlob(octokit, content);
      treeObjects.push({
        path: relativeFilePath,
        mode: '100644',
        type: 'blob',
        sha: blobSha,
      });
      console.log(`[Test PR Script] Prepared blob for ${relativeFilePath}`);
    }

    console.log('[Test PR Script] Creating new git tree...');
    const { data: treeData } = await octokit.rest.git.createTree({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      base_tree: baseSha,
      tree: treeObjects,
    });
    console.log(`[Test PR Script] New tree created (SHA: ${treeData.sha})`);

    console.log('[Test PR Script] Creating new commit...');
    let commitMessage = `feat(CI): Add dummy tool ${toolName}`;
    if (includeLintErrorFlag) commitMessage += ' (with lint errors)';
    if (makeExternalCall) commitMessage += ' (with external call)';

    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      message: commitMessage,
      tree: treeData.sha,
      parents: [baseSha],
      author: {
        name: 'OET Script Bot',
        email: 'bot@online-everything-tool.com',
      },
    });
    console.log(`[Test PR Script] New commit created (SHA: ${newCommit.sha})`);

    console.log(
      `[Test PR Script] Updating branch ${newBranchName} to point to commit ${newCommit.sha}...`
    );
    await octokit.rest.git.updateRef({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      ref: `heads/${newBranchName}`,
      sha: newCommit.sha,
    });
    console.log(`[Test PR Script] Branch ${newBranchName} updated.`);

    console.log(`[Test PR Script] Creating Pull Request: "${prTitle}"...`);
    const { data: pullRequest } = await octokit.rest.pulls.create({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      title: prTitle,
      body: prBody,
      head: newBranchName,
      base: BASE_BRANCH,
      maintainer_can_modify: true,
    });
    console.log(
      `✅ [Test PR Script] Pull Request created successfully! URL: ${pullRequest.html_url}`
    );
  } catch (error) {
    console.error('❌ [Test PR Script] Error in script:');
    if (error.status) {
      console.error(`  Status: ${error.status}`);
    }
    if (error.message) {
      console.error(`  Message: ${error.message}`);
    }
    if (error.response?.data?.errors) {
      console.error('  GitHub API Errors:');
      error.response.data.errors.forEach((err) =>
        console.error(
          `    - ${err.resource} ${err.field}: ${err.code} (${err.message})`
        )
      );
    } else if (error.response?.data) {
      console.error('  GitHub API Response Data:', error.response.data);
    }
    if (error.stack && !error.status) {
      // console.error('  Stack trace:', error.stack);
    }
    if (!error.status) {
      console.error('Full error object:', error);
    }
  } finally {
    const toolFilesDir = path.join(projectRoot, 'app', 'tool', toolName);
    try {
      const stats = await fs.stat(toolFilesDir).catch(() => null);
      if (stats && stats.isDirectory()) {
        await fs.rm(toolFilesDir, { recursive: true, force: true });
        console.log(
          `[Test PR Script] Cleaned up local dummy files for ${toolName}.`
        );
      } else {
        // console.log(`[Test PR Script] Local dummy files directory for ${toolName} not found or already cleaned.`);
      }
    } catch (cleanupError) {
      console.warn(
        `[Test PR Script] Warning: Could not clean up local dummy files for ${toolName}: ${cleanupError.message}`
      );
    }
  }
}

main();
