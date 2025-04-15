// FILE: app/api/create-anonymous-pr/route.ts
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
if (!appId || !privateKeyBase64) {
    console.error("[API STARTUP create-anonymous-pr] ERROR: GitHub App credentials missing.");
} else {
    console.log("[API STARTUP create-anonymous-pr] Required GitHub App credentials loaded.");
}
// --- End Load Environment Variables ---

// --- Interfaces (matching frontend/API expectations) ---
interface LibraryDependency {
    packageName: string;
    reason?: string;
    importUsed?: string;
}

interface RequestBody {
    toolDirective: string;
    generatedFiles: { [filePath: string]: string }; // Expecting an object map
    identifiedDependencies?: LibraryDependency[]; // Optional array
    generativeDescription?: string;
    additionalDescription?: string;
    generativeRequestedDirectives?: string[];
    userSelectedExampleDirective?: string | null;
}

// --- Type Guards ---
const hasMessage = (e: unknown): e is { message: string } => typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string';
const isPotentialErrorObject = (e: unknown): e is { status?: unknown; message?: unknown; response?: { data?: { message?: string } } } => typeof e === 'object' && e !== null;
// --- End Type Guards ---

// --- Helper: Get Authenticated Octokit Instance (Error handling refined) ---
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
        let errorMessage = "Unknown auth error.";
        let errorStatus = 500;

        if (isPotentialErrorObject(error)) {
            const status = typeof error.status === 'number' ? error.status : undefined;
            const message = typeof error.message === 'string' ? error.message : undefined;

            const cause = (error as { cause?: unknown }).cause;
            const causeMessage = (typeof cause === 'object' && cause !== null && typeof (cause as { message?: unknown }).message === 'string')
                ? (cause as { message: string }).message
                : undefined;

            if (status === 404) {
                errorMessage = `GitHub App install not found for ${GITHUB_USER_OR_ORG}/${GITHUB_REPO}.`;
            } else if (message?.includes('keyData') || causeMessage?.includes('private key')) {
                errorMessage = `Private key parse failed. Check format or env var.`;
            } else {
                 errorMessage = message || errorMessage;
            }
             errorStatus = status || errorStatus;

        } else {
             errorMessage = String(error);
        }

        const wrappedError = new Error(`Auth Failed: ${errorMessage}`);
        if (errorStatus !== 500 || (isPotentialErrorObject(error) && error.status)) {
           Object.assign(wrappedError, { status: errorStatus });
        }
        throw wrappedError;
    }
}
// --- End Helper ---

// --- Main POST Handler ---
export async function POST(request: Request) {
    console.log(`[API create-anonymous-pr] -------- POST Start (${new Date().toISOString()}) --------`);

    let body: RequestBody;
    let toolDirective: string;
    let generatedFiles: { [filePath: string]: string };
    let identifiedDependencies: LibraryDependency[];
    let generativeDescription: string;
    let additionalDescription: string;
    let generativeRequestedDirectives: string[];
    let userSelectedExampleDirective: string | null;

    // 1. Parse and Validate Request Body
    try {
        body = await request.json();

        toolDirective = body.toolDirective?.trim();
        generatedFiles = body.generatedFiles;
        identifiedDependencies = Array.isArray(body.identifiedDependencies) ? body.identifiedDependencies : [];

        if (!toolDirective) throw new Error("Missing required field: toolDirective");
        if (typeof generatedFiles !== 'object' || generatedFiles === null || Object.keys(generatedFiles).length === 0) {
            throw new Error("Missing or invalid required field: generatedFiles must be a non-empty object.");
        }
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(toolDirective)) {
            throw new Error('Invalid toolDirective format.');
        }

        for (const [filePath, fileContent] of Object.entries(generatedFiles)) {
             if (typeof fileContent !== 'string') {
                 throw new Error(`Invalid content for file '${filePath}': Must be a string.`);
             }
             if (!filePath.startsWith('app/t/')) {
                 console.warn(`[API create-anonymous-pr] Unexpected file path found: ${filePath}`);
             }
              // Relaxed 'use client' check for now, but good to keep in mind
             // if (filePath.endsWith('/page.tsx') && !fileContent.trim().startsWith("'use client';") && !fileContent.trim().startsWith('"use client";')) {
             //    console.warn(`[API create-anonymous-pr] Warning: Generated file ${filePath} does not start with 'use client';`)
             // }
        }

        generativeDescription = body.generativeDescription?.trim() || '';
        additionalDescription = body.additionalDescription?.trim() || '';
        generativeRequestedDirectives = Array.isArray(body.generativeRequestedDirectives)
            ? body.generativeRequestedDirectives.filter((d: unknown): d is string => typeof d === 'string')
            : [];
        userSelectedExampleDirective = (typeof body.userSelectedExampleDirective === 'string' && body.userSelectedExampleDirective.trim())
            ? body.userSelectedExampleDirective.trim()
            : null;

        console.log(`[API create-anonymous-pr] Processing PR for new tool: ${toolDirective}`);
        console.log(`[API create-anonymous-pr] Files to commit: ${Object.keys(generatedFiles).length}`);
        console.log(`[API create-anonymous-pr] Identified dependencies passed from generator: ${identifiedDependencies.length}`); // Log what was received

    } catch (error: unknown) {
        const message = hasMessage(error) ? error.message : "Invalid request body format";
        console.error("[API create-anonymous-pr] Error parsing request body:", message, error);
        return NextResponse.json({ success: false, message: message }, { status: 400 });
    }

    // 2. GitHub Interaction
    let octokit: Octokit;
    let newBranchName: string | null = null;
    try {
        octokit = await getInstallationOctokit();

        const { data: branchData } = await octokit.rest.repos.getBranch({ owner: GITHUB_USER_OR_ORG, repo: GITHUB_REPO, branch: GITHUB_DEFAULT_BRANCH });
        const latestSha = branchData.commit.sha;
        console.log(`[API create-anonymous-pr] Fetched latest SHA: ${latestSha}`);

        const timestamp = Date.now();
        newBranchName = `feat/gen-${toolDirective}-${timestamp}`;
        const newBranchRef = `refs/heads/${newBranchName}`;
        console.log(`[API create-anonymous-pr] Creating branch: ${newBranchName}...`);
        await octokit.rest.git.createRef({ owner: GITHUB_USER_OR_ORG, repo: GITHUB_REPO, ref: newBranchRef, sha: latestSha });
        console.log(`[API create-anonymous-pr] Branch ${newBranchName} created.`);

        const commitMessage = `feat: Add AI generated tool - ${toolDirective}`;
        const committer = { name: 'OET Bot', email: 'bot@online-everything-tool.com' };
        const author = { name: 'OET Bot', email: 'bot@online-everything-tool.com' };

        for (const [filePath, fileContent] of Object.entries(generatedFiles)) {
            console.log(`[API create-anonymous-pr] Committing file "${filePath}" to branch ${newBranchName}...`);
            const encodedContent = Buffer.from(fileContent).toString('base64');
            await octokit.rest.repos.createOrUpdateFileContents({
                owner: GITHUB_USER_OR_ORG, repo: GITHUB_REPO, path: filePath,
                message: commitMessage,
                content: encodedContent,
                branch: newBranchName,
                committer: committer,
                author: author,
            });
            console.log(`[API create-anonymous-pr] File "${filePath}" committed.`);
        }
        console.log(`[API create-anonymous-pr] All ${Object.keys(generatedFiles).length} files committed.`);


        // --- Create Enhanced PR Body ---
        const prTitle = `feat: Add AI Generated Tool - ${toolDirective}`;

        const formatList = (items: string[], noneMessage: string, prefix = '- '): string => {
            if (!items || items.length === 0) return noneMessage;
            return items.map(item => `${prefix}\`${item}\``).join('\n');
        };

        const formatDependencies = (deps: LibraryDependency[], noneMessage: string): string => {
             if (!deps || deps.length === 0) return noneMessage;
             return deps.map(dep => `- \`${dep.packageName}\`${dep.reason ? ` - _${dep.reason}_` : ''}`).join('\n');
        };

        // --- UPDATED PR BODY ---
        const prBody = `
Adds the new tool \`${toolDirective}\` generated via the AI Build Tool feature (submitted anonymously).

**AI Generated Description:**
${generativeDescription || '_No description provided._'}

**User Provided Details/Refinements:**
${additionalDescription || '_None provided._'}

**AI Requested Examples During Generation:**
${formatList(generativeRequestedDirectives, '_None requested or loaded._')}

**User Selected Example During Generation:**
${userSelectedExampleDirective ? `\`${userSelectedExampleDirective}\`` : '_None selected._'}

**Dependencies Identified by Generator API:**
${formatDependencies(identifiedDependencies, '_None explicitly identified by the generation API._')}
${identifiedDependencies.length > 0
    ? '\n_Note: Please review the generated code for any other implicitly used libraries (like \`three\`, \`@react-three/fiber\`, etc. if applicable) and ensure all necessary dependencies are added to package.json._'
    : '\n_Note: Please review the generated code for any implicitly used libraries and ensure dependencies are added to package.json if needed._'
}

**Files Added/Modified:**
${formatList(Object.keys(generatedFiles), '_Error: No files listed._')}

*Please review the attached code changes.*
`;
        // --- End PR Body Creation ---

        console.log(`[API create-anonymous-pr] Creating Pull Request: "${prTitle}"...`);
        const { data: pullRequest } = await octokit.rest.pulls.create({
            owner: GITHUB_USER_OR_ORG, repo: GITHUB_REPO, title: prTitle, body: prBody,
            head: newBranchName, base: GITHUB_DEFAULT_BRANCH, maintainer_can_modify: true,
        });
        console.log(`[API create-anonymous-pr] SUCCESS: Pull Request created: ${pullRequest.html_url}`);

        return NextResponse.json({ success: true, message: `Successfully created Pull Request for new tool: ${toolDirective}`, url: pullRequest.html_url }, { status: 201 });

    } catch (error: unknown) {
        console.error("[API create-anonymous-pr] ERROR during GitHub interaction:", error);
        let errorMessage = "An unexpected error occurred during PR creation.";
        let errorStatus = 500;
        if (isPotentialErrorObject(error)) {
             const status = typeof error.status === 'number' ? error.status : undefined;
             const message = typeof error.message === 'string' ? error.message : undefined;
             const ghMessage = typeof error.response?.data?.message === 'string' ? error.response.data.message : undefined;
             errorMessage = message || errorMessage;
             if (ghMessage) errorMessage += ` (GitHub: ${ghMessage})`;
             errorStatus = status || errorStatus;
             if (status === 422 && ghMessage?.includes('Reference already exists')) {
                 errorMessage = `Branch '${newBranchName}' might already exist. Please try submitting again.`;
                 errorStatus = 409;
             } else if (status === 404 && ghMessage?.includes('Not Found')) {
                 errorMessage = `Base branch '${GITHUB_DEFAULT_BRANCH}' or repository not found. Check configuration.`;
                 errorStatus = 404;
             }
        } else {
            errorMessage = String(error);
        }
        console.error(`[API create-anonymous-pr] FAILURE: Status ${errorStatus}: ${errorMessage}`);
        return NextResponse.json({ success: false, message: errorMessage, url: null }, { status: errorStatus });
    } finally {
         console.log(`[API create-anonymous-pr] -------- POST End (${new Date().toISOString()}) --------`);
    }
}

export async function GET() {
    console.log(`[API create-anonymous-pr] -------- GET (${new Date().toISOString()}) --------`);
    if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_PRIVATE_KEY_BASE64) return NextResponse.json({ message: "API route active, but server config missing credentials." });
    return NextResponse.json({ message: "API route for create-anonymous-pr is active. Use POST method." });
}