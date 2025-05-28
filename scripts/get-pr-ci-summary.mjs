// FILE: scripts/get_pr_ci_summary.mjs
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPTS_DIR, '..');

// --- Environment Variable Loading ---
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
        if (key && value) process.env[key.trim()] = value;
        else if (key && valueParts.length === 0) process.env[key.trim()] = '';
      }
    });
    console.log('[CI Summary Script] .env file processed.');
  } catch (error) {
    // @ts-ignore
    console.warn(
      `[CI Summary Script] Could not load .env file: ${error.message}. Relying on environment variables.`
    );
  }
}

let GITHUB_APP_ID_ENV;
let GITHUB_PRIVATE_KEY_BASE64_ENV;
let GITHUB_REPO_OWNER_ENV;
let GITHUB_REPO_NAME_ENV;

let octokitInstance;

async function getInstallationOctokit() {
  if (octokitInstance) return octokitInstance;

  if (!GITHUB_APP_ID_ENV || !GITHUB_PRIVATE_KEY_BASE64_ENV) {
    throw new Error(
      '[CI Summary Script] GitHub App ID or Private Key missing. Check .env or environment variables (GITHUB_APP_ID, GITHUB_PRIVATE_KEY_BASE64).'
    );
  }

  let privateKeyPem;
  try {
    privateKeyPem = Buffer.from(
      GITHUB_PRIVATE_KEY_BASE64_ENV,
      'base64'
    ).toString('utf-8');
    if (!privateKeyPem.startsWith('-----BEGIN')) {
      throw new Error(
        'Decoded private key does not appear to be in PEM format.'
      );
    }
  } catch (e) {
    // @ts-ignore
    throw new Error(
      `[CI Summary Script] Failed to decode GITHUB_PRIVATE_KEY_BASE64: ${e.message}`
    );
  }

  const appAuth = createAppAuth({
    appId: GITHUB_APP_ID_ENV,
    privateKey: privateKeyPem,
  });
  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: { appId: GITHUB_APP_ID_ENV, privateKey: privateKeyPem },
  });

  let installation;
  try {
    const { data } = await appOctokit.rest.apps.getRepoInstallation({
      owner: GITHUB_REPO_OWNER_ENV,
      repo: GITHUB_REPO_NAME_ENV,
    });
    installation = data;
  } catch (e) {
    // @ts-ignore
    throw new Error(
      `[CI Summary Script] App installation not found for ${GITHUB_REPO_OWNER_ENV}/${GITHUB_REPO_NAME_ENV}. Status: ${e?.status}, Message: ${e?.message}`
    );
  }

  if (!installation.id) {
    throw new Error(`[CI Summary Script] App installation ID not found.`);
  }

  const { token } = await appAuth({
    type: 'installation',
    installationId: installation.id,
  });
  octokitInstance = new Octokit({ auth: token });
  console.log('[CI Summary Script] GitHub App authentication successful.');
  return octokitInstance;
}

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = [
    'Bytes',
    'KiB',
    'MiB',
    'GiB',
    'TiB',
    'PiB',
    'EiB',
    'ZiB',
    'YiB',
  ];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

async function main() {
  await loadEnv();
  GITHUB_APP_ID_ENV = process.env.GITHUB_APP_ID;
  GITHUB_PRIVATE_KEY_BASE64_ENV = process.env.GITHUB_PRIVATE_KEY_BASE64;
  GITHUB_REPO_OWNER_ENV =
    process.env.GITHUB_REPO_OWNER || 'Online-Everything-Tool';
  GITHUB_REPO_NAME_ENV = process.env.GITHUB_REPO_NAME || 'oet';

  const prNumberArg = process.argv[2];
  if (!prNumberArg || isNaN(parseInt(prNumberArg))) {
    console.error('Error: PR Number must be provided as the first argument.');
    console.log('Usage: node scripts/get_pr_ci_summary.mjs <pr_number>');
    process.exit(1);
  }
  const prNumber = parseInt(prNumberArg, 10);

  const octokit = await getInstallationOctokit();

  try {
    console.log(
      `\nFetching CI Summary for PR #${prNumber} in ${GITHUB_REPO_OWNER_ENV}/${GITHUB_REPO_NAME_ENV}`
    );
    console.log('============================================================');

    const { data: prData } = await octokit.rest.pulls.get({
      owner: GITHUB_REPO_OWNER_ENV,
      repo: GITHUB_REPO_NAME_ENV,
      pull_number: prNumber,
    });
    const headSha = prData.head.sha;
    const headBranch = prData.head.ref;
    const baseBranch = prData.base.ref;

    console.log(`PR Title: ${prData.title}`);
    console.log(
      `State: ${prData.state} | Merged: ${prData.merged ? 'Yes' : 'No'}`
    );
    console.log(`Branch: ${headBranch} (into ${baseBranch})`);
    console.log(`Latest Head SHA: ${headSha}`);
    console.log(`PR URL: ${prData.html_url}`);
    console.log('------------------------------------------------------------');

    console.log(
      `\n--- GitHub Actions Workflow Runs for commit ${headSha.substring(0, 7)} on branch ${headBranch} ---`
    );
    // More direct query for workflow runs related to the PR's commit
    const { data: runsForHeadShaData } =
      await octokit.rest.actions.listWorkflowRunsForRepo({
        owner: GITHUB_REPO_OWNER_ENV,
        repo: GITHUB_REPO_NAME_ENV,
        head_sha: headSha,
        // event: 'pull_request', // Could be too restrictive if runs are triggered by workflow_run or comments
        per_page: 20, // Get a good number of runs
      });

    let allRuns = runsForHeadShaData.workflow_runs;

    // Fallback or supplement: Get runs for the branch if the head_sha list is empty
    // This can happen if the main identifying event wasn't directly on the SHA
    if (allRuns.length === 0) {
      console.log(
        `No runs found directly for SHA ${headSha.substring(0, 7)}. Checking runs for branch '${headBranch}'...`
      );
      const { data: branchRunsData } =
        await octokit.rest.actions.listWorkflowRunsForRepo({
          owner: GITHUB_REPO_OWNER_ENV,
          repo: GITHUB_REPO_NAME_ENV,
          branch: headBranch,
          per_page: 20,
        });
      // Filter these branch runs to only include those related to the PR's head SHA,
      // or at least very recent ones if SHA doesn't match (e.g. workflow_run events)
      allRuns = branchRunsData.workflow_runs.filter(
        (run) =>
          run.head_sha === headSha ||
          run.pull_requests?.some((pr) => pr.number === prNumber)
      );
    }

    // Consolidate and sort all potential runs (e.g. if runs came from both queries)
    const uniqueRunsMap = new Map();
    allRuns.forEach((run) => uniqueRunsMap.set(run.id, run));
    const sortedRuns = Array.from(uniqueRunsMap.values()).sort(
      (a, b) =>
        new Date(a.run_started_at || a.created_at).getTime() -
        new Date(b.run_started_at || b.created_at).getTime()
    ); // Oldest first for sequence

    if (sortedRuns.length > 0) {
      for (const run of sortedRuns) {
        await processWorkflowRun(octokit, run, headSha, prNumber); // Pass prNumber
      }
    } else {
      console.log(
        `  No relevant GitHub Actions workflow runs found for PR #${prNumber} (SHA: ${headSha.substring(0, 7)}, Branch: ${headBranch}).`
      );
      console.log(`  This could mean:`);
      console.log(`    - No workflows were triggered for this commit/PR yet.`);
      console.log(
        `    - Workflows are triggered by an event not covered by current query (e.g., only specific workflow_dispatch).`
      );
      console.log(
        `    - Permissions issue with the GitHub App preventing visibility of Actions runs.`
      );
    }

    // Display Netlify Check Suite (if any, as it's a common separate check)
    console.log('\n--- Other Check Suites (e.g., Netlify) ---');
    const { data: checkSuitesData } =
      await octokit.rest.checks.listSuitesForRef({
        owner: GITHUB_REPO_OWNER_ENV,
        repo: GITHUB_REPO_NAME_ENV,
        ref: headSha,
      });
    const netlifySuite = checkSuitesData.check_suites.find((suite) =>
      suite.app?.slug?.includes('netlify')
    );
    if (netlifySuite) {
      console.log(`  Netlify Check Suite (ID: ${netlifySuite.id})`);
      console.log(
        `    Status: ${netlifySuite.status} | Conclusion: ${netlifySuite.conclusion || 'N/A'}`
      );
      if (netlifySuite.conclusion === 'neutral' && netlifySuite.details_url) {
        console.log(
          `    Details URL: ${netlifySuite.details_url} (Often deploy preview link)`
        );
      }
    } else {
      console.log('  No specific Netlify check suite found for this SHA.');
    }

    console.log('\n--- Recent PR Comments (Last 5) ---');
    const { data: commentsData } = await octokit.rest.issues.listComments({
      owner: GITHUB_REPO_OWNER_ENV,
      repo: GITHUB_REPO_NAME_ENV,
      issue_number: prNumber,
      per_page: 5,
      direction: 'desc',
    });
    commentsData.reverse().forEach((comment) => {
      console.log(
        `\n  Comment by @${comment.user?.login} on ${new Date(comment.created_at).toLocaleString()}`
      );
      console.log(`  URL: ${comment.html_url}`);
      const bodySummary = comment.body
        ?.split('\n')
        .map(
          (line) =>
            `    ${line.substring(0, 120)}${line.length > 120 ? '...' : ''}`
        )
        .join('\n');
      console.log(bodySummary);
    });

    console.log(
      '\n============================================================'
    );
    console.log('[CI Summary Script] Finished.');
  } catch (error) {
    console.error('❌ Error in Get PR CI Summary Script:');
    // @ts-ignore
    if (error.status) {
      console.error(`  Status: ${error.status}`);
    }
    // @ts-ignore
    if (error.message) {
      console.error(`  Message: ${error.message}`);
    }
    // @ts-ignore
    if (error.response?.data) {
      console.error('  GitHub API Response Data:', error.response.data);
    }
    // @ts-ignore
    else if (error.request) {
      console.error('  No response received. Request details:', error.request);
    }
    // @ts-ignore
    if (!error.status && error.stack) {
      console.error('  Stack:', error.stack);
    }
    // @ts-ignore
    else if (!error.status) {
      console.error('Full error object:', error);
    }
  }
}

async function processWorkflowRun(octokit, run, expectedHeadSha, prNumber) {
  // Added prNumber
  console.log(
    `\n  Workflow Run: "${run.name}" (ID: ${run.id}, Trigger: ${run.event})`
  );
  console.log(
    `    Status: ${run.status} | Conclusion: ${run.conclusion || 'N/A'}`
  );
  console.log(
    `    SHA: ${run.head_sha.substring(0, 7)} | URL: ${run.html_url}`
  );
  console.log(
    `    Started: ${run.run_started_at ? new Date(run.run_started_at).toLocaleString() : 'N/A'}`
  );

  // Get Jobs for this Workflow Run
  const { data: jobsData } = await octokit.rest.actions.listJobsForWorkflowRun({
    owner: GITHUB_REPO_OWNER_ENV,
    repo: GITHUB_REPO_NAME_ENV,
    run_id: run.id,
  });
  if (jobsData.jobs && jobsData.jobs.length > 0) {
    console.log(`      Jobs:`);
    jobsData.jobs.sort(
      (a, b) =>
        new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    );
    for (const job of jobsData.jobs) {
      console.log(`        - Name: ${job.name}`);
      console.log(
        `          Status: ${job.status} | Conclusion: ${job.conclusion || 'N/A'} (ID: ${job.id}, URL: ${job.html_url})`
      );
      // Log job outputs (if any useful ones are standardly available - not custom ones)
      // For custom outputs, one would typically need to download an artifact or parse logs.
      console.log(`          Steps:`);
      job.steps?.forEach((step) => {
        console.log(
          `            * ${step.number}. ${step.name}: ${step.status} / ${step.conclusion || 'N/A'}`
        );
      });
    }
  }

  // Get Artifacts for this Workflow Run
  const { data: artifactsData } =
    await octokit.rest.actions.listWorkflowRunArtifacts({
      owner: GITHUB_REPO_OWNER_ENV,
      repo: GITHUB_REPO_NAME_ENV,
      run_id: run.id,
    });
  if (artifactsData.artifacts && artifactsData.artifacts.length > 0) {
    console.log(`      Artifacts:`);
    for (const artifact of artifactsData.artifacts) {
      console.log(
        `        - Name: "${artifact.name}" (ID: ${artifact.id}, Size: ${formatBytes(artifact.size_in_bytes)}, Exp: ${new Date(artifact.expires_at).toLocaleDateString()})`
      );

      // More specific check for lint artifact naming
      const expectedLintArtifactPattern = `lint-failure-data-${expectedHeadSha}`;
      if (artifact.name.startsWith('lint-failure-data-')) {
        if (artifact.name !== expectedLintArtifactPattern) {
          console.log(
            `          ⚠️ Potential artifact naming issue: Expected exact name '${expectedLintArtifactPattern}' but found '${artifact.name}'.`
          );
        }
      }
      // Check for dependency artifact
      const expectedDepArtifactPattern = `pending-dependencies-${expectedHeadSha}`;
      if (artifact.name.startsWith('pending-dependencies-')) {
        if (artifact.name !== expectedDepArtifactPattern) {
          console.log(
            `          ⚠️ Potential artifact naming issue: Expected exact name '${expectedDepArtifactPattern}' but found '${artifact.name}'.`
          );
        }
      }
    }
  }
}

main().catch((e) => {
  console.error('[CI Summary Script] Unhandled error in main execution:', e);
  process.exit(1);
});
