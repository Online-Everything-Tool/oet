// FILE: app/api/pr-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';
import type { Endpoints } from '@octokit/types';
import type { ToolGenerationInfoFileContent } from '@/src/types/build';

const GITHUB_REPO_OWNER =
  process.env.GITHUB_REPO_OWNER || 'Online-Everything-Tool';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'oet';
const appId = process.env.GITHUB_APP_ID;
const privateKeyBase64 = process.env.GITHUB_PRIVATE_KEY_BASE64;

const BOT_USERNAMES = {
  VPR: (process.env.GITHUB_VPR_BOT_USERNAME || 'OET CI Bot').toLowerCase(),
  ADM: (
    process.env.GITHUB_ADM_BOT_USERNAME || 'AI Dependency Manager'
  ).toLowerCase(),
  ALF: (process.env.GITHUB_ALF_BOT_USERNAME || 'AI Lint Fixer').toLowerCase(),
  PR_CREATOR: (
    process.env.GITHUB_PR_CREATOR_BOT_USERNAME || 'OET Bot'
  ).toLowerCase(),
};

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
  } catch (e: unknown) {
    const err = e as { status?: number };
    console.error(
      `[api/pr-status] Failed to get repo installation. Status: ${err?.status}`
    );
    throw new Error(
      `App installation not found or accessible for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}.`
    );
  }

  if (!installationId)
    throw new Error(
      `App installation ID not found for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`
    );

  const { token } = await appAuth({ type: 'installation', installationId });
  octokitInstance = new Octokit({ auth: token });
  console.log('[api/pr-status] GitHub App authentication successful.');
  return octokitInstance;
}

interface CiCheck {
  name: string;
  status: string;
  conclusion: string | null;
  url?: string;
  started_at?: string | null;
  completed_at?: string | null;
}

interface ToolGenerationInfoStatus {
  npmDependenciesFulfilled: 'absent' | 'true' | 'false' | 'not_found';
  lintFixesAttempted: boolean | 'not_found';
  assetInstructionsPending?: boolean | 'not_found';
}

interface LastBotComment {
  botName: string;
  summary: string;
  body?: string;
  timestamp: string;
  url?: string;
}
interface AutomatedActionsStatus {
  statusSummary: string;
  activeWorkflow: string | null;
  nextExpectedAction: string | null;
  shouldContinuePolling: boolean;
  lastBotComment?: LastBotComment | null;
  vprConclusionForHead?: string | null;
}

interface PrStatusApiResponse {
  prUrl: string;
  prNumber: number;
  headSha: string;
  prHeadBranch: string;
  prState: 'open' | 'closed';
  isMerged: boolean;
  checks: CiCheck[];
  overallCheckStatusForHead: 'pending' | 'success' | 'failure' | 'error';
  netlifyPreviewUrl: string | null;
  netlifyDeploymentSucceeded: boolean;
  imgurScreenshotUrl?: string | null;
  toolGenerationInfo: ToolGenerationInfoStatus;
  automatedActions: AutomatedActionsStatus;
  lastUpdated: string;
  error?: string;
}

function extractToolDirectiveFromBranchName(branchName: string): string | null {
  if (!branchName.startsWith('feat/gen-')) return null;
  const tempDirective = branchName.substring('feat/gen-'.length);
  return tempDirective.replace(/-[0-9]+$/, '') || null;
}

async function getToolGenerationInfo(
  octokit: Octokit,
  branchName: string,
  toolDirective: string | null
): Promise<ToolGenerationInfoStatus> {
  const defaultStatus: ToolGenerationInfoStatus = {
    npmDependenciesFulfilled: 'not_found',
    lintFixesAttempted: 'not_found',
  };
  if (!toolDirective) {
    console.log(
      '[api/pr-status] No tool directive provided to getToolGenerationInfo, returning not_found status.'
    );
    return defaultStatus;
  }

  const filePath = `app/tool/${toolDirective}/tool-generation-info.json`;
  try {
    console.log(
      `[api/pr-status] Fetching tool-generation-info.json from: ${filePath} on branch ${branchName}`
    );
    const { data: fileContentResponse } = await octokit.rest.repos.getContent({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      path: filePath,
      ref: branchName,
    });

    const responseWithContent = fileContentResponse as {
      content?: string;
      encoding?: string;
    };

    if (
      responseWithContent.content &&
      responseWithContent.encoding === 'base64'
    ) {
      const content = Buffer.from(
        responseWithContent.content,
        'base64'
      ).toString('utf-8');
      const jsonData = JSON.parse(content) as Partial<
        ToolGenerationInfoFileContent & ToolGenerationInfoStatus
      >;

      let npmStatus = jsonData.npmDependenciesFulfilled || 'absent';
      if (!['true', 'false', 'absent'].includes(npmStatus)) {
        npmStatus = 'absent';
      }

      return {
        npmDependenciesFulfilled: npmStatus as 'absent' | 'true' | 'false',
        lintFixesAttempted:
          typeof jsonData.lintFixesAttempted === 'boolean'
            ? jsonData.lintFixesAttempted
            : false,
      };
    }
    console.log(
      `[api/pr-status] tool-generation-info.json found but no base64 content field at ${filePath}`
    );
    return defaultStatus;
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status === 404) {
      console.log(
        `[api/pr-status] tool-generation-info.json not found at ${filePath} on branch ${branchName}.`
      );
    } else {
      console.warn(
        `[api/pr-status] Error fetching tool-generation-info.json:`,
        err.message || String(error)
      );
    }
    return defaultStatus;
  }
}

type IssuesListCommentsResponseData =
  Endpoints['GET /repos/{owner}/{repo}/issues/{issue_number}/comments']['response']['data'];

function parseLastBotComment(
  comments: IssuesListCommentsResponseData
): LastBotComment | null {
  if (!comments || comments.length === 0) return null;

  for (const comment of comments) {
    const authorLogin = comment.user?.login?.toLowerCase();
    const body = comment.body || '';
    let botName: string | null = null;
    let summary = 'Recent bot activity noted.';

    if (authorLogin === BOT_USERNAMES.VPR) botName = 'VPR';
    else if (authorLogin === BOT_USERNAMES.ADM) botName = 'ADM';
    else if (authorLogin === BOT_USERNAMES.ALF) botName = 'ALF';
    else if (authorLogin === BOT_USERNAMES.PR_CREATOR) botName = 'PR Creator';
    else continue;

    if (botName === 'VPR') {
      if (
        body.includes('Handoff') &&
        body.includes('AI Dependency Manager (ADM) will be triggered')
      )
        summary = 'VPR: Handoff to ADM.';
      else if (
        body.includes('Handoff') &&
        body.includes('AI Lint Fixer (ALF) will be triggered')
      )
        summary = 'VPR: Handoff to ALF.';
      else if (body.includes('VPR Succeeded')) summary = 'VPR: Succeeded.';
      else if (
        body.includes('VPR Failed') &&
        body.includes('Manual review required')
      )
        summary = 'VPR: Failed, manual review needed.';
      else if (body.includes('VPR Failed')) summary = 'VPR: Failed.';
    } else if (botName === 'ADM') {
      if (body.includes('Dependencies successfully processed'))
        summary = 'ADM: Dependencies resolved.';
      else if (body.includes('Dependency Resolution Failed'))
        summary = 'ADM: Dependency resolution failed.';
    } else if (botName === 'ALF') {
      if (body.includes('AI-assisted lint fixes applied'))
        summary = 'ALF: Lint fixes applied.';
      else if (body.includes('AI proposed no code changes'))
        summary = 'ALF: Attempted, no code changes made by AI.';
      else if (body.includes('AI Lint Fix API Call Failed'))
        summary = 'ALF: API call failed.';
    } else if (botName === 'PR Creator' && body.includes('Adds the new tool')) {
      summary = 'PR Creator: New tool PR created.';
    }

    return {
      botName,
      summary,
      body: body.substring(0, 300) + (body.length > 300 ? '...' : ''),
      timestamp: comment.created_at,
      url: comment.html_url,
    };
  }
  return null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const prNumberStr = searchParams.get('prNumber');
  console.log(`[api/pr-status] GET request. PR#: ${prNumberStr}`);

  if (!prNumberStr)
    return NextResponse.json(
      { error: 'Missing prNumber query parameter.' },
      { status: 400 }
    );
  const actualPrNumber = parseInt(prNumberStr, 10);
  if (isNaN(actualPrNumber) || actualPrNumber <= 0)
    return NextResponse.json({ error: 'Invalid prNumber.' }, { status: 400 });

  try {
    const octokit = await getAuthenticatedOctokit();
    console.log(`[api/pr-status] Fetching PR data for PR #${actualPrNumber}`);
    const { data: prData } = await octokit.rest.pulls.get({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      pull_number: actualPrNumber,
    });
    const headShaToUse = prData.head.sha;
    const prHeadBranchName = prData.head.ref;
    const toolDirective = extractToolDirectiveFromBranchName(prHeadBranchName);

    console.log(
      `[api/pr-status] Head SHA: ${headShaToUse}, Branch: ${prHeadBranchName}, Tool: ${toolDirective || 'N/A'}`
    );

    const [checkRunsResponse, toolGenInfo, commentsResponse] =
      await Promise.all([
        octokit.rest.checks.listForRef({
          owner: GITHUB_REPO_OWNER,
          repo: GITHUB_REPO_NAME,
          ref: headShaToUse,
          per_page: 50,
        }),
        getToolGenerationInfo(octokit, prHeadBranchName, toolDirective),
        octokit.rest.issues.listComments({
          owner: GITHUB_REPO_OWNER,
          repo: GITHUB_REPO_NAME,
          issue_number: actualPrNumber,
          per_page: 15,
          sort: 'created',
          direction: 'desc',
        }),
      ]);

    const allCheckRunsForRef = checkRunsResponse.data;
    const comments = commentsResponse.data;

    const ciChecks: CiCheck[] = [];
    let checksOverallStatus: PrStatusApiResponse['overallCheckStatusForHead'] =
      'pending';
    let netlifySuccess = false;

    const latestChecksMap = new Map<
      string,
      (typeof allCheckRunsForRef.check_runs)[0]
    >();
    for (const run of allCheckRunsForRef.check_runs) {
      const existing = latestChecksMap.get(run.name);
      const runTimestamp = new Date(
        run.completed_at || run.started_at || Date.now()
      ).getTime();
      const existingTimestamp = existing
        ? new Date(existing.completed_at || existing.started_at || 0).getTime()
        : 0;
      if (!existing || runTimestamp > existingTimestamp)
        latestChecksMap.set(run.name, run);
    }
    const sortedChecks = Array.from(latestChecksMap.values()).sort(
      (a, b) =>
        new Date(a.started_at || 0).getTime() -
        new Date(b.started_at || 0).getTime()
    );

    let allCompleted = true;
    let anyFailed = false;
    for (const run of sortedChecks) {
      ciChecks.push({
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        url: run.html_url || undefined,
        started_at: run.started_at,
        completed_at: run.completed_at,
      });
      if (run.status !== 'completed') allCompleted = false;
      if (
        ['failure', 'timed_out', 'cancelled', 'action_required'].includes(
          run.conclusion || ''
        )
      )
        anyFailed = true;
      if (
        run.name.toLowerCase().includes('netlify') &&
        run.name.toLowerCase().includes('deploy') &&
        run.conclusion === 'success'
      ) {
        netlifySuccess = true;
      }
    }

    if (anyFailed) checksOverallStatus = 'failure';
    else if (allCompleted && ciChecks.length > 0)
      checksOverallStatus = 'success';
    else if (!allCompleted && ciChecks.length > 0)
      checksOverallStatus = 'pending';
    else if (ciChecks.length === 0 && prData.state === 'open')
      checksOverallStatus = 'pending';
    else checksOverallStatus = 'error';

    let netlifyPreviewUrl: string | null = null;
    let imgurScreenshotUrl: string | null = null;

    for (const comment of comments) {
      if (comment.body) {
        if (
          !netlifyPreviewUrl &&
          comment.user?.login?.toLowerCase().includes('netlify') &&
          comment.body.includes('Deploy Preview')
        ) {
          const urlMatch = comment.body.match(
            /https:\/\/(deploy-preview-\d+--[a-zA-Z0-9-]+)\.netlify\.app/
          );
          if (urlMatch && urlMatch[0]) netlifyPreviewUrl = urlMatch[0];
        }
        if (!imgurScreenshotUrl) {
          const imgurMatch = comment.body.match(
            /https:\/\/i\.imgur\.com\/[a-zA-Z0-9]+\.(?:png|jpg|jpeg|gif)/i
          );
          if (imgurMatch && imgurMatch[0]) imgurScreenshotUrl = imgurMatch[0];
        }
        if (netlifyPreviewUrl && imgurScreenshotUrl) break;
      }
    }
    if (netlifyPreviewUrl && !netlifySuccess) {
      console.log(
        '[api/pr-status] Netlify URL found in comment, marking Netlify as successful for display.'
      );
      netlifySuccess = true;
    }

    const automatedActions: AutomatedActionsStatus = {
      statusSummary: 'Analyzing PR state...',
      activeWorkflow: null,
      nextExpectedAction: null,
      shouldContinuePolling: true,
      lastBotComment: parseLastBotComment(comments),
      vprConclusionForHead: null,
    };

    const vprJobNamesPattern =
      /\b(initial_checks|analyze_state_and_dependencies|build_and_run_douglas_checker|report_pr_status)\b/i;
    const vprChecks = ciChecks.filter(
      (c) =>
        c.name.toLowerCase().includes('vpr /') ||
        vprJobNamesPattern.test(c.name.toLowerCase())
    );

    const isVprRunning = vprChecks.some(
      (c) => c.status === 'in_progress' || c.status === 'queued'
    );
    const didVprFailOnHead = vprChecks.some((c) =>
      ['failure', 'timed_out', 'cancelled', 'action_required'].includes(
        c.conclusion || ''
      )
    );
    const didVprSucceedOnHead =
      vprChecks.length > 0 &&
      vprChecks.every(
        (c) => c.status === 'completed' && c.conclusion === 'success'
      );

    if (isVprRunning) {
      automatedActions.activeWorkflow = 'VPR';
      automatedActions.statusSummary =
        'VPR workflow is currently running for the latest commit.';
    } else if (didVprFailOnHead) {
      automatedActions.vprConclusionForHead = 'failure';
      if (
        toolGenInfo.npmDependenciesFulfilled === 'absent' &&
        automatedActions.lastBotComment?.summary.includes('Handoff to ADM')
      ) {
        automatedActions.statusSummary =
          'VPR failed. Dependency resolution (ADM) is expected next.';
        automatedActions.nextExpectedAction = 'ADM';
      } else if (
        toolGenInfo.lintFixesAttempted === false &&
        automatedActions.lastBotComment?.summary.includes('Handoff to ALF')
      ) {
        automatedActions.statusSummary =
          'VPR failed. Lint fixing (ALF) is expected next.';
        automatedActions.nextExpectedAction = 'ALF';
      } else if (toolGenInfo.npmDependenciesFulfilled === 'false') {
        automatedActions.statusSummary =
          'VPR failed. ADM previously attempted dependency resolution and issues persist. Manual review needed.';
        automatedActions.nextExpectedAction = 'MANUAL_REVIEW';
        automatedActions.shouldContinuePolling = false;
      } else if (toolGenInfo.lintFixesAttempted === true) {
        automatedActions.statusSummary =
          'VPR failed after lint fix attempt. Manual review likely needed.';
        automatedActions.nextExpectedAction = 'MANUAL_REVIEW';
        automatedActions.shouldContinuePolling = false;
      } else {
        automatedActions.statusSummary =
          'VPR failed. See PR comments for details. Manual review may be needed.';
        automatedActions.nextExpectedAction = 'MANUAL_REVIEW';
        automatedActions.shouldContinuePolling = false;
      }
    } else if (didVprSucceedOnHead) {
      automatedActions.vprConclusionForHead = 'success';
      automatedActions.statusSummary =
        'VPR workflow completed successfully for the latest commit!';
      automatedActions.nextExpectedAction = 'NONE';
      automatedActions.shouldContinuePolling = false;
    } else {
      if (checksOverallStatus === 'pending' && ciChecks.length > 0) {
        automatedActions.statusSummary =
          'CI checks for the latest commit are pending.';
      } else if (ciChecks.length === 0 && prData.state === 'open') {
        automatedActions.statusSummary =
          'Waiting for CI checks to start for the latest commit.';
      } else {
        automatedActions.statusSummary = `PR is ${prData.state}. Last known CI status for HEAD: ${checksOverallStatus}. Review PR for details.`;
        automatedActions.shouldContinuePolling =
          prData.state === 'open' && checksOverallStatus === 'pending';
        if (checksOverallStatus === 'error')
          automatedActions.shouldContinuePolling = false;
      }
    }

    if (prData.state === 'closed') {
      const mergedStatus = prData.merged ? 'merged' : 'closed without merging';
      automatedActions.statusSummary = `PR was ${mergedStatus}. Polling stopped. (${automatedActions.statusSummary})`;
      automatedActions.shouldContinuePolling = false;
      automatedActions.activeWorkflow = null;
      automatedActions.nextExpectedAction = 'NONE';
    }

    const responsePayload: PrStatusApiResponse = {
      prUrl: prData.html_url,
      prNumber: actualPrNumber,
      headSha: headShaToUse,
      prHeadBranch: prHeadBranchName,
      prState: prData.state as 'open' | 'closed',
      isMerged: prData.merged || false,
      checks: ciChecks,
      overallCheckStatusForHead: checksOverallStatus,
      netlifyPreviewUrl,
      netlifyDeploymentSucceeded: netlifySuccess,
      imgurScreenshotUrl,
      toolGenerationInfo: toolGenInfo,
      automatedActions,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    console.error('[api/pr-status] Error in handler:', err.message, err.stack);
    let errorMessage = 'Failed to fetch PR CI status.';
    if (err.message) errorMessage = err.message;

    if (err.status === 404)
      return NextResponse.json(
        { error: `PR #${actualPrNumber} not found. ${errorMessage}` },
        { status: 404 }
      );
    if (err.status === 403 || err.status === 401)
      return NextResponse.json(
        { error: `Permission issue. ${errorMessage}` },
        { status: err.status }
      );

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
