// EC2 Server: app/api/pr-status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';

const GITHUB_REPO_OWNER =
  process.env.GITHUB_REPO_OWNER || 'Online-Everything-Tool';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'oet';
const appId = process.env.GITHUB_APP_ID;
const privateKeyBase64 = process.env.GITHUB_PRIVATE_KEY_BASE64;

let octokitInstance: Octokit | undefined;

async function getAuthenticatedOctokit(): Promise<Octokit> {
  if (octokitInstance) return octokitInstance;

  if (!appId || !privateKeyBase64) {
    console.error('[api/pr-status] GitHub App credentials missing on server.');
    throw new Error(
      'Server configuration error: GitHub App credentials missing.'
    );
  }
  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
  if (!privateKey.startsWith('-----BEGIN')) {
    throw new Error('Decoded private key does not appear to be in PEM format.');
  }

  const appAuth = createAppAuth({ appId, privateKey });
  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey },
  });

  let installationId;
  try {
    const { data: installation } =
      await appOctokit.rest.apps.getRepoInstallation({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
      });
    installationId = installation.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error(
      `[api/pr-status] Failed to get repo installation for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}. Status: ${e?.status}`
    );
    throw new Error(
      `App installation not found or accessible for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}. Ensure the GitHub App is installed and has permissions.`
    );
  }

  if (!installationId) {
    throw new Error(
      `App installation ID not found for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`
    );
  }

  const { token } = await appAuth({ type: 'installation', installationId });
  octokitInstance = new Octokit({ auth: token });
  console.log('[api/pr-status] GitHub App authentication successful.');
  return octokitInstance;
}

interface CiCheck {
  name: string;
  status:
    | 'queued'
    | 'in_progress'
    | 'completed'
    | 'skipped'
    | 'unknown'
    | string;
  conclusion:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    | 'action_required'
    | null
    | string;
  url?: string;
  started_at?: string | null;
  completed_at?: string | null;
}

interface PrCiStatusResponse {
  prUrl: string;
  prNumber: number;
  headSha: string;
  prHeadBranch: string | null;
  checks: CiCheck[];
  netlifyPreviewUrl: string | null;
  netlifyDeploymentSucceeded: boolean;
  overallStatus: 'pending' | 'success' | 'failure' | 'error';
  lastUpdated: string;
  error?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const prNumberStr = searchParams.get('prNumber');

  console.log(`[api/pr-status] Received request. PR#: ${prNumberStr}`);

  if (!prNumberStr) {
    return NextResponse.json(
      { error: 'Missing prNumber query parameter.' },
      { status: 400 }
    );
  }

  const actualPrNumber = parseInt(prNumberStr, 10);
  if (isNaN(actualPrNumber) || actualPrNumber <= 0) {
    return NextResponse.json(
      { error: 'Invalid prNumber parameter.' },
      { status: 400 }
    );
  }

  try {
    const octokit = await getAuthenticatedOctokit();
    console.log(`[api/pr-status] Fetching PR data for PR #${actualPrNumber}`);
    const { data: prData } = await octokit.rest.pulls.get({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      pull_number: actualPrNumber,
    });
    const headShaToUse = prData.head.sha;
    const pullRequestUrl = prData.html_url;
    const prHeadBranchName = prData.head.ref;

    console.log(
      `[api/pr-status] Using Head SHA: ${headShaToUse} for PR #${actualPrNumber} (Branch: ${prHeadBranchName || 'N/A'})`
    );

    const { data: allCheckRunsForRef } = await octokit.rest.checks.listForRef({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      ref: headShaToUse,
      per_page: 50,
    });
    const ciChecks: CiCheck[] = [];
    let allWorkflowChecksCompleted = true;
    let anyWorkflowCheckFailed = false;
    let netlifyCheckRunSucceeded = false;

    const latestChecksMap = new Map<
      string,
      (typeof allCheckRunsForRef.check_runs)[0]
    >();
    for (const run of allCheckRunsForRef.check_runs) {
      const existing = latestChecksMap.get(run.name);
      const runTimestamp = new Date(
        run.completed_at || run.started_at || 0
      ).getTime();
      const existingTimestamp = existing
        ? new Date(existing.completed_at || existing.started_at || 0).getTime()
        : 0;
      if (!existing || runTimestamp > existingTimestamp) {
        latestChecksMap.set(run.name, run);
      }
    }
    const sortedChecks = Array.from(latestChecksMap.values()).sort(
      (a, b) =>
        new Date(a.started_at || 0).getTime() -
        new Date(b.started_at || 0).getTime()
    );
    console.log(
      `[api/pr-status] Found ${sortedChecks.length} unique latest check runs for SHA ${headShaToUse}.`
    );

    const netlifyKeywords = [
      'netlify',
      'deploy preview',
      GITHUB_REPO_NAME.toLowerCase(),
    ];

    for (const run of sortedChecks) {
      ciChecks.push({
        name: run.name,
        status: run.status as CiCheck['status'],
        conclusion: run.conclusion as CiCheck['conclusion'],
        url: run.html_url || undefined,
        started_at: run.started_at,
        completed_at: run.completed_at,
      });

      const isNetlifyCheck = netlifyKeywords.some((keyword) =>
        run.name.toLowerCase().includes(keyword)
      );

      if (run.status !== 'completed') {
        allWorkflowChecksCompleted = false;
      }
      if (
        run.conclusion === 'failure' ||
        run.conclusion === 'timed_out' ||
        run.conclusion === 'cancelled'
      ) {
        anyWorkflowCheckFailed = true;
      }
      if (isNetlifyCheck && run.conclusion === 'success') {
        netlifyCheckRunSucceeded = true;
      }
    }

    let netlifyPreviewUrl: string | null = null;
    if (actualPrNumber > 0) {
      console.log(
        `[api/pr-status] Attempting to find Netlify URL in PR #${actualPrNumber} comments...`
      );
      try {
        const { data: comments } = await octokit.rest.issues.listComments({
          owner: GITHUB_REPO_OWNER,
          repo: GITHUB_REPO_NAME,
          issue_number: actualPrNumber,
          per_page: 30,
        });
        comments.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        for (const comment of comments) {
          if (
            comment.user?.login?.toLowerCase().includes('netlify') &&
            comment.body?.includes('Deploy Preview')
          ) {
            console.log(
              `[api/pr-status] Found potential Netlify comment by ${comment.user.login}.`
            );
            const urlMatch = comment.body.match(
              /https:\/\/(deploy-preview-\d+--[a-zA-Z0-9-]+)\.netlify\.app/
            );
            if (urlMatch && urlMatch[0]) {
              netlifyPreviewUrl = urlMatch[0];
              console.log(
                `[api/pr-status] Extracted Netlify preview URL from PR comment: ${netlifyPreviewUrl}`
              );
              netlifyCheckRunSucceeded = true;
              break;
            }
          }
        }
        if (!netlifyPreviewUrl) {
          console.log(
            `[api/pr-status] Netlify preview URL not found in PR comments.`
          );
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (commentError: any) {
        console.warn(
          `[api/pr-status] Error fetching or parsing PR comments: ${commentError.message}`
        );
      }
    }

    let overallStatus: PrCiStatusResponse['overallStatus'] = 'pending';
    if (anyWorkflowCheckFailed) {
      overallStatus = 'failure';
    } else if (allWorkflowChecksCompleted && netlifyCheckRunSucceeded) {
      overallStatus = 'success';
    }

    return NextResponse.json(
      {
        prUrl: pullRequestUrl,
        prNumber: actualPrNumber,
        headSha: headShaToUse,
        prHeadBranch: prHeadBranchName,
        checks: ciChecks,
        netlifyPreviewUrl,
        netlifyDeploymentSucceeded: netlifyCheckRunSucceeded,
        overallStatus,
        lastUpdated: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('[api/pr-status] Error in handler:', error);
    let errorMessage = 'Failed to fetch PR CI status.';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof (error as any).message === 'string'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errorMessage = (error as any).message;
    }

    if (typeof error === 'object' && error !== null && 'status' in error) {
      const status = (error as { status: number }).status;
      if (status === 404) {
        return NextResponse.json(
          { error: `PR not found. ${errorMessage}` },
          { status: 404 }
        );
      }
      if (status === 403 || status === 401) {
        return NextResponse.json(
          { error: `Permission issue fetching PR status. ${errorMessage}` },
          { status: status }
        );
      }
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
