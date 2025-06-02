// FILE: app/api/create-anonymous-pr/route.ts
import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';
import { ToolGenerationInfoFileContent } from '@/src/types/build';

const GITHUB_USER_OR_ORG =
  process.env.GITHUB_REPO_OWNER || 'Online-Everything-Tool';
const GITHUB_REPO = process.env.GITHUB_REPO_NAME || 'oet';
const GITHUB_DEFAULT_BRANCH = process.env.GITHUB_DEFAULT_BRANCH || 'main';

const appId = process.env.GITHUB_APP_ID;
const privateKeyBase64 = process.env.GITHUB_PRIVATE_KEY_BASE64;

if (!appId || !privateKeyBase64) {
  console.error(
    '[API STARTUP create-anonymous-pr] ERROR: GitHub App credentials (GITHUB_APP_ID, GITHUB_PRIVATE_KEY_BASE64) missing.'
  );
} else {
  console.log(
    '[API STARTUP create-anonymous-pr] Required GitHub App credentials loaded.'
  );
}

interface LibraryDependency {
  packageName: string;
  reason?: string;
  importUsed?: string;
}

interface RequestBody {
  toolDirective: string;
  generatedFiles: { [filePath: string]: string };
  identifiedDependencies?: LibraryDependency[];
  generativeDescription?: string;
  additionalDescription?: string;
  generativeRequestedDirectives?: string[];
  userSelectedExampleDirectives?: string[] | null;
  selectedModel?: string;
  assetInstructions?: string | null;
}

const hasMessage = (e: unknown): e is { message: string } =>
  typeof e === 'object' &&
  e !== null &&
  'message' in e &&
  typeof (e as { message: unknown }).message === 'string';

const isPotentialErrorObject = (
  e: unknown
): e is {
  status?: unknown;
  message?: unknown;
  response?: { data?: { message?: string } };
} => typeof e === 'object' && e !== null;

async function getInstallationOctokit(): Promise<Octokit> {
  console.log('[API create-anonymous-pr] Attempting GitHub App auth...');
  if (!appId || !privateKeyBase64)
    throw new Error('Server config error: GitHub App credentials missing.');
  let privateKeyPem: string;
  try {
    privateKeyPem = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
    if (!privateKeyPem.startsWith('-----BEGIN'))
      throw new Error('Decoded private key format invalid.');
  } catch (decodeError: unknown) {
    const m = hasMessage(decodeError)
      ? decodeError.message
      : String(decodeError);
    throw new Error(`[API create-anonymous-pr] Private key decode Error: ${m}`);
  }

  try {
    const appAuth = createAppAuth({ appId, privateKey: privateKeyPem });
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: { appId, privateKey: privateKeyPem },
    });
    const { data: inst } = await appOctokit.rest.apps.getRepoInstallation({
      owner: GITHUB_USER_OR_ORG,
      repo: GITHUB_REPO,
    });
    if (!inst.id)
      throw new Error(
        `App install not found for ${GITHUB_USER_OR_ORG}/${GITHUB_REPO}`
      );
    const { token } = await appAuth({
      type: 'installation',
      installationId: inst.id,
    });
    const installationOctokit = new Octokit({ auth: token });
    console.log('[API create-anonymous-pr] GitHub App auth successful.');
    return installationOctokit;
  } catch (error: unknown) {
    console.error('[API create-anonymous-pr] Auth failure:', error);
    let errorMessage = 'Unknown auth error.';
    let errorStatus = 500;

    if (isPotentialErrorObject(error)) {
      const status =
        typeof error.status === 'number' ? error.status : undefined;
      const message =
        typeof error.message === 'string' ? error.message : undefined;
      const cause = (error as { cause?: unknown }).cause;
      const causeMessage = hasMessage(cause) ? cause.message : undefined;

      if (status === 404) {
        errorMessage = `GitHub App install not found for ${GITHUB_USER_OR_ORG}/${GITHUB_REPO}. Ensure app installed & has permissions.`;
      } else if (
        message?.includes('keyData') ||
        causeMessage?.includes('private key') ||
        message?.includes('PEM_read_bio_PrivateKey')
      ) {
        errorMessage = `Private key parse failed. Check format or env var GITHUB_PRIVATE_KEY_BASE64. Error: ${message || causeMessage}`;
      } else {
        errorMessage = message || errorMessage;
      }
      errorStatus = status || errorStatus;
    } else {
      errorMessage = String(error);
    }
    const wrappedError = new Error(
      `[API create-anonymous-pr] Auth Failed: ${errorMessage}`
    );
    if (
      errorStatus !== 500 ||
      (isPotentialErrorObject(error) && error.status)
    ) {
      Object.assign(wrappedError, { status: errorStatus });
    }
    throw wrappedError;
  }
}

export async function POST(request: Request) {
  console.log(
    `[API create-anonymous-pr] -------- POST Start (${new Date().toISOString()}) --------`
  );

  let toolDirective: string;
  let allGeneratedFiles: { [filePath: string]: string };
  let identifiedDependencies: LibraryDependency[];
  let generativeDescription: string;
  let additionalDescription: string;
  let generativeRequestedDirectives: string[];
  let userSelectedExampleDirectives: string[];
  let selectedModelName: string;
  let assetInstructions: string | null;

  try {
    const body: RequestBody = await request.json();

    toolDirective = body.toolDirective?.trim();
    allGeneratedFiles = body.generatedFiles;
    identifiedDependencies = Array.isArray(body.identifiedDependencies)
      ? body.identifiedDependencies
      : [];

    assetInstructions = body.assetInstructions || null;

    if (!toolDirective)
      throw new Error('Missing required field: toolDirective');
    if (
      typeof allGeneratedFiles !== 'object' ||
      allGeneratedFiles === null ||
      Object.keys(allGeneratedFiles).length === 0
    ) {
      throw new Error(
        'Missing or invalid required field: generatedFiles must be a non-empty object.'
      );
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(toolDirective)) {
      throw new Error(
        'Invalid toolDirective format. Must be lowercase kebab-case.'
      );
    }
    for (const [filePath, fileContent] of Object.entries(allGeneratedFiles)) {
      if (typeof fileContent !== 'string') {
        throw new Error(
          `Invalid content for file '${filePath}': Must be a string.`
        );
      }
      if (!filePath.startsWith('app/tool/')) {
        console.warn(
          `[API create-anonymous-pr] Unexpected file path found in generatedFiles: ${filePath}. Ensure all tool files are within 'app/tool/<directive>/'.`
        );
      }
    }

    generativeDescription = body.generativeDescription?.trim() || '';
    additionalDescription = body.additionalDescription?.trim() || '';
    generativeRequestedDirectives = Array.isArray(
      body.generativeRequestedDirectives
    )
      ? body.generativeRequestedDirectives.filter(
          (d): d is string => typeof d === 'string'
        )
      : [];
    userSelectedExampleDirectives = (
      Array.isArray(body.userSelectedExampleDirectives)
        ? body.userSelectedExampleDirectives.filter(
            (d): d is string => typeof d === 'string' && d.trim() !== ''
          )
        : []
    ).slice(0, 5);
    selectedModelName = body.selectedModel?.trim() || 'Unknown/Not Provided';

    console.log(
      `[API create-anonymous-pr] Processing PR for new tool: ${toolDirective}`
    );
    console.log(
      `[API create-anonymous-pr] Model used for generation: ${selectedModelName}`
    );
    if (assetInstructions)
      console.log(
        `[API create-anonymous-pr] Asset Instructions received: ${assetInstructions.substring(0, 100)}...`
      );
  } catch (error: unknown) {
    const message = hasMessage(error)
      ? error.message
      : 'Invalid request body format';
    console.error(
      '[API create-anonymous-pr] Error parsing request body:',
      message,
      error
    );
    return NextResponse.json(
      { success: false, message: message },
      { status: 400 }
    );
  }

  const filesToCommit = {
    ...allGeneratedFiles,
  };

  const toolGenerationInfoFileContent: ToolGenerationInfoFileContent = {
    identifiedDependencies: identifiedDependencies,
    assetInstructions: assetInstructions || null,
  };

  const toolGenerationInfoPath = `app/tool/${toolDirective}/tool-generation-info.json`;
  filesToCommit[toolGenerationInfoPath] = JSON.stringify(
    toolGenerationInfoFileContent,
    null,
    2
  );

  console.log(
    `[API create-anonymous-pr] Files to commit: ${Object.keys(filesToCommit).join(',')}`
  );

  let octokit: Octokit;
  let newBranchName: string | null = null;
  try {
    octokit = await getInstallationOctokit();

    const { data: branchData } = await octokit.rest.repos.getBranch({
      owner: GITHUB_USER_OR_ORG,
      repo: GITHUB_REPO,
      branch: GITHUB_DEFAULT_BRANCH,
    });
    const latestSha = branchData.commit.sha;
    console.log(
      `[API create-anonymous-pr] Fetched latest SHA from '${GITHUB_DEFAULT_BRANCH}': ${latestSha}`
    );

    const timestamp = Date.now();
    newBranchName = `feat/gen-${toolDirective}-${timestamp}`;
    const newBranchRef = `refs/heads/${newBranchName}`;
    console.log(
      `[API create-anonymous-pr] Creating branch: ${newBranchName}...`
    );
    await octokit.rest.git.createRef({
      owner: GITHUB_USER_OR_ORG,
      repo: GITHUB_REPO,
      ref: newBranchRef,
      sha: latestSha,
    });
    console.log(`[API create-anonymous-pr] Branch ${newBranchName} created.`);

    const commitMessage = `feat: Add AI generated tool - ${toolDirective}`;
    const committer = {
      name: 'OET Bot',
      email: 'bot@online-everything-tool.com',
    };
    const author = { name: 'OET Bot', email: 'bot@online-everything-tool.com' };

    const tree = await Promise.all(
      Object.entries(filesToCommit).map(async ([filePath, fileContent]) => {
        const { data: blobData } = await octokit.rest.git.createBlob({
          owner: GITHUB_USER_OR_ORG,
          repo: GITHUB_REPO,
          content: fileContent,
          encoding: 'utf-8',
        });
        return {
          path: filePath,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blobData.sha,
        };
      })
    );
    console.log(
      `[API create-anonymous-pr] All ${tree.length} file blobs created.`
    );

    const { data: newTree } = await octokit.rest.git.createTree({
      owner: GITHUB_USER_OR_ORG,
      repo: GITHUB_REPO,
      tree,
      base_tree: latestSha,
    });
    console.log(
      `[API create-anonymous-pr] New git tree created (SHA: ${newTree.sha})`
    );

    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner: GITHUB_USER_OR_ORG,
      repo: GITHUB_REPO,
      message: commitMessage,
      tree: newTree.sha,
      parents: [latestSha],
      author,
      committer,
    });
    console.log(
      `[API create-anonymous-pr] New commit created (SHA: ${newCommit.sha})`
    );

    await octokit.rest.git.updateRef({
      owner: GITHUB_USER_OR_ORG,
      repo: GITHUB_REPO,
      ref: `heads/${newBranchName}`,
      sha: newCommit.sha,
    });
    console.log(
      `[API create-anonymous-pr] Branch ${newBranchName} updated to new commit.`
    );

    const basePrTitle = `feat: Add AI Generated Tool - ${toolDirective}`;
    const prTitle = `${basePrTitle} - [skip netlify]`;

    const formatList = (
      items: string[],
      noneMessage: string,
      prefix = '- '
    ): string => {
      if (!items || items.length === 0) return noneMessage;
      return items.map((item) => `${prefix}\`${item}\``).join('\n');
    };
    const formatDependencies = (
      deps: LibraryDependency[],
      noneMessage: string
    ): string => {
      if (!deps || deps.length === 0) return noneMessage;
      return deps
        .map(
          (dep) =>
            `- \`${dep.packageName}\`${dep.reason ? ` - _Reason: ${dep.reason}_` : ''}${dep.importUsed ? ` (_Import: ${dep.importUsed}_)` : ''}`
        )
        .join('\n');
    };

    let prBody = `
Adds the new tool \`${toolDirective}\` generated via the AI Build Tool feature (submitted anonymously).

**AI Generated Description:**
${generativeDescription || '_No description provided by generator._'}

**User Provided Details/Refinements (if any):**
${additionalDescription || '_None provided._'}

**AI Model Used for Generation:**
${selectedModelName ? `\`${selectedModelName}\`` : '_Not specified_'}

**Dependencies Identified by Generator (in \`tool-generation-info.json\`):**
${formatDependencies(identifiedDependencies, '_None explicitly identified by the generation API._')}
${identifiedDependencies.length > 0 ? '\n_Note: CI will attempt to vet and install these dependencies. Review PR checks for status._' : ''}
`;

    if (assetInstructions) {
      prBody += `
**Manual Asset Instructions (from \`tool-generation-info.json\`):**
\`\`\`text
${assetInstructions}
\`\`\`
_Note: If this tool requires manual asset placement (e.g., model files), please ensure they are added to the \`public/data/${toolDirective}/\` directory as instructed, or the CI checks related to assets might fail._
`;
    }
    prBody += `
**AI Requested Examples During Tool Conception:**
${formatList(generativeRequestedDirectives, '_None requested or loaded from validation step._')}

**User Selected Examples During Tool Conception:**
${formatList(userSelectedExampleDirectives, '_None selected by user during generation refinement._')}

**Files Added/Modified (${Object.keys(filesToCommit).length}):**
${formatList(Object.keys(filesToCommit), '_Error: No files listed in PR body._')}

*Please review the attached code changes and CI checks.*
`;

    console.log(
      `[API create-anonymous-pr] Creating Pull Request: "${prTitle}"...`
    );
    const { data: pullRequest } = await octokit.rest.pulls.create({
      owner: GITHUB_USER_OR_ORG,
      repo: GITHUB_REPO,
      title: prTitle,
      body: prBody,
      head: newBranchName,
      base: GITHUB_DEFAULT_BRANCH,
      maintainer_can_modify: true,
    });
    console.log(
      `[API create-anonymous-pr] SUCCESS: Pull Request created: ${pullRequest.html_url}`
    );

    return NextResponse.json(
      {
        success: true,
        message: `Successfully created Pull Request for new tool: ${toolDirective}`,
        url: pullRequest.html_url,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error(
      '[API create-anonymous-pr] ERROR during GitHub interaction:',
      error
    );
    let errorMessage = 'An unexpected error occurred during PR creation.';
    let errorStatus = 500;
    if (isPotentialErrorObject(error)) {
      const status =
        typeof error.status === 'number' ? error.status : undefined;
      const message =
        typeof error.message === 'string' ? error.message : undefined;
      const ghMessage =
        typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : undefined;
      errorMessage = message || errorMessage;
      if (ghMessage) errorMessage += ` (GitHub: ${ghMessage})`;
      errorStatus = status || errorStatus;
      if (status === 422 && ghMessage?.includes('Reference already exists')) {
        errorMessage = `Branch '${newBranchName}' might already exist. This can happen with rapid submissions. Please try submitting again.`;
        errorStatus = 409;
      } else if (status === 404 && ghMessage?.includes('Not Found')) {
        errorMessage = `Base branch '${GITHUB_DEFAULT_BRANCH}' or repository not found. Check configuration.`;
      } else if (
        status === 403 &&
        ghMessage?.includes('Resource not accessible by integration')
      ) {
        errorMessage = `GitHub App permission error: ${ghMessage}. Ensure it has 'contents: write' and 'pull_requests: write' permissions for this repository.`;
      }
    } else {
      errorMessage = String(error);
    }
    console.error(
      `[API create-anonymous-pr] FAILURE: Status ${errorStatus}: ${errorMessage}`
    );
    return NextResponse.json(
      { success: false, message: errorMessage, url: null },
      { status: errorStatus }
    );
  } finally {
    console.log(
      `[API create-anonymous-pr] -------- POST End (${new Date().toISOString()}) --------`
    );
  }
}

export async function GET() {
  console.log(
    `[API create-anonymous-pr] -------- GET (${new Date().toISOString()}) --------`
  );
  if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_PRIVATE_KEY_BASE64) {
    return NextResponse.json({
      message:
        'API route active, but server config missing GitHub App credentials.',
    });
  }
  return NextResponse.json({
    message: 'API route for create-anonymous-pr is active. Use POST method.',
  });
}
