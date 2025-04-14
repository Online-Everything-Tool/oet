import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import fs from 'fs/promises'; // Use promises API for async/await
import path from 'path';

// --- Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL_NAME = process.env.DEFAULT_GEMINI_MODEL_NAME;

// Define the structure expected for dependencies (matches frontend)
interface LibraryDependency {
    packageName: string;
    reason?: string;
    importUsed?: string; // Note: AI might not reliably provide this
}

// Define the structure expected in the AI's JSON response
interface AiGenerationResponse {
    generatedFiles: {
        [filePath: string]: string; // e.g., "app/t/tool-directive/page.tsx": "<code>"
    } | null;
    identifiedDependencies: LibraryDependency[] | null;
}


// --- Helper Function to Get Context (No changes needed here from previous version) ---
interface AppContext {
    packageJsonContent: string;
    existingDirectives: string[];
    requestedExamplesCode: { [directive: string]: string | null };
}
async function getApplicationContext(
    aiRequestedDirectives: string[] = [],
    userSelectedDirective?: string | null
): Promise<AppContext> {
    let packageJsonContent = '{}';
    let existingDirectives: string[] = [];
    const requestedExamplesCode: { [directive: string]: string | null } = {};
    const toolsDirPath = path.resolve(process.cwd(), 'app', 't');
    const allExampleDirectivesToFetch = new Set<string>(aiRequestedDirectives);
    if (userSelectedDirective) {
        allExampleDirectivesToFetch.add(userSelectedDirective);
    }
    const directivesToFetchArray = Array.from(allExampleDirectivesToFetch);

    try {
        const packageJsonPath = path.resolve(process.cwd(), 'package.json');
        packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
        const entries = await fs.readdir(toolsDirPath, { withFileTypes: true });
        existingDirectives = entries.filter(d => d.isDirectory() && !d.name.startsWith('_')).map(d => d.name);

        if (directivesToFetchArray.length > 0) {
             console.log(`[Context] Reading example code for: ${directivesToFetchArray.join(', ')}`);
             await Promise.all(directivesToFetchArray.map(async (directive) => {
                 requestedExamplesCode[directive] = null;
                 if (!existingDirectives.includes(directive)) {
                     console.warn(`[Context] Example directive '${directive}' does not exist.`);
                     return;
                 }
                 const examplePath = path.resolve(toolsDirPath, directive, 'page.tsx');
                 try {
                     requestedExamplesCode[directive] = await fs.readFile(examplePath, 'utf-8');
                     console.log(`[Context] Successfully read code for '${directive}'.`);
                 } catch (readError: unknown) {
                     const isFsError = typeof readError === 'object' && readError !== null && 'code' in readError;
                     const errorCode = isFsError ? (readError as { code: string }).code : null;
                     if (errorCode === 'ENOENT') {
                         console.warn(`[Context] File not found for example '${directive}': ${examplePath}`);
                     } else {
                         console.error(`[Context] Failed reading code for '${directive}':`, readError);
                     }
                 }
             }));
        }
    } catch (error: unknown) {
        console.error('[Context] Error gathering application context:', error);
        packageJsonContent = '{}';
        existingDirectives = [];
        Object.keys(requestedExamplesCode).forEach(key => { delete requestedExamplesCode[key]; });
    }
    return { packageJsonContent, existingDirectives, requestedExamplesCode };
}
// --- End Helper Function ---

// Initialize GenAI Client
if (!API_KEY) {
    console.error("FATAL ERROR (generate-tool-resources): GEMINI_API_KEY missing.");
}
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// --- Generation Config & Safety Settings ---
const generationConfig = { temperature: 0.5, maxOutputTokens: 6144 };
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];
// --- END Definitions ---

export async function POST(request: Request) {
    console.log(`[API /generate-tool-resources] Received POST request at ${new Date().toISOString()}`);
    if (!genAI) {
        console.error("[API /generate-tool-resources] AI Service configuration error (GEMINI_API_KEY potentially missing).");
        return NextResponse.json({ success: false, message: "AI service configuration error.", generatedFiles: null, identifiedDependencies: null }, { status: 500 });
    }

    let body;
    try {
        body = await request.json();
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[API /generate-tool-resources] Invalid request body: ${message}`);
        return NextResponse.json({ success: false, message: `Invalid request body format: ${message}`, generatedFiles: null, identifiedDependencies: null }, { status: 400 });
    }

    // --- Extract Input Fields ---
    const toolDirective: string | undefined = body.toolDirective?.trim();
    const generativeDescription: string | undefined = body.generativeDescription?.trim();
    const additionalDescription: string | undefined = body.additionalDescription?.trim() || '';
    const requestedModelName: string | undefined = body.modelName;
    const generativeRequestedDirectives: string[] | undefined = body.generativeRequestedDirectives;
    const userSelectedExampleDirective: string | null | undefined = body.userSelectedExampleDirective;

    console.log(`[API /generate-tool-resources] Request Params:`);
    console.log(`  - Directive: ${toolDirective}`);
    console.log(`  - Model: ${requestedModelName || 'Default (' + (DEFAULT_MODEL_NAME || 'Not Set') + ')'}`);
    console.log(`  - Add'l Desc Provided: ${additionalDescription ? 'Yes' : 'No'}`);
    console.log(`  - AI Requested Examples: ${generativeRequestedDirectives?.join(', ') || 'None'}`);
    console.log(`  - User Selected Example: ${userSelectedExampleDirective || 'None'}`);

    // --- Input Validation ---
    const finalModelName = requestedModelName?.trim() || DEFAULT_MODEL_NAME?.trim();
    if (!finalModelName) {
        console.error('[API /generate-tool-resources] No valid AI model name available.');
        return NextResponse.json({ success: false, message: 'AI model configuration error.', generatedFiles: null, identifiedDependencies: null }, { status: 400 });
    }
    if (!toolDirective || !generativeDescription) {
        return NextResponse.json({ success: false, message: "Missing required fields: toolDirective and generativeDescription", generatedFiles: null, identifiedDependencies: null }, { status: 400 });
    }
    if (!Array.isArray(generativeRequestedDirectives)) {
        console.warn('[API /generate-tool-resources] Missing or invalid `generativeRequestedDirectives` field. Treating as empty array.');
        return NextResponse.json({ success: false, message: "Missing or invalid 'generativeRequestedDirectives' field (must be an array).", generatedFiles: null, identifiedDependencies: null }, { status: 400 });
    }
    if (userSelectedExampleDirective !== null && userSelectedExampleDirective !== undefined && typeof userSelectedExampleDirective !== 'string') {
         return NextResponse.json({ success: false, message: "Invalid 'userSelectedExampleDirective' field (must be a string or null).", generatedFiles: null, identifiedDependencies: null }, { status: 400 });
    }

    // --- Get Context ---
    const { packageJsonContent, existingDirectives, requestedExamplesCode } = await getApplicationContext(
        generativeRequestedDirectives,
        userSelectedExampleDirective
    );

    // Check for existing directive conflict
    if (existingDirectives.includes(toolDirective)) {
        return NextResponse.json({ success: false, message: `Tool directive '${toolDirective}' already exists.`, generatedFiles: null, identifiedDependencies: null }, { status: 400 });
    }

    // --- Construct Updated Prompt ---
    console.log("[API /generate-tool-resources] Constructing prompt for Gemini code & metadata generation...");

    // Build AI examples section (No changes needed)
    let aiExamplesSection = "**Generative AI Requested Example Code:**\n\n";
    let aiExamplesFound = false;
    for (const directive of generativeRequestedDirectives) {
        const code = requestedExamplesCode[directive];
        if (code) {
            aiExamplesSection += `*   **Example: \`${directive}/page.tsx\`**\n    \`\`\`typescript\n${code}\n    \`\`\`\n\n`;
            aiExamplesFound = true;
        } else {
            aiExamplesSection += `*   **Example: \`${directive}/page.tsx\`** (Code not found or failed to load)\n\n`;
        }
    }
    if (!aiExamplesFound) {
        aiExamplesSection = "**Generative AI Requested Example Code:** (None provided or loaded successfully)\n";
    }

    // Build User example section (No changes needed)
    let userExampleSection = "**User Selected Example Code:** (None selected or loaded)\n";
    if (userSelectedExampleDirective && requestedExamplesCode[userSelectedExampleDirective]) {
        const userCode = requestedExamplesCode[userSelectedExampleDirective];
        userExampleSection = `**User Selected Example Code:**\n\n*   **Example: \`${userSelectedExampleDirective}/page.tsx\`**\n    \`\`\`typescript\n${userCode}\n    \`\`\`\n\n`;
    } else if (userSelectedExampleDirective) {
         userExampleSection = `**User Selected Example Code:**\n\n*   **Example: \`${userSelectedExampleDirective}/page.tsx\`** (Code not found or failed to load)\n\n`;
    }


    // --- Updated Prompt Core ---
    const prompt = `
You are an expert Next.js developer generating code for a new client-side utility tool within an existing application framework defined by its \`package.json\`.

**Application Context:**
\`\`\`json
${packageJsonContent}
\`\`\`
- **Derived Context:** Next.js (App Router), Tailwind CSS, React Hooks, custom \`useHistory\` hook. Practical, developer-centric client-side utilities.
- Existing Tools (Directives): ${existingDirectives.join(', ') || 'None listed'}

${aiExamplesSection}
${userExampleSection}

**New Tool Request:**
- **Directive (URL Slug & Folder Name):** \`${toolDirective}\`
- **Primary Function (AI Generated):** ${generativeDescription}
- **Additional Details / Refinements (User Provided):** ${additionalDescription || '(None provided)'}

**Task:**
Generate the necessary resources for the new tool: \`${toolDirective}\`. This includes the main React component code (\`page.tsx\`) and its metadata file (\`metadata.json\`). Also, identify any required external npm dependencies not already listed in the provided package.json context or standard browser/React/Next.js APIs.

**Output Requirements:**
Respond ONLY with a single, valid JSON object adhering strictly to the following structure. Do not include any explanations or markdown formatting outside this JSON structure.

\`\`\`json
{
  "generatedFiles": {
    "app/t/${toolDirective}/page.tsx": "<Full source code for page.tsx, starting with 'use client';>",
    "app/t/${toolDirective}/metadata.json": "{\\n  \\"title\\": \\"<Generated User-Friendly Title>\\",\\n  \\"description\\": \\"<Generated Concise Description>\\"\\n}"
  },
  "identifiedDependencies": [
    {
      "packageName": "<npm package name>",
      "reason": "<Brief reason why it's needed>"
    }
    // Add more dependency objects if identified, otherwise return empty array []
  ]
}
\`\`\`

**Detailed Instructions for Generation:**

1.  **\`generatedFiles -> page.tsx\`:** Create the complete TypeScript code for the main React component (\`page.tsx\`). Adhere strictly to previous instructions regarding \`'use client';\`, React hooks, Tailwind/Shoelace styling (based on examples), \`useHistory\` integration, error handling, and minimizing external libraries. **Pay close attention to the patterns and implementation details in BOTH the AI Requested and User Selected example code provided above.** Prioritize the User Selected Example if its patterns conflict with AI examples but seem relevant to the new tool's function.
2.  **\`generatedFiles -> metadata.json\`:** Create the content for the metadata file. Generate a user-friendly \`title\` (e.g., "Image Grayscale Converter") and a concise one-sentence \`description\` reflecting the tool's purpose. Ensure the value is a valid JSON string (escaped correctly for the outer JSON structure, as shown in the example).
3.  **\`identifiedDependencies\`:** Analyze the generated \`page.tsx\` code. List any external npm packages imported/required that are NOT standard React (\`react\`, \`useState\`, etc.), Next.js (\`next/link\`, etc.), or common Browser APIs (\`fetch\`, \`document\`, \`window\`, \`FileReader\`, \`Canvas\`, etc.). If a library like \`jszip\` or \`ethers\` (seen in context) is used, list it. Provide the \`packageName\` and a brief \`reason\`. If no *new* external dependencies are needed, return an empty array \`[]\`.

**Ensure the final output is ONLY the JSON object described above.**
`;

    console.log(`[API /generate-tool-resources] Calling Gemini model: ${finalModelName}...`);
    const model = genAI.getGenerativeModel({ model: finalModelName });

    // Variables to hold results
    let aiResult: AiGenerationResponse | null = null; // To hold the parsed JSON from AI
    let geminiSuccess = false; // Flag for overall success
    let generationMessage = ''; // User-facing message

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
            safetySettings,
        });

        if (result.response) {
            const responseText = result.response.text().trim();
            const blockReason = result.response.promptFeedback?.blockReason;

            if (blockReason) {
                generationMessage = `AI code generation blocked. Reason: ${blockReason}`;
                console.warn(`[API /generate-tool-resources] Gemini response blocked. Reason: ${blockReason}`);
                // Keep geminiSuccess false
            } else if (responseText) {
                // --- Attempt to parse the response as the expected JSON structure ---
                try {
                    // Clean potential markdown fences first, just in case
                    const cleanedJsonString = responseText
                        .replace(/^```(?:json)?\s*/i, '')
                        .replace(/\s*```$/, '')
                        .trim();

                    const parsedAiJson = JSON.parse(cleanedJsonString);

                    // --- Basic Validation of Parsed Structure ---
                    if (parsedAiJson && typeof parsedAiJson.generatedFiles === 'object' && parsedAiJson.generatedFiles !== null && Array.isArray(parsedAiJson.identifiedDependencies)) {
                        const mainPagePath = `app/t/${toolDirective}/page.tsx`;
                        const metadataPath = `app/t/${toolDirective}/metadata.json`;

                        // +++ Add Debugging Logs +++
                        console.log(`[API Debug] Checking for key: '${mainPagePath}'`);
                        console.log(`[API Debug] Value type: ${typeof parsedAiJson.generatedFiles[mainPagePath]}`);
                        console.log(`[API Debug] Checking for key: '${metadataPath}'`);
                        console.log(`[API Debug] Value type: ${typeof parsedAiJson.generatedFiles[metadataPath]}`);
                        console.log(`[API Debug] Full generatedFiles keys: ${Object.keys(parsedAiJson.generatedFiles).join(', ')}`);
                        // +++ End Debugging Logs +++

                        // The check itself
                        if (typeof parsedAiJson.generatedFiles[mainPagePath] === 'string' && typeof parsedAiJson.generatedFiles[metadataPath] === 'string') {
                            aiResult = { // Assign to our typed variable
                                generatedFiles: parsedAiJson.generatedFiles,
                                identifiedDependencies: parsedAiJson.identifiedDependencies
                            };
                            geminiSuccess = true;
                            generationMessage = "AI successfully generated files and identified dependencies.";
                            console.log(`[API /generate-tool-resources] Successfully parsed AI response JSON. Found ${Object.keys(aiResult.generatedFiles || {}).length} files and ${aiResult.identifiedDependencies?.length || 0} dependencies.`);

                            // Optional: Add warning if page.tsx doesn't start with 'use client'
                            if (!aiResult.generatedFiles?.[mainPagePath]?.trim().startsWith("'use client';") && !aiResult.generatedFiles?.[mainPagePath]?.trim().startsWith('"use client";')) {
                                 generationMessage += " Warning: generated page.tsx might be missing 'use client'; directive.";
                                 console.warn("[API /generate-tool-resources] Generated page.tsx appears to be missing 'use client';");
                             }

                        } else {
                             generationMessage = "AI generation error: Response JSON missing required file content (page.tsx or metadata.json).";
                             console.error('[API /generate-tool-resources] AI Response JSON structure invalid: Missing required file paths. Check debug logs above.'); // Updated log
                             geminiSuccess = false;
                        }
                    } else {
                        generationMessage = "AI generation error: Response format incorrect (expected generatedFiles object and identifiedDependencies array).";
                        console.error('[API /generate-tool-resources] AI Response JSON structure invalid:', parsedAiJson);
                        geminiSuccess = false;
                    }
                } catch (parseError: unknown) {
                    generationMessage = "AI generation error: Failed to parse AI response as JSON.";
                    console.error('[API /generate-tool-resources] Failed to parse AI response JSON:', parseError);
                    console.error('[API /generate-tool-resources] Raw AI Response Text:', responseText); // Log raw text on parse failure
                    geminiSuccess = false;
                }
            } else {
                generationMessage = "AI generation failed: Empty response text received.";
                console.error('[API /generate-tool-resources] Gemini returned empty response text.');
                 geminiSuccess = false;
            }
        } else {
            generationMessage = "AI generation failed: No response object received from Gemini.";
            console.error('[API /generate-tool-resources] Gemini result missing response object.');
             geminiSuccess = false;
        }
    } catch (geminiError: unknown) {
        const message = geminiError instanceof Error ? geminiError.message : String(geminiError);
        console.error('[API /generate-tool-resources] Error calling Gemini API:', message, geminiError);
        generationMessage = `AI service error during code generation: ${message}`;
        // Keep geminiSuccess false
         geminiSuccess = false;
    }

    // --- Return Final Response to Frontend ---
    if (!geminiSuccess || !aiResult) {
        // Return 500 for internal AI errors/blocks/parsing failures
        return NextResponse.json({
            success: false,
            message: generationMessage,
            generatedFiles: null, // Ensure null on failure
            identifiedDependencies: null // Ensure null on failure
        }, { status: 500 });
    } else {
        // Return 200 OK with the structured data
        return NextResponse.json({
            success: true,
            message: generationMessage, // Includes success/warning message
            generatedFiles: aiResult.generatedFiles,
            identifiedDependencies: aiResult.identifiedDependencies
        }, { status: 200 });
    }
}

// Optional: Keep the GET handler
export async function GET() {
     console.log(`[API /generate-tool-resources] Received GET request at ${new Date().toISOString()}`);
     return NextResponse.json({ message: "API route /api/generate-tool-resources is active. Use POST to generate code." });
}