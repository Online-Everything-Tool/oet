// app/api/recent-builds/route.ts

import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';

const GITHUB_REPO_OWNER =
  process.env.GITHUB_REPO_OWNER || 'Online-Everything-Tool';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'oet';

// Increase fetch limits to cast a wider net initially
const MAX_OPEN_PRS_TO_FETCH_CANDIDATES = 50;
const MAX_MERGED_PRS_TO_FETCH_CANDIDATES = 50;
const MAX_PRS_TO_RETURN = 10; // Keep the final display limit

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
  } catch (e: any) {
    console.error(
      `[api/recent-builds] Failed to get repo installation. Status: ${e?.status}`
    );
    throw new Error(
      `App installation not found for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}.`
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
  // Remove trailing timestamp like -1234567890
  const toolDirective = tempDirective.replace(/-[0-9]+$/, ''); 
  return toolDirective || null;
}

function isQualifyingToolPr(pr: { head?: { ref?: string }, title?: string }): boolean {
  if (!pr.head?.ref || !pr.title) return false;
  const toolDirective = extractToolDirectiveFromBranch(pr.head.ref);
  return !!toolDirective && pr.title.startsWith('feat: Add AI Generated Tool -');
}


export async function GET() {
  console.log(
    '[api/recent-builds] Received request to list recent build PRs.'
  );

  try {
    const octokit = await getAuthenticatedOctokit();
    const allQualifyingPrsMap = new Map<number, RecentBuildPrInfo>();

    // 1. Fetch recent OPEN tool PRs (sorted by creation date)
    console.log('[api/recent-builds] Fetching recent OPEN tool PRs...');
    const { data: openPrs } = await octokit.rest.pulls.list({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      state: 'open',
      sort: 'created', // Sort by creation time
      direction: 'desc',
      per_page: MAX_OPEN_PRS_TO_FETCH_CANDIDATES,
    });

    for (const pr of openPrs) {
      if (isQualifyingToolPr(pr)) {
        const toolDirective = extractToolDirectiveFromBranch(pr.head.ref); // Should not be null due to isQualifyingToolPr
        if (toolDirective && !allQualifyingPrsMap.has(pr.number)) {
           allQualifyingPrsMap.set(pr.number, {
            status: 'open',
            prNumber: pr.number,
            prUrl: pr.html_url,
            title: pr.title,
            toolDirective: toolDirective,
            branchName: pr.head.ref,
            createdAt: pr.created_at,
          });
        }
      }
    }
    console.log(`[api/recent-builds] Found ${allQualifyingPrsMap.size} initial open qualifying PRs.`);

    // 2. Fetch recent MERGED tool PRs (sorted by updated, which often correlates with merge time for PRs)
    // GitHub API doesn't directly sort closed PRs by 'merged_at'. 
    // We sort by 'updated' and then filter for merged ones.
    // If we still need more, we can fetch more pages of closed PRs.
    if (allQualifyingPrsMap.size < MAX_PRS_TO_RETURN) {
      console.log('[api/recent-builds] Fetching recent MERGED tool PRs...');
      const { data: closedPrs } = await octokit.rest.pulls.list({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
        state: 'closed', // Fetch closed PRs
        sort: 'updated',   // Sort by last update time
        direction: 'desc',
        per_page: MAX_MERGED_PRS_TO_FETCH_CANDIDATES,
      });

      for (const pr of closedPrs) {
        if (allQualifyingPrsMap.size >= MAX_PRS_TO_RETURN * 2) break; // Fetch a bit more to sort later, but not too many

        if (pr.merged_at && isQualifyingToolPr(pr)) {
          const toolDirective = extractToolDirectiveFromBranch(pr.head.ref);
          if (toolDirective && !allQualifyingPrsMap.has(pr.number)) {
            allQualifyingPrsMap.set(pr.number, {
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
      console.log(`[api/recent-builds] Total qualifying PRs after adding merged: ${allQualifyingPrsMap.size}.`);
    }
    
    // 3. Convert map to array and sort combined list
    // Prioritize open PRs by creation date (newest first), then merged PRs by merged date (newest first)
    const sortedPrs = Array.from(allQualifyingPrsMap.values()).sort((a, b) => {
      if (a.status === 'open' && b.status === 'merged') return -1; // Open PRs first
      if (a.status === 'merged' && b.status === 'open') return 1;

      if (a.status === 'open' && b.status === 'open') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // Newest open first
      }
      if (a.status === 'merged' && b.status === 'merged') {
        return new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime(); // Newest merged first
      }
      return 0;
    });

    const finalPrsToReturn = sortedPrs.slice(0, MAX_PRS_TO_RETURN);

    console.log(
      `[api/recent-builds] Final list contains ${finalPrsToReturn.length} PRs (returning up to ${MAX_PRS_TO_RETURN}).`
    );
    return NextResponse.json({ recentBuilds: finalPrsToReturn }, { status: 200 });

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