// FILE: scripts/generate-real-pr.mjs
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configuration (Paths relative to project root) ---
const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPTS_DIR, '..');
const TOOLS_BASE_DIR = path.join(PROJECT_ROOT, 'app', 'tool');
const PUBLIC_DATA_BASE_DIR = path.join(PROJECT_ROOT, 'public', 'data'); // For static assets

// Helper to load .env (basic version)
async function loadEnv() {
  try {
    const envPath = path.resolve(PROJECT_ROOT, '.env');
    const envFile = await fs.readFile(envPath, 'utf-8');
    envFile.split('\n').forEach((line) => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts
          .join('=')
          .replace(/^["'](.*)["']$/, '$1')
          .trim();
        if (key && value) {
          process.env[key.trim()] = value;
        } else if (key && valueParts.length === 0) {
          process.env[key.trim()] = '';
        }
      }
    });
    console.log('[Real PR Script - loadEnv] Finished parsing .env.');
  } catch (error) {
    // @ts-ignore
    console.warn(
      `[Real PR Script - loadEnv] Could not load .env file. Error: ${error.message}`
    );
  }
}

// Module-scoped variables
let appId;
let privateKeyBase64;

const GITHUB_REPO_OWNER =
  process.env.GITHUB_REPO_OWNER || 'Online-Everything-Tool'; // Use your actual repo owner
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'oet'; // Use your actual repo name
const BASE_BRANCH = process.env.GITHUB_DEFAULT_BRANCH || 'main';

let octokitInstance;

async function getInstallationOctokit() {
  if (octokitInstance) return octokitInstance;

  if (!appId || !privateKeyBase64) {
    throw new Error(
      '[Real PR Script] GitHub App ID or Private Key missing. Check .env or environment variables (GITHUB_APP_ID, GITHUB_PRIVATE_KEY_BASE64).'
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
    // @ts-ignore
    throw new Error(
      `[Real PR Script] Failed to decode GITHUB_PRIVATE_KEY_BASE64: ${e.message}`
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
    // @ts-ignore
    console.error(
      `[Real PR Script] Failed to get repo installation for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}. Status: ${e.status}`
    );
    throw new Error(
      // @ts-ignore
      `App installation not found or accessible for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}. Ensure App has permissions. Message: ${e.message}`
    );
  }

  // @ts-ignore
  if (!installation.id) {
    throw new Error(
      `[Real PR Script] App installation ID not found for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`
    );
  }

  // @ts-ignore
  const { token } = await appAuth({
    type: 'installation',
    installationId: installation.id,
  });
  octokitInstance = new Octokit({ auth: token });
  console.log('[Real PR Script] GitHub App authentication successful.');
  return octokitInstance;
}

// Recursively get all file paths from a directory
async function getAllFilePaths(dirPath, originalBasePath = dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const res = path.resolve(dirPath, entry.name);
      if (entry.isDirectory()) {
        return getAllFilePaths(res, originalBasePath);
      }
      // Return path relative to the original base path (e.g., app/tool/<directive> or public/data/<directive>)
      return path.relative(PROJECT_ROOT, res);
    })
  );
  return Array.prototype.concat(...files);
}

async function createBlob(octokit, contentBuffer) {
  // Takes Buffer for binary files
  const { data: blobData } = await octokit.rest.git.createBlob({
    owner: GITHUB_REPO_OWNER,
    repo: GITHUB_REPO_NAME,
    content: contentBuffer.toString('base64'), // Base64 encode for GitHub API
    encoding: 'base64',
  });
  return blobData.sha;
}

async function main() {
  await loadEnv();

  appId = process.env.GITHUB_APP_ID;
  privateKeyBase64 = process.env.GITHUB_PRIVATE_KEY_BASE64;

  const args = process.argv.slice(2);
  const toolDirective = args.find((arg) => !arg.startsWith('--'));
  const prTitleArg = args
    .find((arg) => arg.startsWith('--title='))
    ?.split('=')[1];
  const prBodyArg = args
    .find((arg) => arg.startsWith('--body='))
    ?.split('=')[1];
  const prBaseBranchArg = args
    .find((arg) => arg.startsWith('--base='))
    ?.split('=')[1];

  if (!toolDirective) {
    console.error(
      'Error: Tool directive (folder name) must be provided as the first argument.'
    );
    console.log(
      'Usage: node scripts/generate-real-pr.mjs <tool-directive> [--title="PR Title"] [--body="PR Body"] [--base="target-branch"]'
    );
    process.exit(1);
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(toolDirective)) {
    console.error(
      `Error: Invalid tool directive format: "${toolDirective}". Must be kebab-case.`
    );
    process.exit(1);
  }

  const sourceToolDir = path.join(TOOLS_BASE_DIR, toolDirective);
  const sourcePublicDataDir = path.join(PUBLIC_DATA_BASE_DIR, toolDirective); // For static assets

  try {
    await fs.access(sourceToolDir);
  } catch (error) {
    console.error(`Error: Source tool directory not found: ${sourceToolDir}`);
    process.exit(1);
  }

  // --- Read tool-generation-info.json ---
  const toolInfoPath = path.join(sourceToolDir, 'tool-generation-info.json');
  let toolInfo = {
    identifiedDependencies: [],
    generatorModel: 'Unknown',
    notes: '',
  }; // Default structure
  let identifiedDependenciesString = '[]'; // Default for PR body

  try {
    const toolInfoContent = await fs.readFile(toolInfoPath, 'utf-8');
    toolInfo = JSON.parse(toolInfoContent);
    if (
      toolInfo.identifiedDependencies &&
      Array.isArray(toolInfo.identifiedDependencies)
    ) {
      identifiedDependenciesString = JSON.stringify(
        toolInfo.identifiedDependencies.map((dep) => dep.packageName || dep),
        null,
        2
      );
    }
    console.log(
      `[Real PR Script] Read tool-generation-info.json for ${toolDirective}.`
    );
  } catch (error) {
    console.warn(
      `[Real PR Script] Warning: Could not read or parse ${toolInfoPath}. Proceeding with default/empty dependency info.`
    );
    // @ts-ignore
    console.warn(`  Error: ${error.message}`);
  }

  const branchSuffix = Date.now().toString().slice(-5);
  const newBranchName = `feat/gen-${toolDirective}-${branchSuffix}`;
  const prTitle = prTitleArg || `feat: Add New Tool - ${toolDirective}`;
  const prBody =
    prBodyArg ||
    `This PR introduces the new AI-assisted or manually prepared tool: \`${toolDirective}\`.

**Tool Generation Information:**
- Model Used: \`${toolInfo.generatorModel || 'N/A (Manual or Pre-existing)'}\`
${toolInfo.notes ? `- Notes: ${toolInfo.notes}\n` : ''}

**Identified Dependencies (from tool-generation-info.json):**
\`\`\`json
${identifiedDependenciesString}
\`\`\`

Please review the code, functionality, and ensure all dependencies are correctly handled by CI.
`;

  const targetBaseBranch = prBaseBranchArg || BASE_BRANCH;

  const octokit = await getInstallationOctokit();

  try {
    console.log(`Fetching SHA for base branch: ${targetBaseBranch}...`);
    const { data: baseBranchData } = await octokit.rest.repos.getBranch({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      branch: targetBaseBranch,
    });
    const baseSha = baseBranchData.commit.sha;
    console.log(`Base SHA (${targetBaseBranch}): ${baseSha}`);

    console.log(
      `Creating new branch: ${newBranchName} from ${targetBaseBranch} (SHA: ${baseSha})...`
    );
    await octokit.rest.git.createRef({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      ref: `refs/heads/${newBranchName}`,
      sha: baseSha,
    });
    console.log(`Branch ${newBranchName} created.`);

    const treeObjects = [];

    // 1. Process files from app/tool/<directive>/
    const toolFilesRelativePaths = await getAllFilePaths(sourceToolDir);
    console.log(`Found files in ${sourceToolDir}:`, toolFilesRelativePaths);
    for (const relativeFilePath of toolFilesRelativePaths) {
      const fullFilePath = path.join(PROJECT_ROOT, relativeFilePath); // Use project root to make absolute path
      const contentBuffer = await fs.readFile(fullFilePath); // Read as buffer
      const blobSha = await createBlob(octokit, contentBuffer);
      treeObjects.push({
        path: relativeFilePath, // Path relative to project root
        mode: '100644',
        type: 'blob',
        sha: blobSha,
      });
      console.log(`Prepared blob for ${relativeFilePath}`);
    }

    // 2. Process files from public/data/<directive>/ (if exists)
    try {
      await fs.access(sourcePublicDataDir); // Check if directory exists
      const publicDataFilesRelativePaths =
        await getAllFilePaths(sourcePublicDataDir);
      console.log(
        `Found files in ${sourcePublicDataDir}:`,
        publicDataFilesRelativePaths
      );
      for (const relativeFilePath of publicDataFilesRelativePaths) {
        const fullFilePath = path.join(PROJECT_ROOT, relativeFilePath);
        const contentBuffer = await fs.readFile(fullFilePath); // Read as buffer for assets
        const blobSha = await createBlob(octokit, contentBuffer);
        treeObjects.push({
          path: relativeFilePath, // Path relative to project root
          mode: '100644',
          type: 'blob',
          sha: blobSha,
        });
        console.log(`Prepared blob for asset ${relativeFilePath}`);
      }
    } catch (error) {
      // @ts-ignore
      if (error.code === 'ENOENT') {
        console.log(
          `No public data directory found at ${sourcePublicDataDir}, skipping asset processing.`
        );
      } else {
        console.warn(
          `Warning: Could not process public data directory ${sourcePublicDataDir}: ${error}`
        );
      }
    }

    if (treeObjects.length === 0) {
      console.error(
        'Error: No files found to commit in the specified tool or public data directories.'
      );
      // Optionally, delete the created branch if no files
      await octokit.rest.git.deleteRef({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
        ref: `heads/${newBranchName}`,
      });
      console.log(`Cleaned up empty branch ${newBranchName}.`);
      process.exit(1);
    }

    console.log('Creating new git tree...');
    const { data: treeData } = await octokit.rest.git.createTree({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      base_tree: baseSha, // Important to base on the target branch's tree if it's not empty
      tree: treeObjects,
    });
    console.log(`New tree created (SHA: ${treeData.sha})`);

    const commitMessage = `feat: Add tool '${toolDirective}' and associated assets`;
    console.log('Creating new commit...');
    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      message: commitMessage,
      tree: treeData.sha,
      parents: [baseSha],
      author: {
        name: 'OET Real PR Script Bot',
        email: 'bot@online-everything-tool.com',
      },
    });
    console.log(`New commit created (SHA: ${newCommit.sha})`);

    console.log(
      `Updating branch ${newBranchName} to point to commit ${newCommit.sha}...`
    );
    await octokit.rest.git.updateRef({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      ref: `heads/${newBranchName}`,
      sha: newCommit.sha,
    });
    console.log(`Branch ${newBranchName} updated.`);

    console.log(`Creating Pull Request: "${prTitle}"...`);
    const { data: pullRequest } = await octokit.rest.pulls.create({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      title: prTitle,
      body: prBody,
      head: newBranchName,
      base: targetBaseBranch,
      maintainer_can_modify: true,
    });
    console.log(
      `✅ Pull Request created successfully! URL: ${pullRequest.html_url}`
    );
  } catch (error) {
    console.error('❌ Error in script:');
    // @ts-ignore
    if (error.status) {
      console.error(`  Status: ${error.status}`);
    }
    // @ts-ignore
    if (error.message) {
      console.error(`  Message: ${error.message}`);
    }
    // @ts-ignore
    if (error.response?.data?.errors) {
      console.error('  GitHub API Errors:');
      // @ts-ignore
      error.response.data.errors.forEach((err) =>
        // @ts-ignore
        console.error(
          `    - ${err.resource} ${err.field}: ${err.code} (${err.message})`
        )
      );
      // @ts-ignore
    } else if (error.response?.data) {
      // @ts-ignore
      console.error('  GitHub API Response Data:', error.response.data);
    }
    // @ts-ignore
    if (error.stack && !error.status) {
      /* console.error('  Stack trace:', error.stack); */
    }
    // @ts-ignore
    if (!error.status) {
      console.error('Full error object:', error);
    }
  }
}

main();
