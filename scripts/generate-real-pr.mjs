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
const PUBLIC_DATA_BASE_DIR = path.join(PROJECT_ROOT, 'public', 'data');

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
      `[Real PR Script - loadEnv] Could not load .env file. Error: ${error.message}. Ensure GITHUB_APP_ID and GITHUB_PRIVATE_KEY_BASE64 are set as environment variables if .env is not used.`
    );
  }
}

let appIdEnv;
let privateKeyBase64Env;

const GITHUB_REPO_OWNER_ENV =
  process.env.GITHUB_REPO_OWNER || 'Online-Everything-Tool';
const GITHUB_REPO_NAME_ENV = process.env.GITHUB_REPO_NAME || 'oet';
const BASE_BRANCH_ENV = process.env.GITHUB_DEFAULT_BRANCH || 'main';

let octokitInstance;

async function getInstallationOctokit() {
  if (octokitInstance) return octokitInstance;

  if (!appIdEnv || !privateKeyBase64Env) {
    throw new Error(
      '[Real PR Script] GitHub App ID or Private Key missing. Check .env or environment variables (GITHUB_APP_ID, GITHUB_PRIVATE_KEY_BASE64).'
    );
  }

  let privateKeyPem;
  try {
    privateKeyPem = Buffer.from(privateKeyBase64Env, 'base64').toString(
      'utf-8'
    );
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

  const appAuth = createAppAuth({ appId: appIdEnv, privateKey: privateKeyPem });
  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: { appId: appIdEnv, privateKey: privateKeyPem },
  });

  let installation;
  try {
    console.log(
      `[Real PR Script] Fetching GitHub App installation for ${GITHUB_REPO_OWNER_ENV}/${GITHUB_REPO_NAME_ENV}...`
    );
    const { data } = await appOctokit.rest.apps.getRepoInstallation({
      owner: GITHUB_REPO_OWNER_ENV,
      repo: GITHUB_REPO_NAME_ENV,
    });
    installation = data;
  } catch (e) {
    // @ts-ignore
    console.error(
      `[Real PR Script] Failed to get repo installation for ${GITHUB_REPO_OWNER_ENV}/${GITHUB_REPO_NAME_ENV}. Status: ${e?.status}`
    );
    throw new Error(
      // @ts-ignore
      `App installation not found or accessible for ${GITHUB_REPO_OWNER_ENV}/${GITHUB_REPO_NAME_ENV}. Ensure App has permissions. Message: ${e?.message}`
    );
  }

  if (!installation.id) {
    throw new Error(
      `[Real PR Script] App installation ID not found for ${GITHUB_REPO_OWNER_ENV}/${GITHUB_REPO_NAME_ENV}`
    );
  }

  const { token } = await appAuth({
    type: 'installation',
    installationId: installation.id,
  });
  octokitInstance = new Octokit({ auth: token });
  console.log('[Real PR Script] GitHub App authentication successful.');
  return octokitInstance;
}

async function getAllFilePaths(dirPath, originalBasePath = dirPath) {
  let allFiles = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const res = path.resolve(dirPath, entry.name);
      if (entry.isDirectory()) {
        allFiles = allFiles.concat(
          await getAllFilePaths(res, originalBasePath)
        );
      } else {
        allFiles.push(path.relative(PROJECT_ROOT, res));
      }
    }
  } catch (error) {
    // @ts-ignore
    if (error.code === 'ENOENT') {
      // directory doesn't exist, which is fine for optional dirs like public/data
      return [];
    }
    throw error; // re-throw other errors
  }
  return allFiles;
}

async function createBlob(octokit, contentBuffer) {
  const { data: blobData } = await octokit.rest.git.createBlob({
    owner: GITHUB_REPO_OWNER_ENV,
    repo: GITHUB_REPO_NAME_ENV,
    content: contentBuffer.toString('base64'),
    encoding: 'base64',
  });
  return blobData.sha;
}

const formatListForPrBody = (
  items,
  noneMessage = '_None provided._',
  prefix = '- '
) => {
  if (!items || !Array.isArray(items) || items.length === 0) return noneMessage;
  return items.map((item) => `${prefix}\`${item}\``).join('\n');
};

async function main() {
  console.log('[Real PR Script] Starting...');
  await loadEnv(); // Load .env variables into process.env

  appIdEnv = process.env.GITHUB_APP_ID;
  privateKeyBase64Env = process.env.GITHUB_PRIVATE_KEY_BASE64;

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
  console.log(`[Real PR Script] Processing tool directive: ${toolDirective}`);

  const sourceToolDir = path.join(TOOLS_BASE_DIR, toolDirective);
  const sourcePublicDataDir = path.join(PUBLIC_DATA_BASE_DIR, toolDirective);

  try {
    await fs.access(sourceToolDir);
    console.log(`[Real PR Script] Found tool directory: ${sourceToolDir}`);
  } catch (error) {
    console.error(`Error: Source tool directory not found: ${sourceToolDir}`);
    process.exit(1);
  }

  const toolInfoPath = path.join(sourceToolDir, 'tool-generation-info.json');
  let toolInfo = {
    toolDirective: toolDirective, // Default from arg
    generatorModel: 'N/A (Manual or Pre-existing)',
    identifiedDependencies: [],
    assetInstructions: null,
    generativeDescription: `Tool for ${toolDirective}`, // Basic default
    additionalDescription: '',
    generativeRequestedDirectives: [],
    userSelectedExampleDirectives: [],
    notes: '',
  };

  try {
    const toolInfoContent = await fs.readFile(toolInfoPath, 'utf-8');
    const parsedInfo = JSON.parse(toolInfoContent);
    toolInfo = { ...toolInfo, ...parsedInfo }; // Merge with defaults, parsed overwrites
    console.log(
      `[Real PR Script] Successfully read and parsed ${toolInfoPath}.`
    );
  } catch (error) {
    console.warn(
      `[Real PR Script] Warning: Could not read or parse ${toolInfoPath}. Proceeding with defaults.`
    );
    // @ts-ignore
    console.warn(`  Error details: ${error.message}`);
  }

  const branchSuffix = Date.now().toString().slice(-6); // Slightly longer suffix
  const newBranchName = `feat/gen-${toolDirective}-${branchSuffix}`;
  const defaultPrTitle = `feat: Add New Tool - ${toolDirective}`;
  const prTitle = prTitleArg || defaultPrTitle;

  // Construct PR Body (enhanced)
  const identifiedDependenciesForBody = (
    toolInfo.identifiedDependencies &&
    Array.isArray(toolInfo.identifiedDependencies)
      ? toolInfo.identifiedDependencies.map((dep) =>
          typeof dep === 'string' ? dep : dep.packageName
        )
      : []
  ).filter(Boolean);

  const prBody =
    prBodyArg ||
    `This PR introduces the new AI-assisted or manually prepared tool: \`${toolDirective}\`.

**AI Generated Description (from tool-generation-info.json or default):**
${toolInfo.generativeDescription || '_No AI description provided._'}

**User Provided Details/Refinements (from tool-generation-info.json, if any):**
${toolInfo.additionalDescription || '_None provided._'}

**AI Model Used for Generation (from tool-generation-info.json):**
${toolInfo.generatorModel ? `\`${toolInfo.generatorModel}\`` : '_Not specified_'}

**Dependencies Identified (from tool-generation-info.json):**
${formatListForPrBody(identifiedDependenciesForBody, '_None explicitly identified._')}
${identifiedDependenciesForBody.length > 0 ? '\n_Note: CI will attempt to vet and install these dependencies. Review PR checks for status._' : ''}

${toolInfo.assetInstructions ? `**Manual Asset Instructions (from tool-generation-info.json):**\n\`\`\`text\n${toolInfo.assetInstructions}\n\`\`\`\n_Note: If this tool requires manual asset placement, please ensure they are added as per these instructions._\n` : ''}

**AI Requested Examples During Tool Conception (from tool-generation-info.json):**
${formatListForPrBody(toolInfo.generativeRequestedDirectives, '_None requested or loaded._')}

**User Selected Examples During Tool Conception (from tool-generation-info.json):**
${formatListForPrBody(toolInfo.userSelectedExampleDirectives, '_None selected by user._')}

${toolInfo.notes ? `**Additional Notes (from tool-generation-info.json):**\n${toolInfo.notes}\n` : ''}
*Please review the attached code changes and CI checks.*
`;

  const targetBaseBranch = prBaseBranchArg || BASE_BRANCH_ENV;

  const octokit = await getInstallationOctokit();

  try {
    console.log(`Fetching SHA for base branch: ${targetBaseBranch}...`);
    const { data: baseBranchData } = await octokit.rest.repos.getBranch({
      owner: GITHUB_REPO_OWNER_ENV,
      repo: GITHUB_REPO_NAME_ENV,
      branch: targetBaseBranch,
    });
    const baseSha = baseBranchData.commit.sha;
    console.log(`Base SHA (${targetBaseBranch}): ${baseSha}`);

    console.log(
      `Creating new branch: ${newBranchName} from ${targetBaseBranch} (SHA: ${baseSha})...`
    );
    await octokit.rest.git.createRef({
      owner: GITHUB_REPO_OWNER_ENV,
      repo: GITHUB_REPO_NAME_ENV,
      ref: `refs/heads/${newBranchName}`,
      sha: baseSha,
    });
    console.log(`Branch ${newBranchName} created.`);

    const treeObjects = [];

    console.log(`Processing files from tool directory: ${sourceToolDir}`);
    const toolFilesRelativePaths = await getAllFilePaths(sourceToolDir);
    if (toolFilesRelativePaths.length > 0) {
      console.log(
        `Found files in ${sourceToolDir}:`,
        toolFilesRelativePaths.join(', ')
      );
      for (const relativeFilePath of toolFilesRelativePaths) {
        const fullFilePath = path.join(PROJECT_ROOT, relativeFilePath);
        const contentBuffer = await fs.readFile(fullFilePath);
        const blobSha = await createBlob(octokit, contentBuffer);
        treeObjects.push({
          path: relativeFilePath,
          mode: '100644',
          type: 'blob',
          sha: blobSha,
        });
        console.log(`  Prepared blob for ${relativeFilePath}`);
      }
    } else {
      console.log(`No files found in ${sourceToolDir}.`);
    }

    console.log(
      `Processing files from public data directory: ${sourcePublicDataDir}`
    );
    const publicDataFilesRelativePaths =
      await getAllFilePaths(sourcePublicDataDir);
    if (publicDataFilesRelativePaths.length > 0) {
      console.log(
        `Found files in ${sourcePublicDataDir}:`,
        publicDataFilesRelativePaths.join(', ')
      );
      for (const relativeFilePath of publicDataFilesRelativePaths) {
        const fullFilePath = path.join(PROJECT_ROOT, relativeFilePath);
        const contentBuffer = await fs.readFile(fullFilePath);
        const blobSha = await createBlob(octokit, contentBuffer);
        treeObjects.push({
          path: relativeFilePath,
          mode: '100644',
          type: 'blob',
          sha: blobSha,
        });
        console.log(`  Prepared blob for asset ${relativeFilePath}`);
      }
    } else {
      console.log(
        `No files found in ${sourcePublicDataDir} (this may be normal).`
      );
    }

    if (treeObjects.length === 0) {
      console.error(
        'Error: No files found to commit in the specified tool or public data directories.'
      );
      await octokit.rest.git.deleteRef({
        owner: GITHUB_REPO_OWNER_ENV,
        repo: GITHUB_REPO_NAME_ENV,
        ref: `heads/${newBranchName}`,
      });
      console.log(`Cleaned up empty branch ${newBranchName}.`);
      process.exit(1);
    }

    console.log('Creating new git tree with collected file blobs...');
    const { data: treeData } = await octokit.rest.git.createTree({
      owner: GITHUB_REPO_OWNER_ENV,
      repo: GITHUB_REPO_NAME_ENV,
      base_tree: baseSha,
      tree: treeObjects,
    });
    console.log(`New tree created (SHA: ${treeData.sha})`);

    const commitMessage = prTitle; // Use PR title as commit message for simplicity
    console.log(`Creating new commit with message: "${commitMessage}"...`);
    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner: GITHUB_REPO_OWNER_ENV,
      repo: GITHUB_REPO_NAME_ENV,
      message: commitMessage,
      tree: treeData.sha,
      parents: [baseSha],
      author: {
        name: 'OET Real PR Script Bot',
        email: 'bot@online-everything-tool.com', // Update if you have a specific bot email
      },
    });
    console.log(`New commit created (SHA: ${newCommit.sha})`);

    console.log(
      `Updating branch ${newBranchName} to point to commit ${newCommit.sha}...`
    );
    await octokit.rest.git.updateRef({
      owner: GITHUB_REPO_OWNER_ENV,
      repo: GITHUB_REPO_NAME_ENV,
      ref: `heads/${newBranchName}`,
      sha: newCommit.sha,
    });
    console.log(`Branch ${newBranchName} updated.`);

    console.log(`Creating Pull Request: "${prTitle}"...`);
    const { data: pullRequest } = await octokit.rest.pulls.create({
      owner: GITHUB_REPO_OWNER_ENV,
      repo: GITHUB_REPO_NAME_ENV,
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
    console.error('❌ Error in script execution:');
    // @ts-ignore
    if (error.status) {
      // @ts-ignore
      console.error(`  Status: ${error.status}`);
    }
    // @ts-ignore
    if (error.message) {
      // @ts-ignore
      console.error(`  Message: ${error.message}`);
    }
    // @ts-ignore
    if (error.response?.data?.errors) {
      console.error('  GitHub API Errors:');
      // @ts-ignore
      error.response.data.errors.forEach((err) =>
        console.error(
          // @ts-ignore
          `    - ${err.resource} ${err.field}: ${err.code} (${err.message})`
        )
      );
      // @ts-ignore
    } else if (error.response?.data) {
      // @ts-ignore
      console.error('  GitHub API Response Data (raw):', error.response.data);
    }
    // @ts-ignore
    if (error.stack && !error.status) {
      // console.error('  Stack trace:', error.stack); // Often too verbose
    }
    // @ts-ignore
    if (!error.status) {
      // Log full object for non-API errors
      console.error('Full error object:', error);
    }
  }
}

main().catch((e) => {
  console.error('Unhandled error in main execution:', e);
  process.exit(1);
});
