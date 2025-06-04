// FILE: app/api/status-pr/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';
import type { ToolGenerationInfoFileContent } from '@/src/types/build';

import path from 'path';

const GITHUB_REPO_OWNER =
  process.env.GITHUB_REPO_OWNER || 'Online-Everything-Tool';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'oet';
const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_PRIVATE_KEY_BASE64 = process.env.GITHUB_PRIVATE_KEY_BASE64;

const BOT_USERNAMES = {
  VPR: (
    process.env.GITHUB_VPR_BOT_USERNAME || 'github-actions[bot]'
  ).toLowerCase(),
  ADM: (
    process.env.GITHUB_ADM_BOT_USERNAME || 'github-actions[bot]'
  ).toLowerCase(),
  ALF: (
    process.env.GITHUB_ALF_BOT_USERNAME || 'github-actions[bot]'
  ).toLowerCase(),
  PR_CREATOR_BOT: (
    process.env.GITHUB_PR_CREATOR_BOT_USERNAME || 'OET Bot'
  ).toLowerCase(),
  NETLIFY: 'netlify[bot]',
};

const WORKFLOW_FILENAMES = {
  VPR: 'validate_generated_tool_pr.yml',
  ADM: 'ai_dependency_manager.yml',
  ALF: 'ai_lint_fixer.yml',
};

const MAX_POLLING_ATTEMPTS_API = 360;
let octokitInstance: Octokit | undefined;

interface PrInfo {
  number: number;
  title: string | null;
  state: 'open' | 'closed';
  merged: boolean;
  branch: string | null;
  headSha: string;
  baseBranch: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  user: string | null | undefined;
}
interface ToolGenInfo {
  status: 'found' | 'error_fetching' | 'not_applicable';
  content: ToolGenerationInfoFileContent | null;
  error: string | null;
}
interface WorkflowJobStep {
  name: string;
  status: string | null;
  conclusion: string | null;
}
interface WorkflowJob {
  id: number;
  name: string;
  status: string | null;
  conclusion: string | null;
  html_url: string | null;
  started_at: string | null;
  completed_at: string | null;
  steps: WorkflowJobStep[];
}
interface WorkflowArtifact {
  id: number;
  name: string;
  size_in_bytes: number;
  expired: boolean;
  expires_at: string | null;
}
interface WorkflowRun {
  id: number;
  name: string | null;
  workflow_filename: string;
  status: string | null;
  conclusion: string | null;
  html_url: string | null;
  head_sha: string;
  created_at: string;
  updated_at: string;
  event: string;
  jobs: WorkflowJob[];
  artifacts: WorkflowArtifact[];
}
interface CategorizedWorkflowRuns {
  vpr: WorkflowRun[];
  adm: WorkflowRun[];
  alf: WorkflowRun[];
  other: WorkflowRun[];
}
interface NetlifyStatusInfo {
  id: number;
  status: string | null;
  conclusion: string | null;
  url: string | null;
  details_url?: string | null;
  app_slug?: string | null;
}
interface PrComment {
  id: number;
  user: string | null | undefined;
  created_at: string;
  updated_at: string;
  body: string;
  html_url: string;
  isBot: boolean;
  botType: string | null;
}
interface PrCiSummaryData {
  prInfo: PrInfo;
  toolGenerationInfo: ToolGenInfo;
  githubActions: CategorizedWorkflowRuns;
  netlifyStatus: NetlifyStatusInfo | null;
  recentComments: PrComment[];
  imgurScreenshotUrl: string | null;
  timestamp: string;
}

interface CiCheck {
  name: string;
  status: string | null;
  conclusion: string | null;
  url?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}
interface LastBotComment {
  botName: string | null;
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
  uiHint: 'info' | 'success' | 'warning' | 'error' | 'loading';
}
interface PrStatusApiResponse {
  prUrl: string;
  prNumber: number;
  headSha: string;
  prHeadBranch: string | null;
  prState: 'open' | 'closed';
  isMerged: boolean;
  checks: CiCheck[];
  overallCheckStatusForHead:
    | 'pending'
    | 'success'
    | 'failure'
    | 'error'
    | 'unknown';
  netlifyPreviewUrl: string | null;
  netlifyDeploymentSucceeded: boolean;
  imgurScreenshotUrl?: string | null;
  toolGenerationInfoForUI: {
    npmDependenciesFulfilled:
      | ToolGenerationInfoFileContent['npmDependenciesFulfilled']
      | 'not_found'
      | 'not_applicable';
    lintFixesAttempted: boolean | 'not_found' | 'not_applicable';
    identifiedDependencies?: string[] | null;
  };
  automatedActions: AutomatedActionsStatus;
  lastUpdated: string;
  error?: string;
  _debug_data_source?: PrCiSummaryData;
}

async function getAuthenticatedOctokit(): Promise<Octokit> {
  if (octokitInstance) return octokitInstance;
  if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY_BASE64) {
    throw new Error(
      'Server configuration error: GitHub App credentials missing.'
    );
  }
  const privateKey = Buffer.from(GITHUB_PRIVATE_KEY_BASE64, 'base64').toString(
    'utf-8'
  );
  if (!privateKey || !privateKey.startsWith('-----BEGIN')) {
    throw new Error('Decoded private key is invalid or not in PEM format.');
  }
  const appAuth = createAppAuth({ appId: GITHUB_APP_ID, privateKey });
  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: { appId: GITHUB_APP_ID, privateKey },
  });
  const { data: installation } = await appOctokit.rest.apps.getRepoInstallation(
    { owner: GITHUB_REPO_OWNER, repo: GITHUB_REPO_NAME }
  );
  if (!installation.id)
    throw new Error(
      `App installation not found for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}.`
    );
  const { token } = await appAuth({
    type: 'installation',
    installationId: installation.id,
  });
  octokitInstance = new Octokit({ auth: token });
  return octokitInstance;
}

function extractToolDirectiveFromBranchName(
  branchName: string | null
): string | null {
  if (!branchName || !branchName.startsWith('feat/gen-')) return null;
  const tempDirective = branchName.substring('feat/gen-'.length);
  return tempDirective.replace(/-[0-9]+$/, '') || null;
}

async function getJsonFileContent<T>(
  octokit: Octokit,
  owner: string,
  repo: string,
  filePath: string,
  ref: string
): Promise<T | { error: string }> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref,
    });
    // @ts-expect-error bad stuff can happen
    if (data && data.content && data.encoding === 'base64') {
      // @ts-expect-error bad stuff can happen
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return JSON.parse(content) as T;
    }
    return {
      error: `File content not base64 or type not file: ${filePath} at ref ${ref}`,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.status === 404)
      return { error: `File not found: ${filePath} at ref ${ref}` };
    return {
      error: `Error fetching ${filePath} at ref ${ref}: ${error.message}`,
    };
  }
}

async function fetchFullPrCiSummary(
  prNumber: number,
  octokit: Octokit,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prDataInput?: any
): Promise<PrCiSummaryData> {
  const prData =
    prDataInput ||
    (
      await octokit.rest.pulls.get({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
        pull_number: prNumber,
      })
    ).data;

  const headSha = prData.head.sha;
  const prHeadBranch = prData.head.ref;
  const toolDirective = extractToolDirectiveFromBranchName(prHeadBranch);

  let toolGenerationInfo: ToolGenInfo = {
    status: 'not_applicable',
    content: null,
    error: null,
  };
  if (toolDirective) {
    const result = await getJsonFileContent<ToolGenerationInfoFileContent>(
      octokit,
      GITHUB_REPO_OWNER,
      GITHUB_REPO_NAME,
      `app/tool/${toolDirective}/tool-generation-info.json`,
      headSha
    );
    if ('error' in result) {
      toolGenerationInfo = {
        status: 'error_fetching',
        content: null,
        error: result.error,
      };
    } else {
      toolGenerationInfo = { status: 'found', content: result, error: null };
    }
  }

  const { data: repoWorkflowRuns } =
    await octokit.rest.actions.listWorkflowRunsForRepo({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      per_page: 75,
    });

  const relevantWorkflowRuns = repoWorkflowRuns.workflow_runs.filter(
    (run) =>
      run.pull_requests?.some(
        (pr) => pr.id === prData.id && pr.number === prNumber
      ) || run.head_sha === headSha
  );

  const categorizedWorkflowRuns: CategorizedWorkflowRuns = {
    vpr: [],
    adm: [],
    alf: [],
    other: [],
  };
  for (const run of relevantWorkflowRuns) {
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
    const runSummary: WorkflowRun = {
      id: run.id,
      name: run.name || 'Unnamed Workflow',
      workflow_filename: path.basename(run.path),
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
    if (wfFilename === WORKFLOW_FILENAMES.VPR)
      categorizedWorkflowRuns.vpr.push(runSummary);
    else if (wfFilename === WORKFLOW_FILENAMES.ADM)
      categorizedWorkflowRuns.adm.push(runSummary);
    else if (wfFilename === WORKFLOW_FILENAMES.ALF)
      categorizedWorkflowRuns.alf.push(runSummary);
    else categorizedWorkflowRuns.other.push(runSummary);
  }

  Object.keys(categorizedWorkflowRuns).forEach((category) => {
    // @ts-expect-error bad stuff can happen
    categorizedWorkflowRuns[category].sort(
      (a: WorkflowRun, b: WorkflowRun) =>
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
  const netlifyStatus: NetlifyStatusInfo | null = netlifyCheckSuiteData
    ? {
        id: netlifyCheckSuiteData.id,
        status: netlifyCheckSuiteData.status,
        conclusion: netlifyCheckSuiteData.conclusion,
        url: netlifyCheckSuiteData.url,
        // @ts-expect-error bad stuff can happen
        details_url: netlifyCheckSuiteData.details_url || null,
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
  const recentComments: PrComment[] = commentsData.map((comment) => {
    const userLoginLower = comment.user?.login?.toLowerCase();
    let determinedBotType = null;

    if (comment.user?.type === 'Bot') {
      if (
        userLoginLower === BOT_USERNAMES.VPR &&
        comment.body?.includes('## 🤖 OET Tool PR Validation Status')
      ) {
        determinedBotType = 'VPR';
      } else if (
        userLoginLower === BOT_USERNAMES.ADM &&
        comment.body?.includes('## 🤖 AI Dependency Manager Results')
      ) {
        determinedBotType = 'ADM';
      } else if (
        userLoginLower === BOT_USERNAMES.ALF &&
        comment.body?.includes('## 🤖 AI Lint Fixer Results')
      ) {
        determinedBotType = 'ALF';
      } else if (userLoginLower === BOT_USERNAMES.PR_CREATOR_BOT) {
        determinedBotType = 'PR_CREATOR_BOT';
      } else if (userLoginLower === 'netlify[bot]') {
        determinedBotType = 'Netlify';
      } else if (userLoginLower === 'github-actions[bot]') {
        if (comment.body?.includes('## 🤖 OET Tool PR Validation Status'))
          determinedBotType = 'VPR';
        else if (comment.body?.includes('## 🤖 AI Lint Fixer Results'))
          determinedBotType = 'ALF';
        else if (comment.body?.includes('## 🤖 AI Dependency Manager Results'))
          determinedBotType = 'ADM';
        else determinedBotType = 'GitHubActionsBot_Other';
      } else {
        determinedBotType = 'OtherBot';
      }
    }
    return {
      id: comment.id,
      user: comment.user?.login,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      body: comment.body || '',
      html_url: comment.html_url,
      isBot: comment.user?.type === 'Bot',
      botType: determinedBotType,
    };
  });

  let imgurScreenshotUrlFromComments: string | null = null;
  const vprBotCommentForImgur = recentComments.find(
    (c) => c.botType === 'VPR' && c.body?.includes('(Direct Imgur Link:')
  );
  if (vprBotCommentForImgur?.body) {
    const directLinkRegex =
      /\(Direct Imgur Link:\s*(https:\/\/i\.imgur\.com\/[a-zA-Z0-9]+\.(?:png|jpg|jpeg|gif))\)/i;
    const imgurMatch = vprBotCommentForImgur.body.match(directLinkRegex);
    if (imgurMatch && imgurMatch[1]) {
      imgurScreenshotUrlFromComments = imgurMatch[1];
    }
  }

  const prInfo: PrInfo = {
    number: prData.number,
    title: prData.title,
    state: prData.state as 'open' | 'closed',
    merged: prData.merged_at !== null,
    branch: prData.head.ref,
    headSha: prData.head.sha,
    baseBranch: prData.base.ref,
    url: prData.html_url,
    createdAt: prData.created_at,
    updatedAt: prData.updated_at,
    user: prData.user?.login,
  };

  return {
    prInfo,
    toolGenerationInfo,
    githubActions: categorizedWorkflowRuns,
    netlifyStatus,
    recentComments,
    imgurScreenshotUrl: imgurScreenshotUrlFromComments,
    timestamp: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const prNumberStr = searchParams.get('prNumber');
  const pollingAttemptStr = searchParams.get('pollingAttempt');
  const pollingAttempt = pollingAttemptStr
    ? parseInt(pollingAttemptStr, 10)
    : 0;

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
    const summary = await fetchFullPrCiSummary(actualPrNumber, octokit);

    const {
      prInfo,
      toolGenerationInfo,
      githubActions,
      netlifyStatus,
      recentComments,
      imgurScreenshotUrl,
    } = summary;

    let statusSummary = 'Analyzing PR status...';
    let nextExpectedAction: string | null = 'VPR_PENDING';
    let shouldContinuePolling = true;
    let uiHint: AutomatedActionsStatus['uiHint'] = 'loading';
    let overallCheckStatusForHead: PrStatusApiResponse['overallCheckStatusForHead'] =
      'unknown';
    let netlifyPreviewUrl: string | null = null;
    let netlifyDeploymentSucceeded = false;

    let wasVprFinalized: boolean | undefined = false;
    let latestVprRunForHead: WorkflowRun | undefined = undefined;

    if (prInfo.state === 'closed') {
      shouldContinuePolling = false;
      nextExpectedAction = 'NONE';
      const toolDirectiveNameForClosedPr =
        extractToolDirectiveFromBranchName(prInfo.branch) ||
        prInfo.branch ||
        `PR #${prInfo.number}`;
      if (prInfo.merged) {
        statusSummary = `PR #${prInfo.number} for '${toolDirectiveNameForClosedPr}' was MERGED!`;
        uiHint = 'success';
        overallCheckStatusForHead = 'success';
      } else {
        statusSummary = `PR #${prInfo.number} for '${toolDirectiveNameForClosedPr}' was CLOSED without merging.`;
        uiHint = 'info';
        const lastVprRun = githubActions.vpr[0];
        if (lastVprRun && lastVprRun.conclusion === 'failure')
          overallCheckStatusForHead = 'failure';
        else if (lastVprRun && lastVprRun.conclusion === 'success')
          overallCheckStatusForHead = 'success';
        else overallCheckStatusForHead = 'unknown';
      }
      const netlifyBotComment = recentComments.find(
        (c) => c.botType === 'Netlify' && c.body?.includes('Deploy Preview')
      );
      if (netlifyBotComment?.body) {
        const urlMatch = netlifyBotComment.body.match(
          /https:\/\/(deploy-preview-\d+--[a-zA-Z0-9-]+)\.netlify\.app/
        );
        if (urlMatch && urlMatch[0]) netlifyPreviewUrl = urlMatch[0];
      }
      if (netlifyStatus?.conclusion === 'success')
        netlifyDeploymentSucceeded = true;
    } else {
      latestVprRunForHead = githubActions.vpr.find(
        (run) => run.head_sha === prInfo.headSha
      );
      const latestAlfComment = recentComments.find((c) => c.botType === 'ALF');

      wasVprFinalized =
        toolGenerationInfo.status === 'error_fetching' &&
        toolGenerationInfo.error?.includes('File not found') &&
        prInfo.title != null &&
        !prInfo.title.includes('[skip netlify]');

      if (wasVprFinalized) {
        overallCheckStatusForHead = 'success';
        uiHint = 'success';
        const directiveForUrl = extractToolDirectiveFromBranchName(
          prInfo.branch
        );
        const toolNameForMsg =
          directiveForUrl || prInfo.branch || `PR #${prInfo.number}`;

        if (netlifyStatus?.conclusion === 'success') {
          netlifyDeploymentSucceeded = true;
          const netlifyBaseComment = recentComments.find(
            (c) => c.botType === 'Netlify' && c.body?.includes('Deploy Preview')
          );
          if (netlifyBaseComment?.body) {
            const urlMatch = netlifyBaseComment.body.match(
              /https:\/\/(deploy-preview-\d+--[a-zA-Z0-9-]+)\.netlify\.app/
            );
            if (urlMatch && urlMatch[0] && directiveForUrl)
              netlifyPreviewUrl = `${urlMatch[0]}/tool/${directiveForUrl}`;
            else if (urlMatch && urlMatch[0]) netlifyPreviewUrl = urlMatch[0];
          }
          statusSummary = `Netlify Deploy Preview for '${toolNameForMsg}' is READY!`;
          nextExpectedAction = 'USER_REVIEW_PREVIEW';
          shouldContinuePolling = false;
        } else if (
          netlifyStatus?.status === 'queued' ||
          netlifyStatus?.status === 'in_progress' ||
          !netlifyStatus
        ) {
          statusSummary = `VPR checks passed! Netlify Deploy Preview is ${netlifyStatus?.status || 'pending'} for '${toolNameForMsg}'.`;
          nextExpectedAction = 'NETLIFY_PREVIEW';
          uiHint = 'loading';
        } else if (netlifyStatus?.conclusion === 'failure') {
          statusSummary = `VPR checks passed, but Netlify Deploy Preview FAILED for '${toolNameForMsg}'. Manual review needed.`;
          nextExpectedAction = 'MANUAL_REVIEW_NETLIFY';
          shouldContinuePolling = false;
          uiHint = 'error';
        } else {
          statusSummary = `VPR checks passed for commit ${prInfo.headSha.substring(0, 7)}. Waiting for Netlify...`;
          nextExpectedAction = 'NETLIFY_PREVIEW';
          uiHint = 'loading';
        }
      } else if (latestVprRunForHead) {
        if (latestVprRunForHead.status === 'completed') {
          overallCheckStatusForHead =
            latestVprRunForHead.conclusion === 'success'
              ? 'success'
              : 'failure';
          const vprJob4 = latestVprRunForHead.jobs.find((job) =>
            job.name.includes('4. Report PR Validation Status')
          );

          if (latestVprRunForHead.conclusion === 'success') {
            statusSummary = `VPR checks passed for commit ${prInfo.headSha.substring(0, 7)}. Finalizing for Netlify preview...`;
            nextExpectedAction = 'VPR_FINALIZING';
            uiHint = 'loading';
          } else {
            uiHint = 'error';
            const isLintIssueArtifact = latestVprRunForHead.artifacts.some(
              (art) => art.name.startsWith('lint-failure-data')
            );
            const toolGenContent = toolGenerationInfo.content;

            if (vprJob4?.conclusion === 'failure') {
              statusSummary = `Critical VPR Error: 'Report PR Status' job failed (run ${latestVprRunForHead.id}). Manual review of Actions logs needed.`;
              nextExpectedAction = 'MANUAL_REVIEW_CI_ERROR';
              shouldContinuePolling = false;
            } else if (isLintIssueArtifact) {
              if (toolGenContent?.lintFixesAttempted) {
                statusSummary =
                  'AI Lint Fixer previously tried. Build/lint issues persist. Manual review of PR required.';
                nextExpectedAction = 'MANUAL_REVIEW_LINT';
                shouldContinuePolling = false;
              } else if (
                latestAlfComment?.body?.includes('AI Lint Fix API Call Failed')
              ) {
                statusSummary =
                  'AI Lint Fixer API error. Manual review required.';
                nextExpectedAction = 'MANUAL_REVIEW_LINT_API_FAIL';
                shouldContinuePolling = false;
              } else {
                statusSummary =
                  'VPR detected build/lint issues. Expecting AI Lint Fixer (ALF) to run.';
                nextExpectedAction = 'ALF_EXPECTED';
                uiHint = 'loading';
              }
            } else if (
              toolGenContent?.identifiedDependencies &&
              toolGenContent.identifiedDependencies.length > 0 &&
              toolGenContent.npmDependenciesFulfilled === 'absent'
            ) {
              statusSummary =
                'VPR identified new dependencies. Expecting AI Dependency Manager (ADM) to run.';
              nextExpectedAction = 'ADM_EXPECTED';
              uiHint = 'loading';
            } else if (toolGenContent?.npmDependenciesFulfilled === 'false') {
              statusSummary =
                'AI Dependency Manager previously failed. Manual review required.';
              nextExpectedAction = 'MANUAL_REVIEW_DEPS';
              shouldContinuePolling = false;
            } else {
              statusSummary = `VPR failed (commit ${prInfo.headSha.substring(0, 7)}). Cause unclear. Manual review of PR & Actions needed.`;
              nextExpectedAction = 'MANUAL_REVIEW_VPR_UNKNOWN';
              shouldContinuePolling = false;
            }
          }
        } else if (
          latestVprRunForHead.status === 'in_progress' ||
          latestVprRunForHead.status === 'queued'
        ) {
          statusSummary = `VPR workflow is ${latestVprRunForHead.status} for commit ${prInfo.headSha.substring(0, 7)}...`;
          nextExpectedAction = 'VPR_RUNNING';
          uiHint = 'loading';
          overallCheckStatusForHead = 'pending';
        } else {
          statusSummary = `VPR status for commit ${prInfo.headSha.substring(0, 7)} is '${latestVprRunForHead.status}'. Waiting for completion...`;
          nextExpectedAction = 'VPR_RUNNING';
          uiHint = 'loading';
          overallCheckStatusForHead = 'pending';
        }
      } else {
        statusSummary = `Waiting for VPR checks to start for commit ${prInfo.headSha.substring(0, 7)}...`;
        nextExpectedAction = 'VPR_PENDING';
        uiHint = 'loading';
        overallCheckStatusForHead = 'pending';
      }
    }

    if (
      pollingAttempt >= MAX_POLLING_ATTEMPTS_API &&
      shouldContinuePolling &&
      prInfo.state === 'open'
    ) {
      statusSummary =
        'Max polling attempts reached. Please check the PR on GitHub for the latest status.';
      shouldContinuePolling = false;
      nextExpectedAction = 'MANUAL_REVIEW_TIMEOUT';
      uiHint = 'error';
    }

    const vprJobsForUi =
      githubActions.vpr.find((run) => run.head_sha === prInfo.headSha)?.jobs ||
      githubActions.vpr[0]?.jobs ||
      [];
    const uiChecks: CiCheck[] = vprJobsForUi
      .map(
        (j) =>
          ({
            name: j.name,
            status: j.status,
            conclusion: j.conclusion,
            url: j.html_url || null,
            started_at: j.started_at,
            completed_at: j.completed_at,
          }) as CiCheck
      )
      .concat(
        netlifyStatus
          ? [
              {
                name: `Netlify Deploy (${netlifyStatus.app_slug || 'site'})`,
                status: netlifyStatus.status,
                conclusion: netlifyStatus.conclusion,
                url: netlifyStatus.details_url || null,
                started_at: null,
                completed_at: null,
              } as CiCheck,
            ]
          : []
      );

    const toolGenInfoForUI: PrStatusApiResponse['toolGenerationInfoForUI'] = {
      npmDependenciesFulfilled:
        toolGenerationInfo.status === 'found' && toolGenerationInfo.content
          ? (toolGenerationInfo.content.npmDependenciesFulfilled ?? 'absent')
          : toolGenerationInfo.status === 'not_applicable'
            ? 'not_applicable'
            : 'not_found',
      lintFixesAttempted:
        toolGenerationInfo.status === 'found' && toolGenerationInfo.content
          ? (toolGenerationInfo.content.lintFixesAttempted ?? false)
          : toolGenerationInfo.status === 'not_applicable'
            ? 'not_applicable'
            : 'not_found',
      identifiedDependencies:
        toolGenerationInfo.status === 'found' && toolGenerationInfo.content
          ? toolGenerationInfo.content.identifiedDependencies?.map(
              (d) => d.packageName
            ) || null
          : null,
    };

    const automatedActions: AutomatedActionsStatus = {
      statusSummary,
      activeWorkflow: null,
      nextExpectedAction,
      shouldContinuePolling,
      uiHint,
    };
    const lastBotActionComment = recentComments.find(
      (c) =>
        c.isBot &&
        (c.botType === 'VPR' ||
          c.botType === 'ALF' ||
          c.botType === 'ADM' ||
          c.botType === 'Netlify')
    );
    if (lastBotActionComment) {
      automatedActions.lastBotComment = {
        botName: lastBotActionComment.botType,
        summary: lastBotActionComment.body
          .split('\n')[0]
          .replace(/^(##\s*🤖\s*|###\s*<span.*?>.*?<\/span>\s*)/, '')
          .substring(0, 100)
          .trim(),
        body: lastBotActionComment.body,
        timestamp: lastBotActionComment.created_at,
        url: lastBotActionComment.html_url,
      };
    }

    console.log(
      `[API Status PR #${actualPrNumber} For SHA ${prInfo.headSha.substring(0, 7)}] FINAL DECISION:`
    );
    console.log(`  - PR State: ${prInfo.state}, Merged: ${prInfo.merged}`);
    console.log(
      `  - ToolGenInfo Status: ${toolGenerationInfo.status}, LintFixAttempted: ${toolGenInfoForUI.lintFixesAttempted}, NPMFulfilled: ${toolGenInfoForUI.npmDependenciesFulfilled}`
    );
    console.log(
      `  - VPR for HEAD (${prInfo.headSha.substring(0, 7)}): ${latestVprRunForHead ? `${latestVprRunForHead.status}/${latestVprRunForHead.conclusion}` : 'Not Found (or VPR Finalized)'}`
    );
    console.log(`  - WasVprFinalized (heuristic): ${wasVprFinalized}`);
    console.log(
      `  - Netlify Status: ${netlifyStatus?.status}/${netlifyStatus?.conclusion}`
    );
    console.log(
      `  - Imgur Screenshot URL found by API: ${imgurScreenshotUrl || 'No'}`
    );
    console.log(`  - Netlify Preview URL constructed: ${netlifyPreviewUrl}`);
    console.log(`  - SHOULD CONTINUE POLLING: ${shouldContinuePolling}`);
    console.log(`  - NEXT EXPECTED ACTION: ${nextExpectedAction}`);
    console.log(`  - UI HINT: ${uiHint}`);
    console.log(
      `  - Overall Check Status for HEAD: ${overallCheckStatusForHead}`
    );

    const responsePayload: PrStatusApiResponse = {
      prUrl: prInfo.url,
      prNumber: actualPrNumber,
      headSha: prInfo.headSha,
      prHeadBranch: prInfo.branch,
      prState: prInfo.state,
      isMerged: prInfo.merged,
      checks: uiChecks,
      overallCheckStatusForHead,
      netlifyPreviewUrl,
      netlifyDeploymentSucceeded,
      imgurScreenshotUrl,
      toolGenerationInfoForUI: toolGenInfoForUI,
      automatedActions,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(responsePayload, { status: 200 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error(
      `[api/status-pr PR#${actualPrNumber}] Error in GET handler:`,
      error.message,
      error.stack
    );
    let errorMessage = `Failed to fetch PR CI status: ${error.message}`;
    let statusCode = 500;
    if (error.status === 404) {
      errorMessage = `PR #${actualPrNumber} not found. ${error.message}`;
      statusCode = 404;
    } else if (error.status === 403 || error.status === 401) {
      errorMessage = `Permission issue fetching PR status. ${error.message}`;
      statusCode = error.status;
    }
    return NextResponse.json(
      {
        error: errorMessage,
        lastUpdated: new Date().toISOString(),
      } as Partial<PrStatusApiResponse>,
      { status: statusCode }
    );
  }
}
