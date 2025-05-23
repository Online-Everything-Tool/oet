// app/api/recent-builds/route.ts

import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';

const GITHUB_REPO_OWNER =
  process.env.GITHUB_REPO_OWNER || 'Online-Everything-Tool';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'oet';
const MAX_PRS_TO_FETCH = 30;
const MAX_PRS_TO_RETURN = 10;
const appId = process.env.GITHUB_APP_ID;
const privateKeyBase64 = process.env.GITHUB_PRIVATE_KEY_BASE64;

let octokitInstance: Octokit | undefined;

async function getAuthenticatedOctokit(): Promise<Octokit> {
  if (octokitInstance) return octokitInstance;

  if (!appId || !privateKeyBase64) {
    console.error(
      '[api/recent-builds] GitHub App credentials missing on server.'
    );
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
      `[api/recent-builds] Failed to get repo installation for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}. Status: ${e?.status}`
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
  console.log('[api/recent-builds] GitHub App authentication successful.');
  return octokitInstance;
}

interface BaseRecentBuildPr {
  prNumber: number;
  prUrl: string;
  title: string;
  toolDirective: string;
  branchName: string;
}
interface OpenRecentBuildPr extends BaseRecentBuildPr {
  status: 'open';
  createdAt: string;
}
interface MergedRecentBuildPr extends BaseRecentBuildPr {
  status: 'merged';
  mergedAt: string;
}
type RecentBuildPrInfo = OpenRecentBuildPr | MergedRecentBuildPr;

function extractToolDirectiveFromBranch(branchName: string): string | null {
  if (!branchName.startsWith('feat/gen-')) {
    return null;
  }
  const tempDirective = branchName.substring('feat/gen-'.length);
  const toolDirective = tempDirective.replace(/-[0-9]*$/, '');
  return toolDirective || null;
}

export async function GET() {
  console.log(
    '[api/recent-builds] Received request to list recent open/merged build PRs.'
  );

  try {
    const octokit = await getAuthenticatedOctokit();

    const { data: allRecentPrs } = await octokit.rest.pulls.list({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: MAX_PRS_TO_FETCH,
    });

    const qualifyingPrs: RecentBuildPrInfo[] = [];

    for (const pr of allRecentPrs) {
      if (qualifyingPrs.length >= MAX_PRS_TO_RETURN) {
        break;
      }

      const toolDirective = extractToolDirectiveFromBranch(pr.head.ref);

      if (
        toolDirective &&
        pr.title.startsWith('feat: Add AI Generated Tool -')
      ) {
        if (pr.state === 'open') {
          qualifyingPrs.push({
            status: 'open',
            prNumber: pr.number,
            prUrl: pr.html_url,
            title: pr.title,
            toolDirective: toolDirective,
            branchName: pr.head.ref,
            createdAt: pr.created_at,
          });
        } else if (pr.state === 'closed' && pr.merged_at) {
          qualifyingPrs.push({
            status: 'merged',
            prNumber: pr.number,
            prUrl: pr.html_url,
            title: pr.title,
            toolDirective: toolDirective,
            branchName: pr.head.ref,
            mergedAt: pr.merged_at,
          });
        }
      }
    }

    console.log(
      `[api/recent-builds] Found ${qualifyingPrs.length} qualifying open/merged build PRs (returning up to ${MAX_PRS_TO_RETURN}).`
    );
    return NextResponse.json({ recentBuilds: qualifyingPrs }, { status: 200 });
  } catch (error: unknown) {
    console.error(
      '[api/recent-builds] Error fetching recent build PRs:',
      error
    );
    let errorMessage = 'Failed to fetch recent build PRs.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { error: errorMessage, recentBuilds: [] },
      { status: 500 }
    );
  }
}
