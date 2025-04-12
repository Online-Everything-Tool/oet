// /app/api/generate-tool-resources/route.ts

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import fs from 'fs/promises';
import path from 'path';

// --- Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL_NAME = process.env.DEFAULT_GEMINI_MODEL_NAME;

// --- Helper Function to Get Context ---
interface AppContext {
    packageJsonContent: string;
    existingDirectives: string[];
    requestedExamplesCode: { [directive: string]: string | null };
}
async function getApplicationContext(requestedDirectives: string[] = []): Promise<AppContext> {
    let packageJsonContent = '{}';
    let existingDirectives: string[] = [];
    const requestedExamplesCode: { [directive: string]: string | null } = {};
    const toolsDirPath = path.resolve(process.cwd(), 'app', 't');
    try {
        const packageJsonPath = path.resolve(process.cwd(), 'package.json');
        packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
        const entries = await fs.readdir(toolsDirPath, { withFileTypes: true });
        existingDirectives = entries.filter(d => d.isDirectory() && !d.name.startsWith('_')).map(d => d.name);
        if (requestedDirectives.length > 0) {
             console.log(`[Context] Reading requested example code for: ${requestedDirectives.join(', ')}`);
             for (const directive of requestedDirectives) {
                 if (!existingDirectives.includes(directive)) { requestedExamplesCode[directive] = null; continue; }
                 const examplePath = path.resolve(toolsDirPath, directive, 'page.tsx');
                 try { requestedExamplesCode[directive] = await fs.readFile(examplePath, 'utf-8'); }
                 // --- FIX: Use _error to signal intent ---
                 catch (_readError) { console.warn(`[Context] Failed reading ${directive}:`, _readError); requestedExamplesCode[directive] = null; }
             }
        }
    // --- FIX: Use _error to signal intent ---
    } catch (_error) { console.warn('[Context] Warning:', _error); /* Reset vars */ packageJsonContent = '{}'; existingDirectives = []; }
    return { packageJsonContent, existingDirectives, requestedExamplesCode };
}
// --- End Helper Function ---

// Initialize GenAI Client
if (!API_KEY) console.error("FATAL ERROR (generate-tool-resources): GEMINI_API_KEY missing.");
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// --- Generation Config & Safety Settings ---
const generationConfig = { temperature: 0.5, maxOutputTokens: 4096 };
const safetySettings = [ { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, ];
// --- END Definitions ---

export async function POST(request: Request) {
    console.log(`[API /generate-tool-resources] Received POST request at ${new Date().toISOString()}`);
    if (!genAI) { console.error("[API /generate-tool-resources] AI Service configuration error."); return NextResponse.json({ success: false, message: "AI service configuration error.", generatedCode: null }, { status: 500 }); }

    let body;
    try { body = await request.json(); }
    catch (_error) { return NextResponse.json({ success: false, message: 'Invalid request body format', generatedCode: null }, { status: 400 }); }

    const toolDirective: string | undefined = body.toolDirective?.trim();
    const generativeDescription: string | undefined = body.generativeDescription?.trim();
    const additionalDescription: string | undefined = body.additionalDescription?.trim() || '';
    const requestedModelName: string | undefined = body.modelName;
    const generativeRequestedDirectives: string[] | undefined = body.generativeRequestedDirectives;
    console.log(`[API /generate-tool-resources] Request - Directive: ${toolDirective}, Model: ${requestedModelName || 'Default'}, Add'l Desc: ${additionalDescription ? 'Yes' : 'No'}, Requested Examples: ${generativeRequestedDirectives?.join(', ') || 'None'}`);

    // --- FIX: Use const ---
    const finalModelName = requestedModelName?.trim() || DEFAULT_MODEL_NAME?.trim();

    if (!finalModelName) { console.error('[API /generate-tool-resources] No valid AI model name available.'); return NextResponse.json({ success: false, message: 'AI model configuration error.', generatedCode: null }, { status: 400 }); }
    if (!toolDirective || !generativeDescription) { return NextResponse.json({ success: false, message: "Missing required fields: toolDirective and generativeDescription", generatedCode: null }, { status: 400 }); }
    if (!Array.isArray(generativeRequestedDirectives)) { return NextResponse.json({ success: false, message: "Missing or invalid 'generativeRequestedDirectives' field.", generatedCode: null }, { status: 400 }); }

    const { packageJsonContent, existingDirectives, requestedExamplesCode } = await getApplicationContext(generativeRequestedDirectives);
    if (existingDirectives.includes(toolDirective)) { return NextResponse.json({ success: false, message: `Tool directive '${toolDirective}' already exists.`, generatedCode: null }, { status: 400 }); }

    console.log("[API /generate-tool-resources] Constructing prompt for Gemini code generation...");
    let examplesSection = "**Generative Requested Directives Code:**\n\n"; let examplesFound = false;
    for (const directive of generativeRequestedDirectives) { const code = requestedExamplesCode[directive]; if (code) { examplesSection += `*   **Example: \`${directive}/page.tsx\`**\n    \`\`\`typescript\n${code}\n    \`\`\`\n\n`; examplesFound = true; } else { examplesSection += `*   **Example: \`${directive}/page.tsx\`** (Code not found or failed to load)\n\n`; } }
    if (!examplesFound) { examplesSection = "**Generative Requested Directives Code:** (None provided or loaded successfully)\n"; }

    // Prompt content remains the same
    const prompt = `
You are an expert Next.js developer generating code for a new client-side utility tool within an existing application framework defined by its \`package.json\`.
**Application Context:**
\`\`\`json
${packageJsonContent}
\`\`\`
- **Derived Context:** Next.js (App Router), Tailwind CSS, React Hooks, custom \`useHistory\` hook. Practical, developer-centric client-side utilities.
- Existing Tools (Directives): ${existingDirectives.join(', ')}
${examplesSection}
**New Tool Request:**
- **Directive (URL Slug & Folder Name):** \`${toolDirective}\`
- **Primary Function (AI Generated):** ${generativeDescription}
- **Additional Details / Refinements (User Provided):** ${additionalDescription || '(None provided)'}
**Task:**
Generate the complete content for the \`page.tsx\` file for the new tool (\`app/t/${toolDirective}/page.tsx\`). **Pay close attention to the patterns and implementation details in the requested example code provided above.**
**Output Requirements:**
1.  **Complete File Content:** ONLY the full TypeScript code for \`page.tsx\`. 2.  **'use client';** Must be the first line. 3.  **Imports:** React, hooks, \`useHistory\`. 4.  **Component Structure:** Default exported PascalCase component. 5.  **Functionality:** Implement logic based on Primary Function & Additional Details, using browser APIs. 6.  **UI:** Standard HTML elements styled with Tailwind CSS, following example patterns. 7.  **State Management:** Use \`useState\`. 8.  **Event Handling:** Use \`useCallback\`. 9.  **History Logging:** Use \`addHistoryEntry\` from \`useHistory\` hook correctly (log params, no sensitive output). Use \`/t/${toolDirective}\` for \`toolRoute\`. 10. **Error Handling:** Include try/catch, display errors. 11. **No External Libraries (unless essential & in package.json):** Rely on core stack + browser APIs.
**Final Output:** Start the response *immediately* with the generated code for \`page.tsx\`.
\`\`\`typescript
// Start generated page.tsx code here
'use client';
// ... rest of the generated code
\`\`\`
`;

    console.log(`[API /generate-tool-resources] Calling Gemini model: ${finalModelName}...`);
    const model = genAI.getGenerativeModel({ model: finalModelName });
    let generatedPageTsx: string | null = null; let geminiSuccess = false; let generationMessage = '';

    try {
        const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig, safetySettings, });
        if (result.response) {
            const responseText = result.response.text().trim(); const blockReason = result.response.promptFeedback?.blockReason;
            if (blockReason) { generationMessage = `AI code generation blocked. Reason: ${blockReason}`; console.warn(`[API /generate-tool-resources] Gemini response blocked.`); }
            else if (responseText) {
                const cleanedCode = responseText.replace(/^```typescript\s*/i, '').replace(/\s*```$/, '').trim();
                if (cleanedCode.startsWith("'use client';") || cleanedCode.startsWith('"use client";')) { generatedPageTsx = cleanedCode; geminiSuccess = true; generationMessage = "AI successfully generated tool code preview."; console.log(`[API /generate-tool-resources] Received ${generatedPageTsx.length} characters of code.`); }
                else { generationMessage = "AI generation warning: Output did not start with 'use client';. Manual review recommended."; console.warn("[API /generate-tool-resources] Generated code might be incomplete/incorrect (missing 'use client';)."); generatedPageTsx = cleanedCode; geminiSuccess = true; }
            } else { generationMessage = "AI generation failed: Empty response received."; console.error('[API /generate-tool-resources] Gemini returned empty response text.'); }
        } else { generationMessage = "AI generation failed: No response object received."; console.error('[API /generate-tool-resources] Gemini result missing response object.'); }
    } catch (geminiError: unknown) { console.error('[API /generate-tool-resources] Error calling Gemini API:', geminiError); generationMessage = `AI service error during code generation.`; }

    if (!geminiSuccess) { return NextResponse.json({ success: false, message: generationMessage, generatedCode: null }, { status: 500 }); }
    else { return NextResponse.json( { success: true, message: generationMessage, generatedCode: generatedPageTsx }, { status: 200 } ); }
}

export async function GET() {
     console.log(`[API /generate-tool-resources] Received GET request at ${new Date().toISOString()}`);
     return NextResponse.json({ message: "API route /api/generate-tool-resources is active. Use POST." });
}