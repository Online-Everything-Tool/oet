// FILE: app/api/pr-comments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';

const GITHUB_REPO_OWNER =
  process.env.GITHUB_REPO_OWNER || 'Online-Everything-Tool';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'oet';
const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_PRIVATE_KEY_BASE64 = process.env.GITHUB_PRIVATE_KEY_BASE64;

interface AuthenticatedOctokitInfo {
  octokit: Octokit;
  appUserLogin: string | null;
}

async function getAuthenticatedOctokit(): Promise<AuthenticatedOctokitInfo> {
  console.log('[API /pr-comments] Auth: Entering getAuthenticatedOctokit...');

  if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY_BASE64) {
    const errMsg =
      '[API /pr-comments] Auth Error: GITHUB_APP_ID or GITHUB_PRIVATE_KEY_BASE64 is missing or empty in process.env.';
    console.error(errMsg);
    console.error(`  GITHUB_APP_ID is set: ${!!GITHUB_APP_ID}`);
    console.error(
      `  GITHUB_PRIVATE_KEY_BASE64 is set: ${!!GITHUB_PRIVATE_KEY_BASE64}`
    );
    throw new Error(
      'Server configuration error: GitHub App credentials missing.'
    );
  }
  console.log(
    `[API /pr-comments] Auth: GITHUB_APP_ID found: ${String(GITHUB_APP_ID).substring(0, 5)}...`
  );

  let privateKeyPemFormatted: string;
  try {
    privateKeyPemFormatted = Buffer.from(
      GITHUB_PRIVATE_KEY_BASE64,
      'base64'
    ).toString('utf-8');

    if (
      !privateKeyPemFormatted ||
      !privateKeyPemFormatted.startsWith('-----BEGIN')
    ) {
      console.error(
        '[API /pr-comments] Auth Error: Decoded private key does not appear to be in valid PEM format or is empty after Base64 decode.'
      );
      throw new Error(
        'Decoded private key is invalid. Ensure it starts with -----BEGIN PRIVATE KEY----- or similar after Base64 decoding.'
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (bufferError: any) {
    console.error(
      '[API /pr-comments] Auth Error: Error decoding GITHUB_PRIVATE_KEY_BASE64 from Base64 to UTF-8 string:',
      bufferError.message
    );
    throw new Error(
      `Failed to decode private key from Base64: ${bufferError.message}`
    );
  }

  try {
    console.log(
      '[API /pr-comments] Auth: Calling createAppAuth with App ID and decoded Private Key...'
    );
    const appAuth = createAppAuth({
      appId: GITHUB_APP_ID,
      privateKey: privateKeyPemFormatted,
    });
    console.log('[API /pr-comments] Auth: createAppAuth call successful.');

    const appOctokitInternal = new Octokit({
      authStrategy: createAppAuth,
      auth: { appId: GITHUB_APP_ID, privateKey: privateKeyPemFormatted },
    });

    let appUserLogin: string | null = null;
    try {
      console.log(
        '[API /pr-comments] Auth: Fetching authenticated GitHub App details...'
      );
      const { data: appDetails } =
        await appOctokitInternal.rest.apps.getAuthenticated();
      if (appDetails) {
        appUserLogin = appDetails.slug
          ? `${appDetails.slug}[bot]`
          : appDetails.name.toLowerCase().replace(/\s+/g, '-') + '[bot]';
        console.log(
          `[API /pr-comments] Auth: Authenticated app user login determined as: ${appUserLogin}`
        );
      } else {
        console.warn(
          `[API /pr-comments] Auth: Could not retrieve authenticated app details to identify app's own login.`
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (appDetailsError: any) {
      console.warn(
        `[API /pr-comments] Auth: Error fetching GitHub App details: ${appDetailsError.message}. App comment identification might be affected.`
      );
    }

    console.log(
      `[API /pr-comments] Auth: Fetching installation ID for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}...`
    );
    const { data: installation } =
      await appOctokitInternal.rest.apps.getRepoInstallation({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
      });

    if (!installation || !installation.id) {
      console.error(
        `[API /pr-comments] Auth Error: App installation not found for repository ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}. Ensure the GitHub App is installed and has access to this repository.`
      );
      throw new Error(
        `App installation not found for ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}.`
      );
    }
    console.log(
      `[API /pr-comments] Auth: Installation ID found: ${installation.id}`
    );

    console.log(
      `[API /pr-comments] Auth: Authenticating as installation ID ${installation.id} to get a short-lived token...`
    );
    const { token } = await appAuth({
      type: 'installation',
      installationId: installation.id,
    });

    const installationOctokit = new Octokit({ auth: token });
    console.log(
      '[API /pr-comments] Auth: GitHub App installation token obtained and Octokit instance created successfully for this request.'
    );
    return { octokit: installationOctokit, appUserLogin };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error(
      '[API /pr-comments] Auth Error during Octokit setup or token generation:',
      error.message
    );
    if (error.status) console.error(`  Status: ${error.status}`);
    if (error.request?.url)
      console.error(`  Request URL: ${error.request.url}`);
    if (error.response?.data?.message)
      console.error(
        `  GitHub API Error Detail: ${error.response.data.message}`
      );
    const ghMessage = error.response?.data?.message;
    const errorMessage = ghMessage
      ? `GitHub API Error: ${ghMessage}`
      : error.message;
    throw new Error(`GitHub App Authentication failed: ${errorMessage}`);
  }
}

export interface PrCommentAuthor {
  login: string;
  avatarUrl: string;
  isBot: boolean;
  isOetAppCommenter?: boolean;
}

export interface PrCommentData {
  id: number;
  author: PrCommentAuthor | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  isOetFormattedFeedback?: boolean;
  feedbackEmoji?: string;
  feedbackText?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const prNumberStr = searchParams.get('prNumber');

  if (!prNumberStr) {
    return NextResponse.json(
      { error: 'Missing prNumber query parameter' },
      { status: 400 }
    );
  }
  const prNumber = parseInt(prNumberStr, 10);
  if (isNaN(prNumber) || prNumber <= 0) {
    return NextResponse.json({ error: 'Invalid prNumber' }, { status: 400 });
  }
  console.log(`[API /pr-comments GET PR#${prNumber}] Received request.`);

  try {
    const { octokit, appUserLogin } = await getAuthenticatedOctokit();

    if (appUserLogin) {
      console.log(
        `[API /pr-comments GET PR#${prNumber}] Using app user login for comment processing: ${appUserLogin}`
      );
    } else {
      console.warn(
        `[API /pr-comments GET PR#${prNumber}] App user login not determined. Identification of app's own comments might be affected if it relies on this specifically.`
      );
    }

    console.log(`[API /pr-comments GET PR#${prNumber}] Fetching comments...`);
    const { data: comments } = await octokit.rest.issues.listComments({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      issue_number: prNumber,
      per_page: 100,
      sort: 'created',
      direction: 'asc',
    });
    console.log(
      `[API /pr-comments GET PR#${prNumber}] Fetched ${comments.length} raw comments.`
    );

    const allMappedComments: PrCommentData[] = comments.map((comment) => {
      let isOetFormattedFeedback = false;
      let feedbackEmoji: string | undefined = undefined;
      let feedbackText: string | undefined = undefined;
      let isOetAppCommenter = false;

      const commenterLogin = comment.user?.login?.toLowerCase();

      if (
        appUserLogin &&
        commenterLogin &&
        commenterLogin === appUserLogin.toLowerCase()
      ) {
        isOetAppCommenter = true;
      }

      const feedbackMatch = comment.body?.match(
        /^User Feedback:\s*(\S+)\s*\n\n([\s\S]*)/m
      );
      if (feedbackMatch && feedbackMatch[1] && feedbackMatch[2]) {
        isOetFormattedFeedback = true;
        feedbackEmoji = feedbackMatch[1];
        feedbackText = feedbackMatch[2];
      }

      return {
        id: comment.id,
        author: comment.user
          ? {
              login: comment.user.login,
              avatarUrl: comment.user.avatar_url,
              isBot: comment.user.type === 'Bot',
              isOetAppCommenter: isOetAppCommenter,
            }
          : null,
        body: comment.body || '',
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        htmlUrl: comment.html_url,
        isOetFormattedFeedback,
        feedbackEmoji,
        feedbackText,
      };
    });

    const feedbackCommentsOnly = allMappedComments.filter(
      (c) => c.isOetFormattedFeedback
    );

    console.log(
      `[API /pr-comments GET PR#${prNumber}] Mapped ${allMappedComments.length} comments, filtered to ${feedbackCommentsOnly.length} feedback-formatted comments.`
    );

    return NextResponse.json(
      { comments: feedbackCommentsOnly },
      { status: 200 }
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error(
      `[API /pr-comments GET PR#${prNumber}] Error in handler:`,
      error.message
    );
    if (error.response?.data) {
      console.error(
        `[API /pr-comments GET PR#${prNumber}] GitHub API Error Details:`,
        error.response.data
      );
    }
    const errorMessage =
      error.response?.data?.message ||
      error.message ||
      'Failed to fetch comments.';
    const status = error.status || 500;
    return NextResponse.json({ error: errorMessage }, { status });
  }
}

interface PostCommentRequestBody {
  prNumber: number;
  emoji: string;
  commentText: string;
}

export async function POST(request: NextRequest) {
  let body: PostCommentRequestBody;
  try {
    body = await request.json();
    if (
      !body.prNumber ||
      typeof body.prNumber !== 'number' ||
      body.prNumber <= 0
    ) {
      throw new Error("Missing or invalid 'prNumber'");
    }
    if (typeof body.emoji !== 'string') {
      throw new Error("Missing 'emoji'");
    }
    if (typeof body.commentText !== 'string' || !body.commentText.trim()) {
      throw new Error("Missing or empty 'commentText'");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return NextResponse.json(
      { error: `Invalid request body: ${e.message}` },
      { status: 400 }
    );
  }

  const { prNumber, emoji, commentText } = body;
  const formattedCommentBody = `User Feedback: ${emoji || '💬'} \n\n${commentText.trim()}`;
  console.log(
    `[API /pr-comments POST PR#${prNumber}] Attempting to post comment. Body preview: "${formattedCommentBody.substring(0, 50)}..."`
  );

  try {
    const { octokit, appUserLogin } = await getAuthenticatedOctokit();

    if (appUserLogin) {
      console.log(
        `[API /pr-comments POST PR#${prNumber}] Using app user login for comment processing: ${appUserLogin}`
      );
    } else {
      console.warn(
        `[API /pr-comments POST PR#${prNumber}] App user login not determined for comment posting. This might affect comment author attribution if it were needed.`
      );
    }

    console.log(
      `[API /pr-comments POST PR#${prNumber}] Posting comment to GitHub...`
    );
    const { data: newComment } = await octokit.rest.issues.createComment({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      issue_number: prNumber,
      body: formattedCommentBody,
    });
    console.log(
      `[API /pr-comments POST PR#${prNumber}] Comment posted successfully. ID: ${newComment.id}`
    );

    let newCommentIsFromOetApp = false;
    if (appUserLogin && newComment.user) {
      newCommentIsFromOetApp =
        newComment.user.login.toLowerCase() === appUserLogin.toLowerCase();
    }

    const responseComment: PrCommentData = {
      id: newComment.id,
      author: newComment.user
        ? {
            login: newComment.user.login,
            avatarUrl: newComment.user.avatar_url,
            isBot: newComment.user.type === 'Bot',
            isOetAppCommenter: newCommentIsFromOetApp,
          }
        : null,
      body: newComment.body || '',
      createdAt: newComment.created_at,
      updatedAt: newComment.updated_at,
      htmlUrl: newComment.html_url,
      isOetFormattedFeedback: true,
      feedbackEmoji: emoji || '💬',
      feedbackText: commentText.trim(),
    };

    return NextResponse.json(
      { message: 'Comment posted successfully', comment: responseComment },
      { status: 201 }
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error(
      `[API /pr-comments POST PR#${prNumber}] Error posting comment:`,
      error.message
    );
    if (error.response?.data) {
      console.error(
        `[API /pr-comments POST PR#${prNumber}] GitHub API Error Details:`,
        error.response.data
      );
    }
    const errMsg =
      error.response?.data?.message ||
      error.message ||
      'Failed to post comment';
    const status = error.status || 500;
    return NextResponse.json(
      { error: `Failed to post comment: ${errMsg}` },
      { status }
    );
  }
}
