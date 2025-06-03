// FILE: scripts/get-pr-ci-summary.mjs (Refined Version - Corrected Workflow Fetch)
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Load .env file from project root ---
try {
  const envPath = path.resolve(__dirname, '../.env'); // Corrected path
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.warn(
      `[CI Summary Script] Warning: Could not load .env file from ${envPath}. Error: ${result.error.message}. Relying on pre-set environment variables.`
    );
  } else {
    // Avoid logging if running in a test environment that might not want .env processing logged
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[CI Summary Script] .env file processed from ${envPath}.`);
    }
  }
} catch (e) {
  // @ts-ignore
  console.warn(
    `[CI Summary Script] Error initializing dotenv: ${e.message}. Relying on pre-set environment variables.`
  );
}

const GITHUB_REPO_OWNER =
  process.env.GITHUB_REPO_OWNER || 'Online-Everything-Tool';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'oet';
const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_PRIVATE_KEY_BASE64 = process.env.GITHUB_PRIVATE_KEY_BASE64;

const BOT_USERNAMES = {
  VPR: (process.env.GITHUB_VPR_BOT_USERNAME || 'OET CI Bot').toLowerCase(),
  ADM: (
    process.env.GITHUB_ADM_BOT_USERNAME || 'AI Dependency Manager'
  ).toLowerCase(),
  ALF: (process.env.GITHUB_ALF_BOT_USERNAME || 'AI Lint Fixer').toLowerCase(),
  PR_CREATOR_BOT: (
    process.env.GITHUB_PR_CREATOR_BOT_USERNAME || 'OET Bot'
  ).toLowerCase(),
};

const WORKFLOW_FILENAMES = {
  // Using filenames is more robust than display names
  VPR: 'validate_generated_tool_pr.yml',
  ADM: 'ai_dependency_manager.yml',
  ALF: 'ai_lint_fixer.yml',
};

let octokitInstance;

async function getAuthenticatedOctokit() {
  if (octokitInstance) return octokitInstance;
  if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY_BASE64) {
    console.error(
      '[CI Summary Script] ERROR: GitHub App ID or Private Key is missing or empty.'
    );
    process.exit(1);
  }
  try {
    const privateKey = Buffer.from(
      GITHUB_PRIVATE_KEY_BASE64,
      'base64'
    ).toString('utf-8');
    if (!privateKey || !privateKey.startsWith('-----BEGIN')) {
      throw new Error('Decoded private key is invalid or not in PEM format.');
    }
    const appAuth = createAppAuth({ appId: GITHUB_APP_ID, privateKey });
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: { appId: GITHUB_APP_ID, privateKey },
    });
    const { data: installation } =
      await appOctokit.rest.apps.getRepoInstallation({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
      });
    if (!installation.id) throw new Error('App installation not found.');
    const { token } = await appAuth({
      type: 'installation',
      installationId: installation.id,
    });
    octokitInstance = new Octokit({ auth: token });
    if (process.env.NODE_ENV !== 'test') {
      console.log('[CI Summary Script] GitHub App authentication successful.');
    }
    return octokitInstance;
  } catch (error) {
    console.error('\n[CI Summary Script] ERROR DURING AUTHENTICATION:');
    // @ts-ignore
    console.error(`  Message: ${error.message}`);
    throw error;
  }
}

function extractToolDirectiveFromBranchName(branchName) {
  if (!branchName || !branchName.startsWith('feat/gen-')) return null;
  const tempDirective = branchName.substring('feat/gen-'.length);
  return tempDirective.replace(/-[0-9]+$/, '') || null;
}

async function getJsonFileContent(octokit, owner, repo, filePath, ref) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref,
    });
    // @ts-ignore
    if (data && data.content && data.encoding === 'base64') {
      // @ts-ignore
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return JSON.parse(content);
    }
    return {
      error: `File content not base64 or type not file: ${filePath} at ref ${ref}`,
    };
  } catch (error) {
    // @ts-ignore
    if (error.status === 404)
      return { error: `File not found: ${filePath} at ref ${ref}` };
    // @ts-ignore
    return {
      error: `Error fetching ${filePath} at ref ${ref}: ${error.message}`,
    };
  }
}

async function getPrCiSummary(prNumber) {
  const octokit = await getAuthenticatedOctokit();
  const { data: prData } = await octokit.rest.pulls.get({
    owner: GITHUB_REPO_OWNER,
    repo: GITHUB_REPO_NAME,
    pull_number: prNumber,
  });

  const headSha = prData.head.sha;
  const prHeadBranch = prData.head.ref;
  const toolDirective = extractToolDirectiveFromBranchName(prHeadBranch);

  let toolGenerationInfo = {
    status: 'not_applicable',
    content: null,
    error: null,
  };
  if (toolDirective) {
    const result = await getJsonFileContent(
      octokit,
      GITHUB_REPO_OWNER,
      GITHUB_REPO_NAME,
      `app/tool/${toolDirective}/tool-generation-info.json`,
      headSha
    );
    // @ts-ignore
    if (result.error) {
      // @ts-ignore
      toolGenerationInfo = {
        status: 'error_fetching',
        content: null,
        error: result.error,
      };
    } else {
      toolGenerationInfo = { status: 'found', content: result, error: null };
    }
  }

  // --- Corrected Workflow Fetching ---
  const { data: repoWorkflowRuns } =
    await octokit.rest.actions.listWorkflowRunsForRepo({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      per_page: 75, // Fetch a decent number to find relevant runs
    });

  // Filter runs that are specifically for the PR
  const relevantWorkflowRuns = repoWorkflowRuns.workflow_runs.filter((run) => {
    // Check if the run is associated with the PR number via its pull_requests array
    if (
      run.pull_requests?.some(
        (pr) => pr.id === prData.id && pr.number === prNumber
      )
    ) {
      return true;
    }
    // As a secondary check, include runs matching the head_sha,
    // though direct PR association is preferred.
    if (run.head_sha === headSha) {
      return true;
    }
    return false;
  });
  // --- End Corrected Workflow Fetching ---

  const categorizedWorkflowRuns = { vpr: [], adm: [], alf: [], other: [] };

  for (const run of relevantWorkflowRuns) {
    // Only fetch jobs and artifacts if needed or for latest runs to save API calls
    const { data: jobsData } =
      await octokit.rest.actions.listJobsForWorkflowRun({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
        run_id: run.id,
      });
    const { data: artifactsData } =
      await octokit.rest.actions.listWorkflowRunArtifacts({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
        run_id: run.id,
      });

    const runSummary = {
      id: run.id,
      name: run.name,
      workflow_filename: path.basename(run.path), // Store the filename
      status: run.status,
      conclusion: run.conclusion,
      html_url: run.html_url,
      head_sha: run.head_sha,
      created_at: run.created_at,
      updated_at: run.updated_at,
      event: run.event,
      jobs: jobsData.jobs.map((job) => ({
        id: job.id,
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
        html_url: job.html_url,
        started_at: job.started_at,
        completed_at: job.completed_at,
        steps:
          job.steps?.map((step) => ({
            name: step.name,
            status: step.status,
            conclusion: step.conclusion,
          })) || [],
      })),
      artifacts: artifactsData.artifacts.map((art) => ({
        id: art.id,
        name: art.name,
        size_in_bytes: art.size_in_bytes,
        expired: art.expired,
        expires_at: art.expires_at,
      })),
    };

    const wfFilename = path.basename(run.path);
    if (wfFilename === WORKFLOW_FILENAMES.VPR) {
      // @ts-ignore
      categorizedWorkflowRuns.vpr.push(runSummary);
    } else if (wfFilename === WORKFLOW_FILENAMES.ADM) {
      // @ts-ignore
      categorizedWorkflowRuns.adm.push(runSummary);
    } else if (wfFilename === WORKFLOW_FILENAMES.ALF) {
      // @ts-ignore
      categorizedWorkflowRuns.alf.push(runSummary);
    } else {
      // @ts-ignore
      categorizedWorkflowRuns.other.push(runSummary);
    }
  }

  ['vpr', 'adm', 'alf', 'other'].forEach((category) => {
    // @ts-ignore
    categorizedWorkflowRuns[category].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  const { data: checkSuites } = await octokit.rest.checks.listSuitesForRef({
    owner: GITHUB_REPO_OWNER,
    repo: GITHUB_REPO_NAME,
    ref: headSha,
  });
  const netlifyCheckSuiteData = checkSuites.check_suites.find(
    (suite) => suite.app?.slug === 'netlify'
  );
  const netlifyStatus = netlifyCheckSuiteData
    ? {
        id: netlifyCheckSuiteData.id,
        status: netlifyCheckSuiteData.status,
        conclusion: netlifyCheckSuiteData.conclusion,
        url: netlifyCheckSuiteData.url,
        details_url: netlifyCheckSuiteData.details_url,
        app_slug: netlifyCheckSuiteData.app?.slug,
      }
    : null;

  const { data: commentsData } = await octokit.rest.issues.listComments({
    owner: GITHUB_REPO_OWNER,
    repo: GITHUB_REPO_NAME,
    issue_number: prNumber,
    per_page: 10,
    sort: 'created',
    direction: 'desc',
  });
  const recentComments = commentsData.map((comment) => ({
    id: comment.id,
    user: comment.user?.login,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    body:
      comment.body?.substring(0, 500) +
      (comment.body && comment.body.length > 500 ? '...' : ''),
    html_url: comment.html_url,
    isBot: comment.user?.type === 'Bot',
    botType:
      comment.user?.login?.toLowerCase() === BOT_USERNAMES.VPR
        ? 'VPR'
        : comment.user?.login?.toLowerCase() === BOT_USERNAMES.ADM
          ? 'ADM'
          : comment.user?.login?.toLowerCase() === BOT_USERNAMES.ALF
            ? 'ALF'
            : comment.user?.login?.toLowerCase() ===
                BOT_USERNAMES.PR_CREATOR_BOT
              ? 'PR_CREATOR'
              : comment.user?.type === 'Bot'
                ? 'OtherBot'
                : null,
  }));

  return {
    prInfo: {
      number: prNumber,
      title: prData.title,
      state: prData.state,
      merged: prData.merged,
      branch: prHeadBranch,
      headSha: headSha,
      baseBranch: prData.base.ref,
      url: prData.html_url,
      createdAt: prData.created_at,
      updatedAt: prData.updated_at,
      user: prData.user?.login,
    },
    toolGenerationInfo: toolGenerationInfo,
    githubActions: categorizedWorkflowRuns,
    netlifyStatus: netlifyStatus,
    recentComments: recentComments,
    timestamp: new Date().toISOString(),
  };
}

// --- Main execution block for script ---
(async () => {
  if (process.argv.length < 3) {
    console.error('Usage: node scripts/get-pr-ci-summary.mjs <PR_NUMBER>');
    process.exit(1);
  }
  const prNumber = parseInt(process.argv[2], 10);
  if (isNaN(prNumber)) {
    console.error('Error: PR_NUMBER must be an integer.');
    process.exit(1);
  }

  try {
    const summary = await getPrCiSummary(prNumber);

    console.log(
      `\nFetching CI Summary for PR #${summary.prInfo.number} in ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`
    );
    console.log('============================================================');
    console.log(`PR Title: ${summary.prInfo.title}`);
    console.log(
      `State: ${summary.prInfo.state} | Merged: ${summary.prInfo.merged ? 'Yes' : 'No'}`
    );
    console.log(
      `Branch: ${summary.prInfo.branch} (into ${summary.prInfo.baseBranch})`
    );
    console.log(`Latest Head SHA: ${summary.prInfo.headSha}`);
    console.log(`PR URL: ${summary.prInfo.url}`);
    console.log('------------------------------------------------------------');

    console.log(
      `\n--- Tool Generation Info (at HEAD SHA: ${summary.prInfo.headSha}) ---`
    );
    if (summary.toolGenerationInfo.status === 'error_fetching') {
      console.log(
        `  Status: Error fetching - ${summary.toolGenerationInfo.error}`
      );
    } else if (summary.toolGenerationInfo.status === 'not_applicable') {
      console.log(
        `  Status: Not applicable (likely not a 'feat/gen-' branch).`
      );
    } else if (
      summary.toolGenerationInfo.status === 'found' &&
      summary.toolGenerationInfo.content
    ) {
      console.log(`  Status: Found`);
      // @ts-ignore
      console.log(
        `  npmDependenciesFulfilled: ${summary.toolGenerationInfo.content.npmDependenciesFulfilled ?? 'absent'}`
      );
      // @ts-ignore
      console.log(
        `  lintFixesAttempted: ${summary.toolGenerationInfo.content.lintFixesAttempted ?? false}`
      );
      // @ts-ignore
      if (summary.toolGenerationInfo.content.identifiedDependencies?.length) {
        // @ts-ignore
        console.log(
          `  Identified Dependencies: ${summary.toolGenerationInfo.content.identifiedDependencies.map((d) => d.packageName).join(', ')}`
        );
      }
      // @ts-ignore
      if (summary.toolGenerationInfo.content.assetInstructions) {
        // @ts-ignore
        console.log(
          `  Asset Instructions: Present (length ${summary.toolGenerationInfo.content.assetInstructions.length})`
        );
      }
    } else {
      console.log(`  Status: Unknown or content missing after fetch.`);
    }

    console.log(
      `\n--- GitHub Actions Workflow Runs (Latest First per Category for PR #${prNumber}) ---`
    );
    for (const category of ['vpr', 'alf', 'adm', 'other']) {
      // @ts-ignore
      if (summary.githubActions[category].length > 0) {
        // @ts-ignore
        for (const run of summary.githubActions[category]) {
          console.log(
            `\n  Workflow: "${run.name}" (File: ${run.workflow_filename}, ID: ${run.id}, Commit: ${run.head_sha.substring(0, 7)}, Event: ${run.event})`
          );
          console.log(
            `    Status: ${run.status} | Conclusion: ${run.conclusion || 'N/A'}`
          );
          console.log(`    URL: ${run.html_url}`);
          console.log(
            `    Created: ${new Date(run.created_at).toLocaleString()}`
          );
          if (run.jobs.length > 0) {
            console.log(`      Jobs:`);
            run.jobs.forEach((job) => {
              const jobDuration =
                job.completed_at && job.started_at
                  ? (new Date(job.completed_at).getTime() -
                      new Date(job.started_at).getTime()) /
                    1000
                  : null;
              const durationStr =
                jobDuration !== null ? `(${jobDuration.toFixed(1)}s)` : '';
              console.log(`        - Name: ${job.name}`);
              console.log(
                `          Status: ${job.status} | Conclusion: ${job.conclusion || 'N/A'} ${durationStr}`
              );
              // @ts-ignore
              const failingStep = job.steps.find(
                (s) => s.status === 'completed' && s.conclusion === 'failure'
              );
              if (failingStep) {
                console.log(`          Failed Step: "${failingStep.name}"`);
              }
            });
          }
          if (run.artifacts.length > 0) {
            console.log(`    Artifacts:`);
            run.artifacts.forEach((art) => {
              console.log(
                `      - Name: "${art.name}" (ID: ${art.id}, Size: ${(art.size_in_bytes / 1024).toFixed(2)} KiB, Expires: ${art.expires_at ? new Date(art.expires_at).toLocaleDateString() : 'N/A'})`
              );
            });
          }
        }
      } else {
        console.log(
          `\n  No runs found for category: ${category.toUpperCase()}`
        );
      }
    }

    console.log(
      `\n--- Other Check Suites (e.g., Netlify for HEAD SHA: ${summary.prInfo.headSha}) ---`
    );
    if (summary.netlifyStatus) {
      console.log(
        `  Netlify Check Suite (App: ${summary.netlifyStatus.app_slug}, ID: ${summary.netlifyStatus.id})`
      );
      console.log(
        `    Status: ${summary.netlifyStatus.status} | Conclusion: ${summary.netlifyStatus.conclusion || 'N/A'}`
      );
      if (summary.netlifyStatus.details_url)
        console.log(`    Details URL: ${summary.netlifyStatus.details_url}`);
    } else {
      console.log('  No Netlify check suite found for this ref.');
    }

    console.log(
      `\n--- Recent PR Comments (Last ${summary.recentComments.length}) ---`
    );
    if (summary.recentComments.length > 0) {
      summary.recentComments.forEach((comment) => {
        const botLabel = comment.isBot ? `[${comment.botType || 'Bot'}] ` : '';
        console.log(
          `\n  Comment by @${comment.user} ${botLabel}on ${new Date(comment.created_at).toLocaleString()}`
        );
        console.log(`  URL: ${comment.html_url}`);
        const bodyLines = comment.body.split('\n').map((line) => `    ${line}`);
        console.log(bodyLines.join('\n'));
      });
    } else {
      console.log('  No recent comments found for this PR.');
    }

    console.log(
      '\n============================================================'
    );
    console.log(`[CI Summary Script] Finished at ${summary.timestamp}.`);
  } catch (error) {
    // @ts-ignore
    console.error('\n[CI Summary Script] SCRIPT FAILED:', error.message);
    // @ts-ignore
    if (error.status) console.error('Status:', error.status);
    // @ts-ignore
    if (error.response?.data?.message)
      console.error('GitHub API Error:', error.response.data.message);
    process.exit(1);
  }
})();
