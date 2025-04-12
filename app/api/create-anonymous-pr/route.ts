// /app/api/create-anonymous-pr/route.ts

import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { createAppAuth } from '@octokit/auth-app';

// --- Configuration ---
const GITHUB_USER_OR_ORG = 'Online-Everything-Tool';
const GITHUB_REPO = 'oet';
const GITHUB_DEFAULT_BRANCH = 'main';
// --- End Configuration ---

// --- Load Environment Variables ---
const appId = process.env.GITHUB_APP_ID;
const privateKeyBase64 = process.env.GITHUB_PRIVATE_KEY_BASE64;

// --- Check for required variables at module load ---
if (!appId || !privateKeyBase64) {
    console.error("[API STARTUP] ERROR: GitHub App ID or Base64 Private Key is missing in environment variables.");
} else {
    console.log("[API STARTUP] Required GitHub App credentials appear loaded.");
}

// --- Type Guards for Error Handling ---

// REMOVED hasStatus as it wasn't used

// Checks if 'e' is an object with a string 'message' property
// Corrected: Check property existence before type
const hasMessage = (e: unknown): e is { message: string } =>
    typeof e === 'object' &&
    e !== null &&
    'message' in e && // Check if property exists
    typeof (e as { message: unknown }).message === 'string'; // Then check type

// Checks for properties typical of Octokit errors or Fetch errors
// Define the interface more explicitly
interface PotentialError {
    status?: unknown; // Use unknown initially
    message?: unknown;
    request?: { url?: string; method?: string };
    response?: { data?: { message?: string } };
    cause?: { message?: string };
}
// Corrected: Check property existence before asserting structure
const isPotentialErrorObject = (e: unknown): e is PotentialError =>
    typeof e === 'object' && e !== null; // Basic object check is often enough

// Helper function to get an authenticated Octokit instance for the installation
async function getInstallationOctokit(): Promise<Octokit> {
    console.log("[API] Attempting GitHub App installation authentication...");

    if (!appId || !privateKeyBase64) {
        console.error("[API ERROR] App ID or Base64 Private Key missing within getInstallationOctokit.");
        throw new Error("Server configuration error: GitHub App credentials missing.");
    }

    let privateKeyPem: string;
    try {
        privateKeyPem = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
        if (!privateKeyPem.startsWith('-----BEGIN') || !privateKeyPem.includes('PRIVATE KEY-----')) {
            throw new Error("Decoded key does not look like PEM format.");
        }
    } catch (decodeError: unknown) {
        console.error("[API ERROR] Critical error decoding Base64 private key:", decodeError);
        const message = hasMessage(decodeError) ? decodeError.message : String(decodeError);
        throw new Error(`Failed to decode Base64 private key from environment variable: ${message}`);
    }

    try {
        const appAuth = createAppAuth({ appId: appId, privateKey: privateKeyPem });
        const appOctokit = new Octokit({ authStrategy: createAppAuth, auth: { appId, privateKey: privateKeyPem } });

        const { data: installation } = await appOctokit.rest.apps.getRepoInstallation({ owner: GITHUB_USER_OR_ORG, repo: GITHUB_REPO });
        const installationId = installation.id;
        if (!installationId) { throw new Error(`GitHub App installation not found for ${GITHUB_USER_OR_ORG}/${GITHUB_REPO}`); }
        console.log(`[API] Found Installation ID: ${installationId}`);

        const { token } = await appAuth({ type: "installation", installationId: installationId });
        console.log("[API] Obtained installation access token.");

        const installationOctokit = new Octokit({ auth: token });
        console.log("[API] GitHub App installation authentication successful.");
        return installationOctokit;

    } catch (error: unknown) {
        console.error("[API ERROR] Failure during GitHub installation authentication steps:", error);
        let errorMessage = "An unknown error occurred during authentication.";
        let errorStatus = 500;

        if (isPotentialErrorObject(error)) { // Check if it's an object
             // Now safely check optional properties
            const status = typeof error.status === 'number' ? error.status : undefined;
            const message = typeof error.message === 'string' ? error.message : undefined;
            const causeMessage = typeof error.cause?.message === 'string' ? error.cause.message : undefined;

            if (status === 404) {
                 errorMessage = `GitHub App installation not found for repository ${GITHUB_USER_OR_ORG}/${GITHUB_REPO}. Ensure the app is correctly installed.`;
                 errorStatus = 404;
            } else if (message?.includes('keyData') || causeMessage?.includes('private key')) {
                 errorMessage = `Failed to parse private key. Check format and Base64 env var. Original error: ${message ?? 'Unknown key error'}`;
                 errorStatus = 500;
            } else {
                 errorMessage = message || errorMessage;
                 errorStatus = status || errorStatus;
            }
        } else {
            errorMessage = String(error); // Fallback for non-objects
        }

        const wrappedError = new Error(`Auth Failed: ${errorMessage}`);
        Object.assign(wrappedError, { status: errorStatus });
        throw wrappedError;
    }
}


// --- Main POST Handler ---
export async function POST(request: Request) {
    console.log(`[API] -------- POST /api/create-anonymous-pr Start (${new Date().toISOString()}) --------`);

    let toolName: string | undefined, toolDescription: string | undefined, toolUseCases: string | undefined;
    try {
        const body = await request.json();
        toolName = body.toolName?.trim();
        toolDescription = body.toolDescription?.trim();
        toolUseCases = body.toolUseCases?.trim() || 'N/A';
        if (!toolName || !toolDescription) {
            return NextResponse.json({ error: "Missing required fields: toolName and toolDescription" }, { status: 400 });
        }
        console.log(`[API] Processing suggestion for tool: ${toolName}`);
    } catch (error) {
        console.error("[API ERROR] Error parsing request body:", error);
        return NextResponse.json({ error: "Invalid request body format" }, { status: 400 });
    }

    let octokit: Octokit;
    let newBranchName: string | null = null;
    try {
        octokit = await getInstallationOctokit();

        const { data: branchData } = await octokit.rest.repos.getBranch({ owner: GITHUB_USER_OR_ORG, repo: GITHUB_REPO, branch: GITHUB_DEFAULT_BRANCH });
        const latestSha = branchData.commit.sha;
        console.log(`[API] Fetched latest SHA for ${GITHUB_DEFAULT_BRANCH}: ${latestSha}`);

        const timestamp = Date.now();
        const sanitizedToolName = toolName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 30);
        newBranchName = `feat/suggest-${sanitizedToolName}-${timestamp}`;
        const newBranchRef = `refs/heads/${newBranchName}`;
        console.log(`[API] Creating branch: ${newBranchName}...`);
        await octokit.rest.git.createRef({ owner: GITHUB_USER_OR_ORG, repo: GITHUB_REPO, ref: newBranchRef, sha: latestSha });
        console.log(`[API] Branch ${newBranchName} created.`);

        const filePath = `tool-suggestions/${newBranchName.replace('refs/heads/', '').replace('/', '-')}.md`;
        const fileContent = `---
Tool Name: ${toolName}
Suggested By: OET Anonymous User via API
Date: ${new Date().toISOString()}
---
## Description
${toolDescription}
## Use Cases / Examples
${toolUseCases}`;
        const encodedContent = Buffer.from(fileContent).toString('base64');

        const commitMessage = `feat: Suggest tool - ${toolName}`;
        console.log(`[API] Committing file "${filePath}" to branch ${newBranchName}...`);
        const { data: commitData } = await octokit.rest.repos.createOrUpdateFileContents({
            owner: GITHUB_USER_OR_ORG, repo: GITHUB_REPO, path: filePath,
            message: commitMessage, content: encodedContent, branch: newBranchName,
            committer: { name: 'OET Suggestion Bot', email: 'bot@online-everything-tool.com' },
            author: { name: 'OET Suggestion Bot', email: 'bot@online-everything-tool.com' },
        });
        console.log(`[API] File committed. Commit SHA: ${commitData.commit.sha}`);

        const prTitle = `Tool Suggestion: ${toolName}`;
        const prBody = `New tool suggestion submitted via OET (anonymously).
**Tool Name:** ${toolName}
**Description:**\n${toolDescription}\n
**Use Cases / Examples:**\n${toolUseCases}\n
*Please review.*`;
        console.log(`[API] Creating Pull Request: "${prTitle}"...`);
        const { data: pullRequest } = await octokit.rest.pulls.create({
            owner: GITHUB_USER_OR_ORG, repo: GITHUB_REPO, title: prTitle, body: prBody,
            head: newBranchName, base: GITHUB_DEFAULT_BRANCH, maintainer_can_modify: true,
        });
        console.log(`[API SUCCESS] Pull Request created: ${pullRequest.html_url}`);

        return NextResponse.json({ success: true, message: "Tool suggestion submitted successfully!", url: pullRequest.html_url }, { status: 201 });

    } catch (error: unknown) {
        console.error("[API ERROR] Failure during API processing:", error);
        let errorMessage = "An unexpected error occurred.";
        let errorStatus = 500;

        if (isPotentialErrorObject(error)) { // Use the simpler type guard
             const status = typeof error.status === 'number' ? error.status : undefined;
             const message = typeof error.message === 'string' ? error.message : undefined;
             const responseDataMessage = typeof error.response?.data?.message === 'string' ? error.response.data.message : undefined;
             const requestUrl = typeof error.request?.url === 'string' ? error.request.url : undefined;
             const requestMethod = typeof error.request?.method === 'string' ? error.request.method : undefined;

             errorMessage = message || errorMessage;
             errorStatus = status || errorStatus;

             let detailedError = `Failed to process suggestion PR: ${errorMessage}`;
             if (responseDataMessage) {
                 detailedError += ` (GitHub API Error: ${responseDataMessage})`;
             } else if (requestUrl && requestMethod) {
                 detailedError += ` (API Request Failed: ${requestMethod} ${requestUrl})`;
             }
             console.error(`[API FAILURE] Responding with status ${errorStatus}: ${detailedError}`);
             return NextResponse.json( { error: detailedError }, { status: errorStatus } );
        } else {
             errorMessage = String(error);
             console.error(`[API FAILURE] Responding with status ${errorStatus}: Failed to process suggestion PR: ${errorMessage}`);
             return NextResponse.json( { error: `Failed to process suggestion PR: ${errorMessage}` }, { status: errorStatus } );
        }
    } finally {
         console.log(`[API] -------- POST /api/create-anonymous-pr End (${new Date().toISOString()}) --------`);
    }
}

// --- GET Handler ---
export async function GET() {
    console.log(`[API] -------- GET /api/create-anonymous-pr (${new Date().toISOString()}) --------`);
    if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_PRIVATE_KEY_BASE64) {
         return NextResponse.json({ message: "API route is active, but server config is missing credentials." });
    }
    return NextResponse.json({ message: "API route for create-anonymous-pr is active. Use POST method to submit suggestions." });
}