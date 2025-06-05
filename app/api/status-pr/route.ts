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
  status: 'found' | 'error_fetching' | 'not_applicable' | 'deleted';
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
  run_attempt?: number;
}
interface CategorizedWorkflowRuns {
  vpr: WorkflowRun[];
  adm: WorkflowRun[];
  alf: WorkflowRun[];
  other: WorkflowRun[];
}

interface NetlifyCheckRun {
  id: number;
  name: string;
  status: string | null;
  conclusion: string | null;
  html_url: string | null;
  details_url: string | null;
  output?: { title?: string | null; summary?: string | null };
}

interface NetlifyStatusInfo {
  id: number;
  status: string | null;
  conclusion: string | null;
  url: string | null;
  app_slug?: string | null;
  deployment_id?: string | null;
  deploy_url?: string | null;
  check_runs?: NetlifyCheckRun[];
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
  workflow_run_id?: number | null;
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
  workflow_run_id?: number | null;
}

type NextExpectedActionType =
  | 'VPR_PENDING'
  | 'VPR_RUNNING'
  | 'VPR_FINALIZING'
  | 'ADM_EXPECTED'
  | 'ADM_RUNNING'
  | 'ALF_EXPECTED'
  | 'ALF_RUNNING'
  | 'NETLIFY_PREVIEW'
  | 'USER_REVIEW_PREVIEW'
  | 'MANUAL_REVIEW_VPR_CRITICAL'
  | 'MANUAL_REVIEW_VPR_UNKNOWN'
  | 'MANUAL_REVIEW_VPR_OTHER'
  | 'MANUAL_REVIEW_LINT'
  | 'MANUAL_REVIEW_NETLIFY'
  | 'MANUAL_REVIEW_TIMEOUT'
  | 'MANUAL_REVIEW_CI_ERROR'
  | 'NONE';

interface AutomatedActionsStatus {
  statusSummary: string;
  activeWorkflow: string | null;
  nextExpectedAction: NextExpectedActionType;
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
    | 'unknown'
    | 'neutral';
  netlifyPreviewUrl: string | null;
  netlifyDeploymentSucceeded: boolean;
  imgurScreenshotUrl?: string | null;
  toolGenerationInfoForUI: {
    npmDependenciesFulfilled:
      | ToolGenerationInfoFileContent['npmDependenciesFulfilled']
      | 'not_found'
      | 'not_applicable'
      | 'deleted';
    lintFixesAttempted: boolean | 'not_found' | 'not_applicable' | 'deleted';
    identifiedDependencies?: string[] | null;
  };
  automatedActions: AutomatedActionsStatus;
  lastUpdated: string;
  error?: string;
  _debug_data_source?: PrCiSummaryData;
}

let octokitInstance: Octokit | undefined;
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
    {
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
    }
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
    // @ts-expect-error Octokit types for data.content and data.encoding
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

function parseWorkflowRunIdFromComment(commentBody: string): number | null {
  const match = commentBody.match(/\/actions\/runs\/(\d+)/);
  return match && match[1] ? parseInt(match[1], 10) : null;
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

  let fetchedToolGenerationInfo: ToolGenInfo = {
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
      if (result.error.includes('File not found')) {
        fetchedToolGenerationInfo = {
          status: 'deleted',
          content: null,
          error: result.error,
        };
      } else {
        fetchedToolGenerationInfo = {
          status: 'error_fetching',
          content: null,
          error: result.error,
        };
      }
    } else {
      fetchedToolGenerationInfo = {
        status: 'found',
        content: result,
        error: null,
      };
    }
  }

  const { data: repoWorkflowRuns } =
    await octokit.rest.actions.listWorkflowRunsForRepo({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      per_page: 100,
    });

  const relevantWorkflowRuns = repoWorkflowRuns.workflow_runs.filter(
    (run) =>
      run.pull_requests?.some((pr) => pr.number === prNumber) ||
      run.head_sha === headSha
  );

  const categorizedWorkflowRuns: CategorizedWorkflowRuns = {
    vpr: [],
    adm: [],
    alf: [],
    other: [],
  };
  for (const run of relevantWorkflowRuns) {
    let jobs: WorkflowJob[] = [];
    let artifacts: WorkflowArtifact[] = [];

    if (
      run.head_sha === headSha ||
      (path.basename(run.path) === WORKFLOW_FILENAMES.VPR &&
        run.pull_requests?.some((pr) => pr.number === prNumber))
    ) {
      try {
        const { data: jobsData } =
          await octokit.rest.actions.listJobsForWorkflowRun({
            owner: GITHUB_REPO_OWNER,
            repo: GITHUB_REPO_NAME,
            run_id: run.id,
          });
        jobs = jobsData.jobs.map((job) => ({
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
        }));
      } catch (e) {
        console.warn(
          `[API status-pr] Failed to fetch jobs for run ${run.id}: ${e instanceof Error ? e.message : String(e)}`
        );
      }

      try {
        const { data: artifactsData } =
          await octokit.rest.actions.listWorkflowRunArtifacts({
            owner: GITHUB_REPO_OWNER,
            repo: GITHUB_REPO_NAME,
            run_id: run.id,
          });
        artifacts = artifactsData.artifacts.map((art) => ({
          id: art.id,
          name: art.name,
          size_in_bytes: art.size_in_bytes,
          expired: art.expired,
          expires_at: art.expires_at,
        }));
      } catch (e) {
        console.warn(
          `[API status-pr] Failed to fetch artifacts for run ${run.id}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

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
      jobs,
      artifacts,
      run_attempt: run.run_attempt,
    };

    const wfFilename = runSummary.workflow_filename;
    if (wfFilename === WORKFLOW_FILENAMES.VPR)
      categorizedWorkflowRuns.vpr.push(runSummary);
    else if (wfFilename === WORKFLOW_FILENAMES.ADM)
      categorizedWorkflowRuns.adm.push(runSummary);
    else if (wfFilename === WORKFLOW_FILENAMES.ALF)
      categorizedWorkflowRuns.alf.push(runSummary);
    else categorizedWorkflowRuns.other.push(runSummary);
  }

  Object.keys(categorizedWorkflowRuns).forEach((category) => {
    // @ts-expect-error - category is a key of CategorizedWorkflowRuns
    categorizedWorkflowRuns[category].sort((a: WorkflowRun, b: WorkflowRun) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return (b.run_attempt || 0) - (a.run_attempt || 0);
    });
  });

  const { data: checkSuitesResponse } =
    await octokit.rest.checks.listSuitesForRef({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      ref: headSha,
    });
  const netlifyCheckSuiteData = checkSuitesResponse.check_suites.find(
    (suite) => suite.app?.slug === BOT_USERNAMES.NETLIFY.replace('[bot]', '')
  );

  let netlifyStatus: NetlifyStatusInfo | null = null;
  if (netlifyCheckSuiteData) {
    let deployUrl: string | null = null;
    const deploymentId: string | null = null;
    let checkRunsForSuite: NetlifyCheckRun[] = [];

    const { data: checkRunsData } = await octokit.rest.checks.listForSuite({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      check_suite_id: netlifyCheckSuiteData.id,
    });
    checkRunsForSuite = checkRunsData.check_runs.map((cr) => ({
      id: cr.id,
      name: cr.name,
      status: cr.status,
      conclusion: cr.conclusion,
      html_url: cr.html_url,
      details_url: cr.details_url,
      output: cr.output,
    }));

    const deployPreviewRun = checkRunsForSuite.find((cr) =>
      cr.name.toLowerCase().includes('deploy preview')
    );
    if (deployPreviewRun?.details_url?.includes('netlify.app')) {
      deployUrl = deployPreviewRun.details_url;
    } else if (
      deployPreviewRun?.output?.summary?.includes('https://') &&
      deployPreviewRun.output.summary.includes('netlify.app')
    ) {
      const urlMatch = deployPreviewRun.output.summary.match(
        /(https:\/\/[^ ]*netlify\.app[^ ]*)/
      );
      if (urlMatch && urlMatch[0]) deployUrl = urlMatch[0];
    }

    if (deployUrl) {
      const deployIdMatch = deployUrl.match(/deploy-preview-\d+--[^.]+/);
      if (deployIdMatch && deployIdMatch[0]) {
        const fullSubdomain = deployIdMatch[0];
        const actualDeployIdMatch = fullSubdomain.match(/^deploy-preview-\d+/);
        if (actualDeployIdMatch && actualDeployIdMatch[0]) {
        }
      }
    }

    netlifyStatus = {
      id: netlifyCheckSuiteData.id,
      status: netlifyCheckSuiteData.status,
      conclusion: netlifyCheckSuiteData.conclusion,
      url: netlifyCheckSuiteData.url,
      app_slug: netlifyCheckSuiteData.app?.slug,
      deployment_id: deploymentId,
      deploy_url: deployUrl,
      check_runs: checkRunsForSuite,
    };
  }

  const { data: commentsData } = await octokit.rest.issues.listComments({
    owner: GITHUB_REPO_OWNER,
    repo: GITHUB_REPO_NAME,
    issue_number: prNumber,
    per_page: 30,
  });
  const recentComments: PrComment[] = commentsData
    .map((comment) => {
      const userLoginLower = comment.user?.login?.toLowerCase();
      let determinedBotType: PrComment['botType'] = null;
      if (comment.user?.type === 'Bot') {
        if (
          userLoginLower === BOT_USERNAMES.VPR &&
          comment.body?.includes('## 🤖 OET Tool PR Validation Status')
        )
          determinedBotType = 'VPR';
        else if (
          userLoginLower === BOT_USERNAMES.ADM &&
          comment.body?.includes('## 🤖 AI Dependency Manager Results')
        )
          determinedBotType = 'ADM';
        else if (
          userLoginLower === BOT_USERNAMES.ALF &&
          comment.body?.includes('## 🤖 AI Lint Fixer Results')
        )
          determinedBotType = 'ALF';
        else if (userLoginLower === BOT_USERNAMES.PR_CREATOR_BOT)
          determinedBotType = 'PR_CREATOR_BOT';
        else if (userLoginLower === BOT_USERNAMES.NETLIFY)
          determinedBotType = 'Netlify';
        else if (userLoginLower === 'github-actions[bot]') {
          if (comment.body?.includes('## 🤖 OET Tool PR Validation Status'))
            determinedBotType = 'VPR_generic';
          else if (comment.body?.includes('## 🤖 AI Lint Fixer Results'))
            determinedBotType = 'ALF_generic';
          else if (
            comment.body?.includes('## 🤖 AI Dependency Manager Results')
          )
            determinedBotType = 'ADM_generic';
          else determinedBotType = 'GitHubActionsBot_Other';
        } else determinedBotType = 'OtherBot';
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
        workflow_run_id: parseWorkflowRunIdFromComment(comment.body || ''),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  let imgurScreenshotUrlFromComments: string | null = null;
  const vprBotCommentForImgur = recentComments.find(
    (c) =>
      (c.botType === 'VPR' || c.botType === 'VPR_generic') &&
      c.body?.includes('(Direct Imgur Link:')
  );
  if (vprBotCommentForImgur?.body) {
    const directLinkRegex =
      /\(Direct Imgur Link:\s*(https:\/\/i\.imgur\.com\/[a-zA-Z0-9]+\.(?:png|jpg|jpeg|gif))\)/i;
    const imgurMatch = vprBotCommentForImgur.body.match(directLinkRegex);
    if (imgurMatch && imgurMatch[1])
      imgurScreenshotUrlFromComments = imgurMatch[1];
  }

  return {
    prInfo: {
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
    },
    toolGenerationInfo: fetchedToolGenerationInfo,
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
      toolGenerationInfo: sourceToolGenerationInfo,
      githubActions,
      netlifyStatus,
      recentComments,
      imgurScreenshotUrl,
    } = summary;

    let statusSummary = 'Analyzing PR status...';
    let activeWorkflow: AutomatedActionsStatus['activeWorkflow'] = null;
    let nextExpectedAction: NextExpectedActionType = 'VPR_PENDING';
    let shouldContinuePolling = true;
    let uiHint: AutomatedActionsStatus['uiHint'] = 'loading';
    let overallCheckStatusForHead: PrStatusApiResponse['overallCheckStatusForHead'] =
      'unknown';
    let netlifyPreviewUrl: string | null = null;
    let netlifyDeploymentSucceeded = false;

    const currentToolGenContent = sourceToolGenerationInfo.content;
    const npmDepsFulfilledUI =
      sourceToolGenerationInfo.status === 'deleted'
        ? 'deleted'
        : (currentToolGenContent?.npmDependenciesFulfilled ?? 'absent');
    const lintFixesAttemptedUI =
      sourceToolGenerationInfo.status === 'deleted'
        ? 'deleted'
        : (currentToolGenContent?.lintFixesAttempted ?? false);

    const isVprFinalized =
      sourceToolGenerationInfo.status === 'deleted' &&
      prInfo.title != null &&
      !prInfo.title.includes('[skip netlify]');

    const latestVprRunForHead = githubActions.vpr.find(
      (run) => run.head_sha === prInfo.headSha
    );
    const latestAdmRunForHead = githubActions.adm.find(
      (run) => run.head_sha === prInfo.headSha
    );
    const latestAlfRunForHead = githubActions.alf.find(
      (run) => run.head_sha === prInfo.headSha
    );

    const toolNameForMsg =
      extractToolDirectiveFromBranchName(prInfo.branch) ||
      prInfo.branch ||
      `PR #${prInfo.number}`;

    if (prInfo.state === 'closed') {
      shouldContinuePolling = false;
      nextExpectedAction = 'NONE';
      if (prInfo.merged) {
        statusSummary = `PR #${prInfo.number} for '${toolNameForMsg}' was MERGED!`;
        uiHint = 'success';
        overallCheckStatusForHead = 'success';
      } else {
        statusSummary = `PR #${prInfo.number} for '${toolNameForMsg}' was CLOSED without merging.`;
        uiHint = 'info';
        const lastVprRun = githubActions.vpr[0];
        const vprConclusion = lastVprRun?.conclusion;
        if (vprConclusion === 'success') overallCheckStatusForHead = 'success';
        else if (
          vprConclusion === 'failure' ||
          vprConclusion === 'cancelled' ||
          vprConclusion === 'timed_out' ||
          vprConclusion === 'action_required'
        )
          overallCheckStatusForHead = 'failure';
        else if (vprConclusion === 'neutral')
          overallCheckStatusForHead = 'neutral';
        else overallCheckStatusForHead = 'unknown';
      }
      if (netlifyStatus?.deploy_url) {
        netlifyPreviewUrl = netlifyStatus.deploy_url;
        if (netlifyStatus.conclusion === 'success')
          netlifyDeploymentSucceeded = true;
      } else {
        const netlifyBotComment = recentComments.find(
          (c) => c.botType === 'Netlify' && c.body?.includes('Deploy Preview')
        );
        if (netlifyBotComment?.body) {
          const urlMatch = netlifyBotComment.body.match(
            /https:\/\/(deploy-preview-\d+--[a-zA-Z0-9-]+)\.netlify\.app/
          );
          if (urlMatch && urlMatch[0]) netlifyPreviewUrl = urlMatch[0];
        }
      }
      if (netlifyStatus?.conclusion === 'success')
        netlifyDeploymentSucceeded = true;
    } else {
      if (isVprFinalized) {
        overallCheckStatusForHead = 'pending';
        activeWorkflow = 'Netlify';

        if (netlifyStatus?.deploy_url) {
          const directiveForUrl = extractToolDirectiveFromBranchName(
            prInfo.branch
          );
          if (directiveForUrl)
            netlifyPreviewUrl = `${netlifyStatus.deploy_url}/tool/${directiveForUrl}/`;
          else netlifyPreviewUrl = netlifyStatus.deploy_url;
        }

        if (netlifyStatus?.conclusion === 'success') {
          netlifyDeploymentSucceeded = true;
          statusSummary = `Netlify Deploy Preview for '${toolNameForMsg}' is READY!`;
          nextExpectedAction = 'USER_REVIEW_PREVIEW';
          shouldContinuePolling = false;
          uiHint = 'success';
          overallCheckStatusForHead = 'success';
        } else if (
          netlifyStatus?.status === 'queued' ||
          netlifyStatus?.status === 'in_progress' ||
          !netlifyStatus
        ) {
          statusSummary = `VPR checks passed! Netlify Deploy Preview is ${netlifyStatus?.status || 'pending'} for '${toolNameForMsg}'.`;
          nextExpectedAction = 'NETLIFY_PREVIEW';
          uiHint = 'loading';
        } else if (
          netlifyStatus?.conclusion === 'failure' ||
          netlifyStatus?.conclusion === 'cancelled' ||
          netlifyStatus?.conclusion === 'action_required'
        ) {
          statusSummary = `VPR checks passed, but Netlify Deploy Preview FAILED/CANCELLED for '${toolNameForMsg}'. Manual review of Netlify logs needed.`;
          nextExpectedAction = 'MANUAL_REVIEW_NETLIFY';
          shouldContinuePolling = false;
          uiHint = 'error';
          overallCheckStatusForHead = 'failure';
        } else {
          statusSummary = `VPR checks passed. Netlify status: ${netlifyStatus?.status || 'unknown'}, conclusion: ${netlifyStatus?.conclusion || 'unknown'}.`;
          nextExpectedAction = 'NETLIFY_PREVIEW';
          uiHint = 'loading';
        }
      } else if (latestVprRunForHead) {
        activeWorkflow = 'VPR';
        const vprStatus = latestVprRunForHead.status;
        const vprConclusion = latestVprRunForHead.conclusion;

        if (vprStatus === 'completed') {
          overallCheckStatusForHead =
            vprConclusion === 'success'
              ? 'success'
              : vprConclusion === 'neutral'
                ? 'neutral'
                : 'failure';

          const vprCommentForThisRun = recentComments.find(
            (c) =>
              (c.botType === 'VPR' || c.botType === 'VPR_generic') &&
              c.workflow_run_id === latestVprRunForHead.id
          );

          if (vprConclusion === 'failure') {
            uiHint = 'loading';
            overallCheckStatusForHead = 'pending';

            if (
              vprCommentForThisRun?.body?.includes('NPM Dependencies Pending')
            ) {
              statusSummary = `VPR identified pending NPM dependencies. Expecting AI Dependency Manager (ADM).`;
              nextExpectedAction = 'ADM_EXPECTED';
            } else if (
              vprCommentForThisRun?.body?.includes('Build/Lint errors detected')
            ) {
              const currentLintFixesAttempted =
                sourceToolGenerationInfo.status === 'found' &&
                sourceToolGenerationInfo.content?.lintFixesAttempted === true;
              if (currentLintFixesAttempted) {
                statusSummary = `VPR Critical Failure: Lint/Build errors persist after ALF. Manual review required.`;
                nextExpectedAction = 'MANUAL_REVIEW_LINT';
                shouldContinuePolling = false;
                uiHint = 'error';
                overallCheckStatusForHead = 'failure';
              } else {
                statusSummary = `VPR detected lint/build issues. Expecting AI Lint Fixer (ALF).`;
                nextExpectedAction = 'ALF_EXPECTED';
              }
            } else if (
              vprCommentForThisRun?.body?.includes(
                'VPR Failed: Lint/Build errors persist after AI Lint Fixer'
              )
            ) {
              statusSummary = `VPR Critical Failure: Lint/Build errors persist after ALF. Manual review required.`;
              nextExpectedAction = 'MANUAL_REVIEW_LINT';
              shouldContinuePolling = false;
              uiHint = 'error';
              overallCheckStatusForHead = 'failure';
            } else if (
              vprCommentForThisRun?.body?.includes(
                'VPR Failed: Critical initial PR validations'
              )
            ) {
              statusSummary = `VPR Critical Failure: Initial validations failed. Manual review required.`;
              nextExpectedAction = 'MANUAL_REVIEW_VPR_CRITICAL';
              shouldContinuePolling = false;
              uiHint = 'error';
              overallCheckStatusForHead = 'failure';
            } else if (
              vprCommentForThisRun?.body?.includes(
                'VPR Failed: Build/Lint errors detected, but they could not be captured'
              )
            ) {
              statusSummary = `VPR Critical Failure: Unfixable build/lint errors. Manual review required.`;
              nextExpectedAction = 'MANUAL_REVIEW_VPR_CRITICAL';
              shouldContinuePolling = false;
              uiHint = 'error';
              overallCheckStatusForHead = 'failure';
            } else {
              statusSummary = `VPR workflow failed for commit ${prInfo.headSha.substring(0, 7)}. Check VPR comment or Action logs. Run ID: ${latestVprRunForHead.id}.`;
              nextExpectedAction = 'MANUAL_REVIEW_VPR_UNKNOWN';
              shouldContinuePolling = false;
              uiHint = 'error';
              overallCheckStatusForHead = 'failure';
            }
          } else if (vprConclusion === 'success') {
            statusSummary = `VPR checks passed for commit ${prInfo.headSha.substring(0, 7)}. Finalizing for Netlify preview...`;
            nextExpectedAction = 'VPR_FINALIZING';
            uiHint = 'loading';
          } else {
            statusSummary = `VPR workflow for commit ${prInfo.headSha.substring(0, 7)} completed with ${vprConclusion || 'unknown outcome'}.`;
            nextExpectedAction = 'MANUAL_REVIEW_VPR_OTHER';
            uiHint = 'warning';
            shouldContinuePolling = false;
            overallCheckStatusForHead =
              vprConclusion === 'neutral' ? 'neutral' : 'failure';
          }
        } else if (
          vprStatus === 'in_progress' ||
          vprStatus === 'queued' ||
          vprStatus === 'waiting' ||
          vprStatus === 'requested'
        ) {
          statusSummary = `VPR workflow is ${vprStatus} for commit ${prInfo.headSha.substring(0, 7)}...`;
          nextExpectedAction = 'VPR_RUNNING';
          uiHint = 'loading';
          overallCheckStatusForHead = 'pending';
        } else {
          statusSummary = `VPR workflow for commit ${prInfo.headSha.substring(0, 7)} has an unexpected status: ${vprStatus}.`;
          nextExpectedAction = 'MANUAL_REVIEW_VPR_OTHER';
          uiHint = 'warning';
          shouldContinuePolling = false;
          overallCheckStatusForHead = 'unknown';
        }
      } else if (
        latestAdmRunForHead &&
        (latestAdmRunForHead.status === 'in_progress' ||
          latestAdmRunForHead.status === 'queued')
      ) {
        statusSummary = `AI Dependency Manager (ADM) is ${latestAdmRunForHead.status} for commit ${latestAdmRunForHead.head_sha.substring(0, 7)}...`;
        activeWorkflow = 'ADM';
        nextExpectedAction = 'ADM_RUNNING';
        uiHint = 'loading';
        overallCheckStatusForHead = 'pending';
      } else if (
        latestAlfRunForHead &&
        (latestAlfRunForHead.status === 'in_progress' ||
          latestAlfRunForHead.status === 'queued')
      ) {
        statusSummary = `AI Lint Fixer (ALF) is ${latestAlfRunForHead.status} for commit ${latestAlfRunForHead.head_sha.substring(0, 7)}...`;
        activeWorkflow = 'ALF';
        nextExpectedAction = 'ALF_RUNNING';
        uiHint = 'loading';
        overallCheckStatusForHead = 'pending';
      } else {
        statusSummary = `Waiting for VPR checks to start for latest commit ${prInfo.headSha.substring(0, 7)}...`;
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
        'Max polling attempts reached. Please check PR on GitHub for latest status.';
      shouldContinuePolling = false;
      nextExpectedAction = 'MANUAL_REVIEW_TIMEOUT';
      uiHint = 'error';
    }

    const uiChecksJobs: WorkflowJob[] =
      latestVprRunForHead?.jobs || githubActions.vpr[0]?.jobs || [];
    const uiChecks: CiCheck[] = uiChecksJobs
      .map((j) => ({
        name: j.name,
        status: j.status,
        conclusion: j.conclusion,
        url: j.html_url,
        started_at: j.started_at,
        completed_at: j.completed_at,
      }))
      .concat(
        netlifyStatus
          ? [
              {
                name: `Netlify Deploy (${netlifyStatus.app_slug || 'site'})`,
                status: netlifyStatus.status,
                conclusion: netlifyStatus.conclusion,
                url:
                  netlifyStatus.deploy_url ||
                  netlifyStatus.check_runs?.[0]?.details_url ||
                  netlifyStatus.url,
                started_at: null,
                completed_at: null,
              },
            ]
          : []
      );

    const toolGenerationInfoForUI: PrStatusApiResponse['toolGenerationInfoForUI'] =
      {
        npmDependenciesFulfilled:
          npmDepsFulfilledUI as PrStatusApiResponse['toolGenerationInfoForUI']['npmDependenciesFulfilled'],
        lintFixesAttempted:
          lintFixesAttemptedUI as PrStatusApiResponse['toolGenerationInfoForUI']['lintFixesAttempted'],
        identifiedDependencies:
          currentToolGenContent?.identifiedDependencies?.map(
            (d) => d.packageName
          ) || null,
      };

    let lastBotCommentToDisplay: LastBotComment | null = null;
    const orderedBotTypesForDisplay: PrComment['botType'][] = [
      'VPR',
      'VPR_generic',
      'ADM',
      'ADM_generic',
      'ALF',
      'ALF_generic',
      'Netlify',
    ];

    if (latestVprRunForHead && latestVprRunForHead.status === 'completed') {
      const specificVprComment = recentComments.find(
        (c) =>
          (c.botType === 'VPR' || c.botType === 'VPR_generic') &&
          c.workflow_run_id === latestVprRunForHead.id
      );
      if (specificVprComment) {
        lastBotCommentToDisplay = {
          botName: specificVprComment.botType?.replace('_generic', '') || 'VPR',
          summary: specificVprComment.body
            .split('\n')[0]
            .replace(/^(##\s*🤖\s*|###\s*<span.*?>.*?<\/span>\s*)/, '')
            .substring(0, 120)
            .trim(),
          body: specificVprComment.body,
          timestamp: specificVprComment.created_at,
          url: specificVprComment.html_url,
          workflow_run_id: specificVprComment.workflow_run_id,
        };
      }
    }

    if (!lastBotCommentToDisplay) {
      for (const botType of orderedBotTypesForDisplay) {
        const comment = recentComments.find(
          (c) => c.botType === botType && c.body?.startsWith('## 🤖')
        );
        if (comment) {
          lastBotCommentToDisplay = {
            botName: comment.botType?.replace('_generic', '') || 'Bot',
            summary: comment.body
              .split('\n')[0]
              .replace(/^(##\s*🤖\s*|###\s*<span.*?>.*?<\/span>\s*)/, '')
              .substring(0, 120)
              .trim(),
            body: comment.body,
            timestamp: comment.created_at,
            url: comment.html_url,
            workflow_run_id: comment.workflow_run_id,
          };
          break;
        }
      }
    }
    if (
      !lastBotCommentToDisplay &&
      recentComments.find((c) => c.botType === 'Netlify')
    ) {
      const netlifyComment = recentComments.find(
        (c) => c.botType === 'Netlify'
      )!;
      lastBotCommentToDisplay = {
        botName: 'Netlify',
        summary: netlifyComment.body.split('\n')[0].substring(0, 100).trim(),
        body: netlifyComment.body,
        timestamp: netlifyComment.created_at,
        url: netlifyComment.html_url,
      };
    }

    const automatedActions: AutomatedActionsStatus = {
      statusSummary,
      activeWorkflow,
      nextExpectedAction,
      shouldContinuePolling,
      lastBotComment: lastBotCommentToDisplay,
      uiHint,
    };

    if (overallCheckStatusForHead === 'success' && isVprFinalized) {
      if (
        netlifyStatus?.status === 'in_progress' ||
        netlifyStatus?.status === 'queued' ||
        !netlifyStatus
      ) {
        overallCheckStatusForHead = 'pending';
      } else if (netlifyStatus?.conclusion !== 'success') {
        overallCheckStatusForHead = 'failure';
      }
    }

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
      toolGenerationInfoForUI,
      automatedActions,
      lastUpdated: new Date().toISOString(),
      _debug_data_source:
        process.env.NODE_ENV === 'development' ? summary : undefined,
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
    const errorAutomatedActions: AutomatedActionsStatus = {
      statusSummary: `Error fetching PR status: ${error.message.substring(0, 100)}`,
      activeWorkflow: null,
      nextExpectedAction: 'MANUAL_REVIEW_CI_ERROR',
      shouldContinuePolling: false,
      uiHint: 'error',
    };
    return NextResponse.json(
      {
        error: errorMessage,
        lastUpdated: new Date().toISOString(),
        automatedActions: errorAutomatedActions,
      } as Partial<PrStatusApiResponse>,
      { status: statusCode }
    );
  }
}
