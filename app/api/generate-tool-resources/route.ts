// FILE: app/api/generate-tool-resources/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
    GenerationConfig,
    SafetySetting,
} from "@google/generative-ai";
import fs from 'fs/promises';
import path from 'path';

// --- Interfaces ---
interface RequestBody {
    toolDirective: string;
    generativeDescription: string;
    additionalDescription?: string;
    modelName?: string;
    generativeRequestedDirectives?: string[]; // Examples AI suggested
    userSelectedExampleDirective?: string | null; // Example user picked
}

// Interface for expected dependency structure
interface LibraryDependency {
    packageName: string;
    reason?: string;
    importUsed?: string; // Example import statement
}

// Interface for the ParamConfig structure used in metadata.json
interface ParamConfig {
    paramName: string;
    type: 'string' | 'enum' | 'boolean' | 'number' | 'json';
    defaultValue: unknown; // Matches the type, e.g., string for "string", number for "number"
}


// Interface for the expected raw Gemini response structure
interface GeminiGenerationResponse {
    message: string; // General feedback message from AI
    generatedFiles: {
        // Expecting specific keys based on the new structure
        page: string; // Content for app/t/<directive>/page.tsx
        clientComponent: string; // Content for app/t/<directive>/_components/<ComponentName>Client.tsx
        metadata: string; // Content for app/t/<directive>/metadata.json (as a JSON string)
    } | null;
    identifiedDependencies: LibraryDependency[] | null; // Array or null
}

// --- Constants ---
const DEFAULT_MODEL_NAME = "gemini-1.5-flash-latest";
const API_KEY = process.env.GEMINI_API_KEY;

// --- Helper: Get Content of Example Files ---
async function getExampleFileContent(directive: string): Promise<{ filePath: string; content: string }[]> {
    const filePathsToTry = [
        `app/t/${directive}/page.tsx`,
        `app/t/${directive}/_components/${toPascalCase(directive)}Client.tsx`,
        `app/t/${directive}/metadata.json`
    ];
    const results: { filePath: string; content: string }[] = [];

    for (const relativePath of filePathsToTry) {
        const fullPath = path.join(process.cwd(), relativePath);
        try {
            await fs.access(fullPath); // Check if file exists
            const content = await fs.readFile(fullPath, 'utf-8');
            results.push({ filePath: relativePath, content });
        } catch (error: unknown) { // Changed to unknown
            const isFsError = typeof error === 'object' && error !== null && 'code' in error;
            const errorCode = isFsError ? (error as { code: string }).code : null;

            if (errorCode === 'ENOENT') {
                 console.log(`[API generate-tool] Optional example file not found: ${relativePath}`);
            } else {
                 const message = error instanceof Error ? error.message : String(error);
                 console.warn(`[API generate-tool] Error reading example file ${relativePath}:`, message);
            }
        }
    }
    return results;
}

// --- Helper: Convert directive to PascalCase for component name ---
function toPascalCase(kebabCase: string): string {
    if (!kebabCase) return '';
    return kebabCase.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

// --- Main API Handler ---
export async function POST(req: NextRequest) {
    if (!API_KEY) {
        return NextResponse.json({ success: false, message: "API key not configured" }, { status: 500 });
    }

    try {
        const body: RequestBody = await req.json();
        const {
            toolDirective,
            generativeDescription,
            additionalDescription,
            modelName = DEFAULT_MODEL_NAME,
            generativeRequestedDirectives = [],
            userSelectedExampleDirective
        } = body;

        if (!toolDirective || !generativeDescription) {
            return NextResponse.json({ success: false, message: "Missing required fields: toolDirective or generativeDescription." }, { status: 400 });
        }

        // --- Prepare Example Context ---
        let exampleFileContext = "";
        const directivesToFetch = [...new Set([...generativeRequestedDirectives, userSelectedExampleDirective].filter(Boolean))];

        if (directivesToFetch.length > 0) {
            exampleFileContext += "\n\n--- Relevant Example File Content ---\n";
            for (const directive of directivesToFetch) {
                 if(!directive) continue; // Skip null/undefined
                 const files = await getExampleFileContent(directive);
                 if (files.length > 0) {
                    exampleFileContext += `\nExample Tool: ${directive}\n`;
                    files.forEach(file => {
                        exampleFileContext += `\n\`\`\`${file.filePath.split('.').pop()}\n// File: ${file.filePath}\n${file.content}\n\`\`\`\n`;
                    });
                 }
            }
             exampleFileContext += "\n--- End Example File Content ---\n";
        } else {
            exampleFileContext = "\nNo specific existing tool examples were requested or found.\n";
        }

        // --- Gemini Interaction ---
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: modelName });

        const generationConfig: GenerationConfig = {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8000,
            responseMimeType: "application/json",
        };

        const safetySettings: SafetySetting[] = [
             { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
             { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
             { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
             { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ];

        const componentName = toPascalCase(toolDirective);
        const clientComponentPath = `app/t/${toolDirective}/_components/${componentName}Client.tsx`;
        const serverComponentPath = `app/t/${toolDirective}/page.tsx`;
        const metadataPath = `app/t/${toolDirective}/metadata.json`;

        // --- CORRECTED PROMPT DEFINITION ---
        const prompt = `Generate the necessary code resources for a new client-side utility tool for the "Online Everything Tool" project.

**Target Tool Directive:** ${toolDirective}
**AI Generated Description:** ${generativeDescription}
**User Provided Refinements:** ${additionalDescription || "None"}

**Project Structure & Rules:**
1.  **Client-Side Focus:** Core tool logic MUST execute entirely in the user's browser. No backend needed for the main functionality.
2.  **File Structure:** Each tool lives in \`app/t/<directive>/\`. It requires THREE files:
    *   \`page.tsx\`: A standard **React Server Component** that acts as a wrapper. It imports metadata, ToolHeader, ToolSuspenseWrapper, and the client component. It renders these components, passing necessary props (\`toolTitle\`, \`toolRoute\`, and potentially \`urlStateParams\`) to the client component.
    *   \`_components/${componentName}Client.tsx\`: The **React Client Component** containing the \`'use client';\` directive. This file holds all the state (useState), logic (event handlers, effects), and UI elements for the tool. It should accept props like \`toolTitle\`, \`toolRoute\`, and optionally \`urlStateParams\`.
    *   \`metadata.json\`: Contains tool metadata like \`title\`, \`description\`, and potentially \`urlStateParams\`.
3.  **UI:** Use standard HTML elements or Shoelace Web Components (\`<sl-...>\`). Style with Tailwind CSS using project's \`rgb(var(--color-...))\` variables where possible (see examples). Keep UI clean and functional.
4.  **State Management:** Use React hooks (useState, useCallback, useEffect, useMemo, useRef) within the Client Component.
5.  **URL State Syncing (\`useToolUrlState\`):**
    *   For tools with simple state suitable for URL persistence (text inputs, selections, etc.), define \`urlStateParams\` in \`metadata.json\`. DO NOT define for file inputs or complex state.
    *   \`urlStateParams\` is an array: \`{ paramName: string, type: 'string'|'boolean'|'number'|'enum'|'json', defaultValue: unknown }\`.
    *   If defined, the Client Component should import and use the \`useToolUrlState\` hook, creating a \`stateSetters\` object mapping \`paramName\` keys to state setter functions.
6.  **History Logging (\`useHistory\`):**
    *   The Client Component should import and use the \`useHistory\` hook.
    *   Call \`addHistoryEntry({ toolName, toolRoute, action, input, output, status })\` for significant actions.
    *   The \`input\` field MUST be a single object containing **all** relevant parameters/options for that execution (e.g., \`{ text: '...', optionA: true }\`). Use keys matching \`urlStateParams\` where relevant.
    *   Truncate long text inputs/outputs (> 500 chars) in the history log.

**Provided Examples:**
${exampleFileContext}

**Generation Task:**
Generate the full source code for the following three files for the new tool "${toolDirective}", adhering to all the rules and patterns demonstrated in the examples:
1.  ${serverComponentPath} (Server Component Wrapper)
2.  ${clientComponentPath} (Client Component with logic and UI)
3.  ${metadataPath} (Metadata JSON, including \`urlStateParams\` only if appropriate)

Also, identify any potential external npm libraries needed (beyond React, Next.js, and Shoelace).

**Output Format:**
Return ONLY a valid JSON object with the following structure:
\`\`\`json
{
  "message": "<Brief message about generation success or any warnings>",
  "generatedFiles": {
    "page": "<Full source code for ${serverComponentPath}>",
    "clientComponent": "<Full source code for ${clientComponentPath}>",
    "metadata": "<JSON string for ${metadataPath}>"
  },
  "identifiedDependencies": [
    { "packageName": "string", "reason": "string (optional)", "importUsed": "string (optional)" }
  ] // or null if none identified
}
\`\`\`
Ensure the code within the "generatedFiles" values is complete and valid source code. Ensure the "metadata" value is a valid JSON string.
`; // <-- The closing backtick was correctly placed, the issue was internal syntax

        // --- End Corrected Prompt ---

        const parts = [{ text: prompt }];
        console.log(`[API generate-tool] Sending prompt to ${modelName} for ${toolDirective}...`);
        const result = await model.generateContent({ contents: [{ role: "user", parts }], generationConfig, safetySettings });

        if (!result.response) {
            throw new Error("Gemini API call failed: No response received.");
        }

        const responseText = result.response.text();
        // console.log("[API generate-tool] Raw Gemini Response:", responseText);

        // --- Parse Gemini Response ---
        let parsedResponse: GeminiGenerationResponse;
        try {
            parsedResponse = JSON.parse(responseText) as GeminiGenerationResponse;
             console.log("[API generate-tool] Parsed Gemini Response Keys:", parsedResponse ? Object.keys(parsedResponse) : 'null/undefined');
             if (parsedResponse && parsedResponse.generatedFiles) {
                console.log("[API generate-tool] Parsed Gemini generatedFiles Keys:", Object.keys(parsedResponse.generatedFiles));
             }

        } catch (e) {
            console.error("[API generate-tool] Failed to parse Gemini JSON response:", e);
            console.error("[API generate-tool] Response Text Was:", responseText);
            throw new Error("Failed to parse generation response from AI.");
        }

        // --- Validate Parsed Structure ---
        if (
            typeof parsedResponse !== 'object' || parsedResponse === null ||
            typeof parsedResponse.message !== 'string' ||
            typeof parsedResponse.generatedFiles !== 'object' || parsedResponse.generatedFiles === null ||
            typeof parsedResponse.generatedFiles.page !== 'string' ||
            typeof parsedResponse.generatedFiles.clientComponent !== 'string' ||
            typeof parsedResponse.generatedFiles.metadata !== 'string' ||
            (parsedResponse.identifiedDependencies !== null && !Array.isArray(parsedResponse.identifiedDependencies))
        ) {
            console.error("[API generate-tool] Invalid structure in parsed AI response:", parsedResponse);
            throw new Error("Received malformed generation data structure from AI.");
        }

        // --- Additional validation for metadata string ---
        try {
            JSON.parse(parsedResponse.generatedFiles.metadata); // Try parsing the metadata string
        } catch (e) {
             console.error("[API generate-tool] Generated metadata string is not valid JSON:", parsedResponse.generatedFiles.metadata);
             throw new Error("AI generated invalid JSON string for metadata.json.");
        }

        // Construct final response structure matching frontend expectations
        const finalResponseData = {
             success: true,
             message: parsedResponse.message,
             generatedFiles: {
                 [serverComponentPath]: parsedResponse.generatedFiles.page,
                 [clientComponentPath]: parsedResponse.generatedFiles.clientComponent,
                 [metadataPath]: parsedResponse.generatedFiles.metadata,
             },
             identifiedDependencies: parsedResponse.identifiedDependencies,
        };


        return NextResponse.json(finalResponseData, { status: 200 });

    } catch (error: unknown) {
        console.error("[API generate-tool] Error:", error);
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
         if (message.includes("response was blocked due to safety")) {
             return NextResponse.json({ success: false, message: "Generation blocked due to safety settings.", error: message }, { status: 400 });
         }
        return NextResponse.json({ success: false, message: `Internal Server Error: ${message}`, error: message }, { status: 500 });
    }
}