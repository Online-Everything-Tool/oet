// EC2 Server: app/api/pr-status/route.ts
// Handles GET requests like /api/pr-status?prNumber=123 or ?commitSha=abc...

import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';

// --- GitHub App Authentication ---
const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'Online-Everything-Tool';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'oet';
const appId = process.env.GITHUB_APP_ID;
const privateKeyBase64 = process.env.GITHUB_PRIVATE_KEY_BASE64;

let octokitInstance: Octokit | undefined;

async function getAuthenticatedOctokit(): Promise<Octokit> {
  if (octokitInstance) return octokitInstance;

  if (!appId || !privateKeyBase64) {
    console.error('[EC2 API /pr-status] GitHub App credentials missing on server.');
    throw new Error('Server configuration error: GitHub App credentials missing.');
  }
  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
  if (!privateKey.startsWith('-----BEGIN')) {
    throw new Error('Decoded private key does not appear to be in PEM format.');
  }

  const appAuth = createAppAuth({ appId, privateKey });
  const appOctokit = new Octokit({ authStrategy: createAppAuth, auth: { appId, privateKey }});
  
  let installationId;
  try {
    const { data: installation } = await appOctokit.rest.apps.getRepoInstallation({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
    });
    installationId = installation.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error(`[EC2 API /pr-status] Failed to get repo installation for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}. Status: ${e?.status}`);
    throw new Error(`App installation not found or accessible for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}. Ensure the GitHub App is installed and has permissions.`);
  }

  if (!installationId) {
    throw new Error(`App installation ID not found for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`);
  }

  const { token } = await appAuth({ type: 'installation', installationId });
  octokitInstance = new Octokit({ auth: token });
  console.log('[EC2 API /pr-status] GitHub App authentication successful.');
  return octokitInstance;
}
// --- End GitHub App Authentication ---

interface CiCheck {
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | 'skipped' | 'unknown' | string;
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null | string;
  url?: string;
  started_at?: string | null;
  completed_at?: string | null;
}

interface PrCiStatusResponse {
  prUrl: string;
  prNumber: number;
  headSha?: string;
  prHeadBranch?: string | null; // Added for debugging
  checks: CiCheck[];
  netlifyPreviewUrl: string | null;
  overallStatus: 'pending' | 'success' | 'failure' | 'error';
  lastUpdated: string;
  error?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const prNumberStr = searchParams.get('prNumber');
  const commitSha = searchParams.get('commitSha');

  console.log(`[EC2 API /pr-status] Received request. PR#: ${prNumberStr}, SHA: ${commitSha}`);

  if (!prNumberStr && !commitSha) {
    return NextResponse.json({ error: 'Missing prNumber or commitSha query parameter.' }, { status: 400 });
  }

  const prNumberFromQuery = prNumberStr ? parseInt(prNumberStr, 10) : null;
  if (prNumberStr && (isNaN(prNumberFromQuery!) || prNumberFromQuery! <= 0)) {
    return NextResponse.json({ error: 'Invalid prNumber parameter.' }, { status: 400 });
  }

  try {
    const octokit = await getAuthenticatedOctokit();
    let headShaToUse = commitSha as string;
    let pullRequestUrl = "";
    let actualPrNumber = prNumberFromQuery || 0;
    let prHeadBranchName: string | null = null; // Variable to store the PR's head branch name

    if (prNumberFromQuery) {
      console.log(`[EC2 API /pr-status] Fetching PR data for PR #${prNumberFromQuery}`);
      const { data: prData } = await octokit.rest.pulls.get({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
        pull_number: prNumberFromQuery,
      });
      headShaToUse = prData.head.sha;
      pullRequestUrl = prData.html_url;
      actualPrNumber = prData.number;
      prHeadBranchName = prData.head.ref; // Get the branch name from PR data
      console.log(`[EC2 API /pr-status] Determined PR head branch name: ${prHeadBranchName}`);
    } else if (commitSha) {
      console.log(`[EC2 API /pr-status] Finding PR for commit SHA: ${commitSha}`);
      pullRequestUrl = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/commit/${commitSha}`;
      const { data: associatedPrs } = await octokit.request('GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls', {
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
        commit_sha: headShaToUse,
        headers: { 'X-GitHub-Api-Version': '2022-11-28' }
      });
      if (associatedPrs.length > 0) {
        const openPrs = associatedPrs.filter(pr => pr.state === 'open');
        const chosenPr = openPrs.length > 0 ? openPrs.sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0] : associatedPrs.sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
        actualPrNumber = chosenPr.number;
        pullRequestUrl = chosenPr.html_url;
        prHeadBranchName = chosenPr.head.ref; // Get branch name from associated PR
        console.log(`[EC2 API /pr-status] Found PR #${actualPrNumber} (Branch: ${prHeadBranchName}, Updated: ${chosenPr.updated_at}) for commit SHA ${commitSha}`);
      } else {
        console.log(`[EC2 API /pr-status] No PR found for commit SHA ${commitSha}. Proceeding with commit-based checks. Branch name will be unavailable for deployment query.`);
      }
    }

    if (!headShaToUse) {
      return NextResponse.json({ error: 'Could not determine head SHA for PR or commit.' }, { status: 404 });
    }
    console.log(`[EC2 API /pr-status] Using Head SHA: ${headShaToUse} for PR #${actualPrNumber || 'N/A'} (Branch: ${prHeadBranchName || 'N/A'})`);

    const { data: allCheckRunsForRef } = await octokit.rest.checks.listForRef({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
        ref: headShaToUse, // Checks are usually against the SHA
        per_page: 50,
    });
    
    const ciChecks: CiCheck[] = [];
    let netlifyPreviewUrl: string | null = null;
    let allWorkflowChecksCompleted = true;
    let anyWorkflowCheckFailed = false;

    const latestChecksMap = new Map<string, typeof allCheckRunsForRef.check_runs[0]>();
    for (const run of allCheckRunsForRef.check_runs) {
        const existing = latestChecksMap.get(run.name);
        const runTimestamp = new Date(run.completed_at || run.started_at || 0).getTime();
        const existingTimestamp = existing ? new Date(existing.completed_at || existing.started_at || 0).getTime() : 0;
        if (!existing || runTimestamp > existingTimestamp) {
            latestChecksMap.set(run.name, run);
        }
    }
    
    const sortedChecks = Array.from(latestChecksMap.values()).sort((a,b) => 
        new Date(a.started_at || 0).getTime() - new Date(b.started_at || 0).getTime()
    );

    console.log(`[EC2 API /pr-status] Found ${sortedChecks.length} unique latest check runs for SHA ${headShaToUse}.`);

    for (const run of sortedChecks) {
      ciChecks.push({
        name: run.name,
        status: run.status as CiCheck['status'],
        conclusion: run.conclusion as CiCheck['conclusion'],
        url: run.html_url || undefined,
        started_at: run.started_at,
        completed_at: run.completed_at,
      });
      if (run.status !== 'completed') {
        allWorkflowChecksCompleted = false;
      }
      if (run.conclusion === 'failure' || run.conclusion === 'timed_out' || run.conclusion === 'cancelled') {
        anyWorkflowCheckFailed = true;
      }

      if (run.name.toLowerCase().includes('netlify') && run.conclusion === 'success' && run.output?.summary) {
        console.log(`[EC2 API /pr-status] Netlify check run summary for '${run.name}': ${run.output.summary.substring(0, 200)}...`);
        const urlMatch = run.output.summary.match(/https:\/\/(deploy-preview-\d+--[a-zA-Z0-9-]+)\.netlify\.app/);
        if (urlMatch && urlMatch[0]) {
            netlifyPreviewUrl = urlMatch[0];
            console.log(`[EC2 API /pr-status] Found Netlify preview URL from check run summary: ${netlifyPreviewUrl}`);
        }
      }
    }

    if (!netlifyPreviewUrl) {
      // Use branch name for deployment query if available, otherwise fall back to SHA
      const deploymentQueryTarget = prHeadBranchName || headShaToUse;
      console.log(`[EC2 API /pr-status] Netlify URL not in check summaries, querying Deployments API using target: ${deploymentQueryTarget}...`);
      
      const { data: deployments } = await octokit.rest.repos.listDeployments({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
        ref: deploymentQueryTarget, // Query by branch name (ref) or SHA
        per_page: 10, 
      });

      console.log(`[EC2 API /pr-status] Found ${deployments.length} deployments for target: ${deploymentQueryTarget}.`);
      deployments.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      for (const deployment of deployments) {
        console.log(`[EC2 API /pr-status] Evaluating Deployment ID: ${deployment.id}, Environment: "${deployment.environment}", Task: "${deployment.task}", Original Env: "${deployment.original_environment}", Created: ${deployment.created_at}`);
        if (deployment.environment && 
            (deployment.environment.toLowerCase().includes('preview') || 
             deployment.environment.toLowerCase().includes('deploy') || 
             deployment.environment.toLowerCase().includes('pull-request')) ||
            deployment.task?.toLowerCase().includes('deploy') 
           ) {
          console.log(`[EC2 API /pr-status] Checking statuses for relevant deployment ID ${deployment.id}`);
          const { data: statuses } = await octokit.rest.repos.listDeploymentStatuses({
            owner: GITHUB_REPO_OWNER,
            repo: GITHUB_REPO_NAME,
            deployment_id: deployment.id,
            per_page: 5, 
          });
          const successStatus = statuses.find(s => s.state === 'success' && s.environment_url);
          if (successStatus?.environment_url) {
            netlifyPreviewUrl = successStatus.environment_url;
            console.log(`[EC2 API /pr-status] Found Netlify preview URL from Deployments API: ${netlifyPreviewUrl}`);
            if (!ciChecks.some(c => c.name.toLowerCase().includes('netlify'))) {
                ciChecks.push({
                    name: "Netlify Deploy Preview (via API)",
                    status: 'completed',
                    conclusion: 'success',
                    url: netlifyPreviewUrl,
                    completed_at: successStatus.updated_at 
                });
            }
            break; 
          }
        }
      }
    }
    
    let overallStatus: PrCiStatusResponse['overallStatus'] = 'pending';
    if (anyWorkflowCheckFailed) {
        overallStatus = 'failure';
    } else if (allWorkflowChecksCompleted && netlifyPreviewUrl) { 
        overallStatus = 'success';
    } else if (allWorkflowChecksCompleted && !anyWorkflowCheckFailed && !netlifyPreviewUrl) {
        console.log("[EC2 API /pr-status] All checks completed, no failures, but Netlify URL still missing. Status: pending.");
        overallStatus = 'pending'; 
    }

    return NextResponse.json({
      prUrl: pullRequestUrl,
      prNumber: actualPrNumber,
      headSha: headShaToUse,
      prHeadBranch: prHeadBranchName, // Include for debugging/info
      checks: ciChecks,
      netlifyPreviewUrl,
      overallStatus,
      lastUpdated: new Date().toISOString(),
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[EC2 API /pr-status] Error in handler:', error);
    let errorMessage = 'Failed to fetch PR CI status.';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (
      typeof error === 'object' && error !== null && 'message' in error &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof (error as any).message === 'string'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errorMessage = (error as any).message;
    }
    
    if (typeof error === 'object' && error !== null && 'status' in error) {
        const status = (error as { status: number }).status;
        if (status === 404) {
            return NextResponse.json({ error: `PR or commit not found. ${errorMessage}` }, { status: 404 });
        }
        if (status === 403 || status === 401) {
            return NextResponse.json({ error: `Permission issue fetching PR status. ${errorMessage}` }, { status: status });
        }
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}