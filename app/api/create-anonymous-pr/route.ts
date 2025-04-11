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


// Helper function to get an authenticated Octokit instance for the installation
async function getInstallationOctokit(): Promise<Octokit> {
    console.log("[API] Attempting GitHub App installation authentication..."); // Log start

    if (!appId || !privateKeyBase64) {
        console.error("[API ERROR] App ID or Base64 Private Key missing within getInstallationOctokit.");
        throw new Error("Server configuration error: GitHub App credentials missing.");
    }

    // --- Decode Base64 Key ---
    let privateKeyPem: string;
    try {
        privateKeyPem = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
        if (!privateKeyPem.startsWith('-----BEGIN')) {
            console.error("[API ERROR] Decoded key does not appear to be in PEM format.");
            throw new Error("Decoded key does not look like PEM format.");
        }
    } catch (decodeError: any) {
        console.error("[API ERROR] Critical error decoding Base64 private key:", decodeError);
        throw new Error(`Failed to decode Base64 private key from environment variable: ${decodeError.message}`);
    }

    // --- Authenticate and Get Token ---
    try {
        const appAuth = createAppAuth({
            appId: appId,
            privateKey: privateKeyPem,
        });

        const appOctokit = new Octokit({ authStrategy: createAppAuth, auth: { appId, privateKey: privateKeyPem } });

        // Get Installation ID
        const { data: installation } = await appOctokit.rest.apps.getRepoInstallation({
            owner: GITHUB_USER_OR_ORG,
            repo: GITHUB_REPO,
        });
        const installationId = installation.id;
        if (!installationId) {
            console.error(`[API ERROR] GitHub App installation ID not found for ${GITHUB_USER_OR_ORG}/${GITHUB_REPO}.`);
            throw new Error(`GitHub App installation not found for ${GITHUB_USER_OR_ORG}/${GITHUB_REPO}`);
        }
        console.log(`[API] Found Installation ID: ${installationId}`); // Log the ID, it's useful

        // Get Installation Token
        const { token } = await appAuth({
            type: "installation",
            installationId: installationId,
        });
        console.log("[API] Obtained installation access token."); // Confirm token was obtained

        // Return Installation-Authenticated Octokit
        const installationOctokit = new Octokit({ auth: token });
        console.log("[API] GitHub App installation authentication successful."); // Log overall success
        return installationOctokit;

    } catch (error: any) {
        console.error("[API ERROR] Error during GitHub installation authentication steps:", error);
        if (error.status === 404) {
             throw new Error(`GitHub App installation not found for repository ${GITHUB_USER_OR_ORG}/${GITHUB_REPO}. Ensure the app is correctly installed.`);
        }
        if (error.message?.includes('keyData') || error.cause?.message?.includes('private key')) {
            throw new Error(`Failed to parse private key. Check format and Base64 env var. Original error: ${error.message}`);
        }
        throw new Error(`Failed to authenticate GitHub App installation: ${error.message || 'Unknown authentication error'}`);
    }
}


// --- Main POST Handler ---
export async function POST(request: Request) {
    console.log(`[API] -------- POST /api/create-anonymous-pr Start (${new Date().toISOString()}) --------`);

    // 1. Parse Request Body
    let toolName: string | undefined;
    let toolDescription: string | undefined;
    let toolUseCases: string | undefined;
    try {
        const body = await request.json();
        toolName = body.toolName?.trim();
        toolDescription = body.toolDescription?.trim();
        toolUseCases = body.toolUseCases?.trim() || 'N/A';

        if (!toolName || !toolDescription) {
            console.warn("[API WARN] Request missing toolName or toolDescription.");
            return NextResponse.json({ error: "Missing required fields: toolName and toolDescription" }, { status: 400 });
        }
         console.log(`[API] Processing suggestion for tool: ${toolName}`);
    } catch (error) {
        console.error("[API ERROR] Error parsing request body:", error);
        return NextResponse.json({ error: "Invalid request body format" }, { status: 400 });
    }

    // --- GitHub API Operations ---
    let octokit: Octokit;
    let newBranchName: string | null = null; // Keep track of branch name for potential cleanup
    try {
        // 2. Get Installation Octokit
        octokit = await getInstallationOctokit();

        // 3. Get Latest Commit SHA
        const { data: branchData } = await octokit.rest.repos.getBranch({
            owner: GITHUB_USER_OR_ORG,
            repo: GITHUB_REPO,
            branch: GITHUB_DEFAULT_BRANCH,
        });
        const latestSha = branchData.commit.sha;
        console.log(`[API] Fetched latest SHA for ${GITHUB_DEFAULT_BRANCH}: ${latestSha}`);

        // 4. Create Branch
        const timestamp = Date.now();
        const sanitizedToolName = toolName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 30);
        newBranchName = `feat/suggest-${sanitizedToolName}-${timestamp}`; // Assign here
        const newBranchRef = `refs/heads/${newBranchName}`;
        console.log(`[API] Creating branch: ${newBranchName}...`);
        await octokit.rest.git.createRef({
            owner: GITHUB_USER_OR_ORG,
            repo: GITHUB_REPO,
            ref: newBranchRef,
            sha: latestSha,
        });
        console.log(`[API] Branch ${newBranchName} created.`);

        // 5. Prepare File Content
        const filePath = `tool-suggestions/${newBranchName.replace('refs/heads/', '').replace('/', '-')}.md`;
        const fileContent = `---
Tool Name: ${toolName}
Suggested By: OET Anonymous User via API
Date: ${new Date().toISOString()}
---

## Description

${toolDescription}

## Use Cases / Examples

${toolUseCases}
`;
        const encodedContent = Buffer.from(fileContent).toString('base64');

        // 6. Commit File
        const commitMessage = `feat: Suggest tool - ${toolName}`;
        console.log(`[API] Committing file "${filePath}" to branch ${newBranchName}...`);
        const { data: commitData } = await octokit.rest.repos.createOrUpdateFileContents({
            owner: GITHUB_USER_OR_ORG,
            repo: GITHUB_REPO,
            path: filePath,
            message: commitMessage,
            content: encodedContent,
            branch: newBranchName,
            committer: { name: 'OET Suggestion Bot', email: 'bot@online-everything-tool.com' },
            author: { name: 'OET Suggestion Bot', email: 'bot@online-everything-tool.com' },
        });
        console.log(`[API] File committed. Commit SHA: ${commitData.commit.sha}`);

        // 7. Create Pull Request
        const prTitle = `Tool Suggestion: ${toolName}`;
        const prBody = `New tool suggestion submitted via the OET website (anonymously).

**Tool Name:** ${toolName}

**Description:**
${toolDescription}

**Use Cases / Examples:**
${toolUseCases}

*Please review and discuss this suggestion.*`;
        console.log(`[API] Creating Pull Request: "${prTitle}"...`);
        const { data: pullRequest } = await octokit.rest.pulls.create({
            owner: GITHUB_USER_OR_ORG,
            repo: GITHUB_REPO,
            title: prTitle,
            body: prBody,
            head: newBranchName,
            base: GITHUB_DEFAULT_BRANCH,
            maintainer_can_modify: true,
        });
        console.log(`[API SUCCESS] Pull Request created: ${pullRequest.html_url}`);

        // 8. Return Success Response
        return NextResponse.json(
            { success: true, message: "Tool suggestion submitted successfully as a Pull Request!", url: pullRequest.html_url },
            { status: 201 }
        );

    } catch (error: any) {
        console.error("[API ERROR] Failure during GitHub operations:", error);
        const errorMessage = error.message || "An unexpected error occurred.";
        const errorStatus = error.status || 500;
        let detailedError = `Failed to process suggestion PR: ${errorMessage}`;
        if (error.response?.data?.message) {
             detailedError += ` (GitHub API Error: ${error.response.data.message})`;
        } else if (error.request?.url) {
            detailedError += ` (API Request: ${error.request.method} ${error.request.url})`;
        }
        // Note: Branch cleanup on failure is complex and omitted here for simplicity.
        // It would involve checking which step failed and potentially calling deleteRef.
        console.error(`[API FAILURE] Responding with status ${errorStatus}: ${detailedError}`);
        return NextResponse.json( { error: detailedError }, { status: errorStatus } );
    } finally {
         console.log(`[API] -------- POST /api/create-anonymous-pr End (${new Date().toISOString()}) --------`);
    }
}

// --- GET Handler ---
export async function GET() {
    console.log(`[API] -------- GET /api/create-anonymous-pr (${new Date().toISOString()}) --------`);
    if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_PRIVATE_KEY_BASE64) {
         return NextResponse.json({ message: "API route is active, but server config is missing." });
    }
    return NextResponse.json({ message: "API route for create-anonymous-pr is active. Use POST method to submit suggestions." });
}