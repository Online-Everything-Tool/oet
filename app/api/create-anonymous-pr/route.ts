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
if (!appId || !privateKeyBase64) console.error("[API STARTUP create-anonymous-pr] ERROR: GitHub App credentials missing.");
else console.log("[API STARTUP create-anonymous-pr] Required GitHub App credentials loaded.");
// --- End Load Environment Variables ---

// --- Type Guards ---
const hasMessage = (e: unknown): e is { message: string } => typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string';
const isPotentialErrorObject = (e: unknown): e is { status?: unknown; message?: unknown; response?: { data?: { message?: string } } } => typeof e === 'object' && e !== null;
// --- End Type Guards ---

// --- Helper: Get Authenticated Octokit Instance ---
async function getInstallationOctokit(): Promise<Octokit> {
    console.log("[API create-anonymous-pr] Attempting GitHub App auth...");
    if (!appId || !privateKeyBase64) throw new Error("Server config error: GitHub App credentials missing.");
    let privateKeyPem: string;
    try {
        privateKeyPem = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
        if (!privateKeyPem.startsWith('-----BEGIN')) throw new Error("Decoded key format invalid.");
    } catch (decodeError: unknown) { const m=hasMessage(decodeError)?decodeError.message:String(decodeError); throw new Error(`Decode Error: ${m}`); }
    try {
        const appAuth = createAppAuth({ appId, privateKey: privateKeyPem });
        const appOctokit = new Octokit({ authStrategy: createAppAuth, auth: { appId, privateKey: privateKeyPem } });
        const { data: inst } = await appOctokit.rest.apps.getRepoInstallation({ owner: GITHUB_USER_OR_ORG, repo: GITHUB_REPO });
        if (!inst.id) throw new Error(`App install not found for ${GITHUB_USER_OR_ORG}/${GITHUB_REPO}`);
        const { token } = await appAuth({ type: "installation", installationId: inst.id });
        const installationOctokit = new Octokit({ auth: token });
        console.log("[API create-anonymous-pr] GitHub App auth successful.");
        return installationOctokit;
    } catch (error: unknown) {
        console.error("[API create-anonymous-pr] Auth failure:", error);
        let errorMessage = "Unknown auth error."; let errorStatus = 500;
        if (isPotentialErrorObject(error)) { const status = typeof error.status === 'number' ? error.status : undefined; const message = typeof error.message === 'string' ? error.message : undefined; if (status === 404) errorMessage = `GitHub App install not found for ${GITHUB_USER_OR_ORG}/${GITHUB_REPO}.`; else if (message?.includes('keyData') || error.cause?.message?.includes('private key')) errorMessage = `Private key parse failed. Check env var.`; else errorMessage = message || errorMessage; errorStatus = status || errorStatus; } else { errorMessage = String(error); }
        const wrappedError = new Error(`Auth Failed: ${errorMessage}`); Object.assign(wrappedError, { status: errorStatus }); throw wrappedError;
    }
}
// --- End Helper ---

// --- Main POST Handler ---
export async function POST(request: Request) {
    console.log(`[API create-anonymous-pr] -------- POST Start (${new Date().toISOString()}) --------`);

    // 1. Parse Correct Request Body
    let toolDirective: string | undefined;
    let generatedPageTsx: string | undefined;
    let generativeDescription: string | undefined;
    let additionalDescription: string | undefined;
    let generativeRequestedDirectives: string[] = [];

    try {
        const body = await request.json();
        toolDirective = body.toolDirective?.trim();
        generatedPageTsx = body.generatedPageTsx?.trim();
        generativeDescription = body.generativeDescription?.trim();
        additionalDescription = body.additionalDescription?.trim() || '';
        if (Array.isArray(body.generativeRequestedDirectives)) {
            generativeRequestedDirectives = body.generativeRequestedDirectives.filter((d: unknown) => typeof d === 'string');
        }

        // 2. Validate Input
        if (!toolDirective || !generatedPageTsx) {
            return NextResponse.json({ success: false, message: "Missing required fields: toolDirective and generatedPageTsx" }, { status: 400 });
        }
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(toolDirective)) {
            return NextResponse.json({ success: false, message: 'Invalid toolDirective format.' }, { status: 400 });
        }
         if (!generatedPageTsx.startsWith("'use client';") && !generatedPageTsx.startsWith('"use client";')) {
             console.warn(`[API create-anonymous-pr] Warning: Generated code for ${toolDirective} does not start with 'use client';`)
         }
        console.log(`[API create-anonymous-pr] Processing PR for new tool: ${toolDirective}`);

    } catch (error) {
        console.error("[API create-anonymous-pr] Error parsing request body:", error);
        return NextResponse.json({ success: false, message: "Invalid request body format" }, { status: 400 });
    }

    let octokit: Octokit;
    let newBranchName: string | null = null;
    try {
        octokit = await getInstallationOctokit();

        // Get latest commit SHA
        const { data: branchData } = await octokit.rest.repos.getBranch({ owner: GITHUB_USER_OR_ORG, repo: GITHUB_REPO, branch: GITHUB_DEFAULT_BRANCH });
        const latestSha = branchData.commit.sha;
        console.log(`[API create-anonymous-pr] Fetched latest SHA: ${latestSha}`);

        // Create Branch
        const timestamp = Date.now();
        newBranchName = `feat/gen-${toolDirective}-${timestamp}`;
        const newBranchRef = `refs/heads/${newBranchName}`;
        console.log(`[API create-anonymous-pr] Creating branch: ${newBranchName}...`);
        await octokit.rest.git.createRef({ owner: GITHUB_USER_OR_ORG, repo: GITHUB_REPO, ref: newBranchRef, sha: latestSha });
        console.log(`[API create-anonymous-pr] Branch ${newBranchName} created.`);

        // Prepare file commit
        const filePath = `app/t/${toolDirective}/page.tsx`; // Correct path
        const encodedContent = Buffer.from(generatedPageTsx).toString('base64'); // Use the generated code
        const commitMessage = `feat: Add AI generated tool - ${toolDirective}`; // Correct commit message
        console.log(`[API create-anonymous-pr] Committing file "${filePath}"...`);

        // Commit the file
        await octokit.rest.repos.createOrUpdateFileContents({
            owner: GITHUB_USER_OR_ORG, repo: GITHUB_REPO, path: filePath,
            message: commitMessage, content: encodedContent, branch: newBranchName,
            committer: { name: 'OET Bot', email: 'bot@online-everything-tool.com' },
            author: { name: 'OET Bot', email: 'bot@online-everything-tool.com' },
        });
        console.log(`[API create-anonymous-pr] File committed.`);

        // Create PR Body
        const prTitle = `feat: Add AI Generated Tool - ${toolDirective}`;
        let requestedDirectivesList = '_None requested or loaded._';
        if (generativeRequestedDirectives.length > 0) {
             requestedDirectivesList = generativeRequestedDirectives.map(d => `- \`${d}\``).join('\n');
        }
        const prBody = `Adds the new tool \`${toolDirective}\` generated via the AI Build Tool feature (submitted anonymously).

**AI Generated Description:**
${generativeDescription || '_No description provided._'}

**User Provided Details/Refinements:**
${additionalDescription || '_None provided._'}

**AI Requested Examples During Generation:**
${requestedDirectivesList}

**Generated Code:** (\`app/t/${toolDirective}/page.tsx\`)
*Please review the attached code changes.*
`;

        console.log(`[API create-anonymous-pr] Creating Pull Request: "${prTitle}"...`);
        // Create the Pull Request
        const { data: pullRequest } = await octokit.rest.pulls.create({
            owner: GITHUB_USER_OR_ORG, repo: GITHUB_REPO, title: prTitle, body: prBody,
            head: newBranchName, base: GITHUB_DEFAULT_BRANCH, maintainer_can_modify: true,
        });
        console.log(`[API create-anonymous-pr] SUCCESS: Pull Request created: ${pullRequest.html_url}`);

        // Return success response
        return NextResponse.json({ success: true, message: `Successfully created Pull Request for new tool: ${toolDirective}`, url: pullRequest.html_url }, { status: 201 });

    } catch (error: unknown) {
        console.error("[API create-anonymous-pr] ERROR during GitHub interaction:", error);
        let errorMessage = "An unexpected error occurred during PR creation."; let errorStatus = 500;
        if (isPotentialErrorObject(error)) { const status = typeof error.status === 'number' ? error.status : undefined; const message = typeof error.message === 'string' ? error.message : undefined; const ghMessage = typeof error.response?.data?.message === 'string' ? error.response.data.message : undefined; errorMessage = message || errorMessage; if (ghMessage) errorMessage += ` (GitHub: ${ghMessage})`; errorStatus = status || errorStatus; if (status === 422 && ghMessage?.includes('Reference already exists')) { errorMessage = `Branch '${newBranchName}' might already exist. Try again.`; errorStatus = 409; } else if (status === 404 && ghMessage?.includes('Not Found')) { errorMessage = `Base branch '${GITHUB_DEFAULT_BRANCH}' or repo not found.`; errorStatus = 404; } } else { errorMessage = String(error); }
        console.error(`[API create-anonymous-pr] FAILURE: Status ${errorStatus}: ${errorMessage}`);
        return NextResponse.json({ success: false, message: errorMessage, url: null }, { status: errorStatus });
    } finally {
         console.log(`[API create-anonymous-pr] -------- POST End (${new Date().toISOString()}) --------`);
    }
} // --- End of POST Handler ---

// --- GET Handler ---
export async function GET() {
    console.log(`[API create-anonymous-pr] -------- GET (${new Date().toISOString()}) --------`);
    if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_PRIVATE_KEY_BASE64) return NextResponse.json({ message: "API route active, but server config missing credentials." });
    return NextResponse.json({ message: "API route for create-anonymous-pr is active. Use POST method." });
} // --- End of GET Handler ---

// --- NO JSX BELOW THIS LINE ---