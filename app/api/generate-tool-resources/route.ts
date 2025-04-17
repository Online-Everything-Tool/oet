// FILE: app/api/generate-tool-resources/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
    GenerationConfig,
    SafetySetting,
} from "@google/generative-ai";
import fs from 'fs/promises'; // Ensure fs/promises is imported
import path from 'path';     // Ensure path is imported

// --- Interfaces ---
interface RequestBody {
    toolDirective: string;
    generativeDescription: string;
    additionalDescription?: string;
    modelName?: string;
    generativeRequestedDirectives?: string[]; // Examples AI suggested
    userSelectedExampleDirectives?: string[] | null; // Array for user-selected examples
}

// Interface for expected dependency structure
interface LibraryDependency {
    packageName: string;
    reason?: string;
    importUsed?: string; // Example import statement
}

// Interface for the expected raw Gemini response structure
interface GeminiGenerationResponse {
    message: string;
    generatedFiles: {
        page: string;
        clientComponent: string;
        metadata: string;
    } | null;
    identifiedDependencies: LibraryDependency[] | null;
}

// --- Constants ---
const DEFAULT_MODEL_NAME = "gemini-1.5-flash-latest";
const API_KEY = process.env.GEMINI_API_KEY;

// --- Files to add to the core context ---
const CORE_CONTEXT_FILES = [
  // Types
  'src/types/tools.ts',
  'src/types/history.ts',
  'src/types/image.ts',
  'src/types/build.ts', // Added build types as they might be relevant contextually

  // Hooks
  'app/tool/_hooks/useToolUrlState.ts',
  'app/tool/_hooks/useImageProcessing.ts',

  // Components
  'app/tool/_components/ImageSelectionModal.tsx',

  // Contexts
  'app/context/HistoryContext.tsx',
  'app/context/ImageLibraryContext.tsx',

  // Utils
  'app/lib/utils.ts',
  'app/lib/colorUtils.ts',
  'app/lib/db.ts', // Include Dexie setup context

  // Constants
  'src/constants/charset.ts',
  'src/constants/history.ts',
  'src/constants/text.ts',
];
// --- End Core Context Files ---

// --- Helper: Get Content of Example Files ---
async function getExampleFileContent(directive: string): Promise<{ filePath: string; content: string }[]> {
    const filePathsToTry = [
        `app/tool/${directive}/page.tsx`,
        `app/tool/${directive}/_components/${toPascalCase(directive)}Client.tsx`,
        `app/tool/${directive}/metadata.json`
    ];
    const results: { filePath: string; content: string }[] = [];

    for (const relativePath of filePathsToTry) {
        const fullPath = path.join(process.cwd(), relativePath);
        try {
            await fs.access(fullPath); // Check if file exists
            const content = await fs.readFile(fullPath, 'utf-8');
            results.push({ filePath: relativePath, content });
        } catch (error: unknown) {
            const isFsError = typeof error === 'object' && error !== null && 'code' in error;
            const errorCode = isFsError ? (error as { code: string }).code : null;

            if (errorCode === 'ENOENT') {
                 // This is expected if an optional component file doesn't exist
                 console.log(`[API generate-tool/getExample] Optional example file not found: ${relativePath}`);
            } else {
                 const message = error instanceof Error ? error.message : String(error);
                 console.warn(`[API generate-tool/getExample] Error reading example file ${relativePath}:`, message);
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
            userSelectedExampleDirectives // Accept array from request
        } = body;

        if (!toolDirective || !generativeDescription) {
            return NextResponse.json({ success: false, message: "Missing required fields: toolDirective or generativeDescription." }, { status: 400 });
        }

        // --- Prepare Example Context ---
        let exampleFileContext = "";
        // Combine AI and User selected examples, ensuring uniqueness and filtering nulls/empty
        const directivesToFetch = [...new Set(
             [...generativeRequestedDirectives, ...(userSelectedExampleDirectives || [])]
             .filter((d): d is string => typeof d === 'string' && d.trim() !== '') // Ensure only valid strings
        )];


        if (directivesToFetch.length > 0) {
            console.log(`[API generate-tool] Fetching examples for: ${directivesToFetch.join(', ')}`);
            exampleFileContext += "\n\n--- Relevant Example File Content ---\n";
            for (const directive of directivesToFetch) {
                 const files = await getExampleFileContent(directive);
                 if (files.length > 0) {
                    exampleFileContext += `\nExample Tool: ${directive}\n`;
                    files.forEach(file => {
                        // Add syntax highlighting hint based on file extension
                        const lang = file.filePath.split('.').pop() || '';
                        exampleFileContext += `\n\`\`\`${lang}\n// File: ${file.filePath}\n${file.content}\n\`\`\`\n`;
                    });
                 }
            }
             exampleFileContext += "\n--- End Example File Content ---\n";
        } else {
            console.log(`[API generate-tool] No specific example directives provided or found.`);
            exampleFileContext = "\nNo specific existing tool examples were requested or found.\n";
        }


        // --- Prepare Core Project Context ---
        console.log(`[API generate-tool] Reading core context files...`);
        let coreContextContent = "\n\n--- Core Project Definitions (Types, Hooks, Contexts, Utils, Constants) ---\n";
        for (const filePath of CORE_CONTEXT_FILES) {
            const fullPath = path.join(process.cwd(), filePath);
            try {
                const content = await fs.readFile(fullPath, 'utf-8');
                // Add syntax highlighting hint based on file extension
                const lang = filePath.split('.').pop() || '';
                coreContextContent += `\n\`\`\`${lang}\n// File: ${filePath}\n${content}\n\`\`\`\n`;
                console.log(`[API generate-tool]   Added context: ${filePath}`);
            } catch (error: unknown) {
                const isFsError = typeof error === 'object' && error !== null && 'code' in error;
                const errorCode = isFsError ? (error as { code: string }).code : null;
                if (errorCode === 'ENOENT') {
                    console.warn(`[API generate-tool] Core context file not found: ${filePath}`);
                    coreContextContent += `\n// File: ${filePath} (Not Found)\n`; // Note in context
                } else {
                    const message = error instanceof Error ? error.message : String(error);
                    console.error(`[API generate-tool] Error reading core context file ${filePath}:`, message);
                    coreContextContent += `\n// File: ${filePath} (Error Reading)\n`; // Note in context
                }
            }
        }
        coreContextContent += "\n--- End Core Project Definitions ---\n";
        console.log(`[API generate-tool] Finished reading core context files.`);
        // --- End Core Project Context ---


        // --- Gemini Interaction ---
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: modelName });

        const generationConfig: GenerationConfig = {
            temperature: 0.7, // Keep some creativity
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192, // Use max allowed by model if needed
            responseMimeType: "application/json",
        };

        const safetySettings: SafetySetting[] = [
             { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
             { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
             { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
             { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ];

        const componentName = toPascalCase(toolDirective);
        const clientComponentPath = `app/tool/${toolDirective}/_components/${componentName}Client.tsx`;
        const serverComponentPath = `app/tool/${toolDirective}/page.tsx`;
        const metadataPath = `app/tool/${toolDirective}/metadata.json`;

        // --- UPDATED PROMPT ---
        const prompt = `You are an expert Next.js developer tasked with generating code for the "Online Everything Tool" project.

**Task:** Generate the necessary code resources for a new client-side utility tool.

**Target Tool Directive:** ${toolDirective}
**AI Generated Description:** ${generativeDescription}
**User Provided Refinements:** ${additionalDescription || "None"}

**Project Structure & Rules:**
1.  **Client-Side Focus:** Core tool logic MUST execute entirely in the user's browser. No backend needed for the main functionality unless explicitly stated otherwise (rare).
2.  **File Structure:** Each tool lives in \`app/tool/<directive>/\`. It requires THREE files:
    *   \`${serverComponentPath}\`: A standard **React Server Component** wrapper. Imports metadata, ToolHeader, ToolSuspenseWrapper, and the client component. Renders these, passing props (\`toolTitle\`, \`toolRoute\`, potentially \`urlStateParams\`) to the client component. Follow patterns from examples.
    *   \`${clientComponentPath}\`: The **React Client Component** (\`'use client';\`). Contains all state (useState), logic (handlers, effects), and UI (HTML/Shoelace). Accepts props like \`toolTitle\`, \`toolRoute\`, \`urlStateParams\`. Use hooks defined in the Core Project Definitions below (like useToolUrlState, useHistory).
    *   \`${metadataPath}\`: Contains tool metadata (title, description, urlStateParams if suitable). Use the 'ToolMetadata' type defined in the Core Project Definitions.
3.  **UI:** Use standard HTML elements or Shoelace Web Components (\`<sl-...>\`). Style with Tailwind CSS using project's \`rgb(var(--color-...))\` variables. Keep UI clean and functional.
4.  **State Management:** Use React hooks (useState, useCallback, useEffect, useMemo, useRef) within the Client Component.
5.  **URL State Syncing (\`useToolUrlState\`):**
    *   If simple state (text, bools, numbers, simple JSON) needs persistence, define \`urlStateParams\` in \`metadata.json\` according to the 'ParamConfig' type. DO NOT use for file inputs or very complex state.
    *   If \`urlStateParams\` is defined, the Client Component MUST import and use the \`useToolUrlState\` hook (definition provided below). Create a \`stateSetters\` object mapping \`paramName\` keys to state setter functions.
6.  **History Logging (\`useHistory\`):**
    *   The Client Component MUST import and use the \`useHistory\` hook (context definition provided below).
    *   Call \`addHistoryEntry({ toolName, toolRoute, trigger, input, output, status })\` for significant actions (e.g., button clicks, generation success/failure).
    *   Use appropriate 'TriggerType'.
    *   The \`input\` field MUST be a single object containing **all** relevant parameters/options for that execution (e.g., \`{ text: '...', optionA: true }\`). Use keys matching \`urlStateParams\` where relevant.
    *   The \`output\` field should contain the primary result or error details. Use the 'REDACTED_OUTPUT_PLACEHOLDER' constant if output should be hidden based on restrictive settings (though the API handles this, the component logic should be aware).
    *   Use the 'NewHistoryData' type for the argument structure.
    *   Truncate long text inputs/outputs (> 500 chars) before passing to \`addHistoryEntry\`.
7.  **Types & Constants:** Use the types and constants defined in the Core Project Definitions below where applicable.

${coreContextContent} // <-- INJECTED CORE CONTEXT FILES HERE

**Provided Examples:** (Study these carefully for patterns)
${exampleFileContext} // Example files context inserted here

**Generation Task:**
Generate the FULL, COMPLETE, and VALID source code for the following three files for the new tool "${toolDirective}", strictly adhering to all the rules, types, hooks, and patterns demonstrated above and in the examples:
1.  \`${serverComponentPath}\` (Server Component Wrapper)
2.  \`${clientComponentPath}\` (Client Component with logic and UI)
3.  \`${metadataPath}\` (Metadata JSON as a STRING, including \`urlStateParams\` only if appropriate, conforming to 'ToolMetadata' type)

Also, identify any potential *external* npm libraries needed (beyond React, Next.js, Shoelace, and those defined in the core context like Dexie, uuid, etc.).

**Output Format:**
Return ONLY a valid JSON object adhering EXACTLY to the following structure. Do NOT include any extra text, explanations, or markdown formatting outside the JSON structure itself.
\`\`\`json
{
  "message": "<Brief message about generation success or any warnings>",
  "generatedFiles": {
    "page": "<Full source code for ${serverComponentPath}>",
    "clientComponent": "<Full source code for ${clientComponentPath}>",
    "metadata": "<JSON STRING for ${metadataPath}>"
  },
  "identifiedDependencies": [
    { "packageName": "string", "reason": "string (optional)", "importUsed": "string (optional)" }
  ] // or null if none identified
}
\`\`\`
Ensure the code within "generatedFiles" values is complete and valid source code. Ensure the "metadata" value is a valid & formatted JSON *string*. Do not add comments like "// Content for ..." within the generated code strings unless they are actual necessary code comments.
`;
        // --- END UPDATED PROMPT ---


        const parts = [{ text: prompt }];
        console.log(`[API generate-tool] Sending prompt to ${modelName} for ${toolDirective} (Prompt length: ~${prompt.length} chars)...`);
        // console.log("--- PROMPT START ---"); // Uncomment to debug prompt
        // console.log(prompt);
        // console.log("--- PROMPT END ---");

        const result = await model.generateContent({ contents: [{ role: "user", parts }], generationConfig, safetySettings });

        if (!result.response) {
            throw new Error("Gemini API call failed: No response received.");
        }

        const responseText = result.response.text();
        // console.log("[API generate-tool] Raw Gemini Response Text:", responseText); // Log raw for debug if needed

        // --- Parse Gemini Response ---
        let parsedResponse: GeminiGenerationResponse;
        try {
            // Attempt to directly parse the text which should be JSON according to the prompt
            parsedResponse = JSON.parse(responseText) as GeminiGenerationResponse;
            console.log("[API generate-tool] Successfully parsed Gemini JSON response.");
             if (parsedResponse && parsedResponse.generatedFiles) {
                // Quick check for expected keys
                const fileKeys = Object.keys(parsedResponse.generatedFiles);
                if (!fileKeys.includes('page') || !fileKeys.includes('clientComponent') || !fileKeys.includes('metadata')) {
                     console.warn("[API generate-tool] Parsed response 'generatedFiles' missing expected keys (page, clientComponent, metadata).");
                }
             } else {
                 console.warn("[API generate-tool] Parsed response missing 'generatedFiles' object.");
             }

        } catch (e) {
            console.error("[API generate-tool] Failed to parse Gemini JSON response:", e);
            console.error("[API generate-tool] Response Text Was:", responseText); // Log the text that failed parsing
            // Attempt to clean potentially extraneous markdown ```json ... ``` markers if parsing failed
            const cleanedText = responseText.trim().replace(/^```json\s*|\s*```$/g, '');
            try {
                parsedResponse = JSON.parse(cleanedText) as GeminiGenerationResponse;
                 console.log("[API generate-tool] Successfully parsed Gemini JSON response after cleaning ```json markers.");
            } catch (e2) {
                 console.error("[API generate-tool] Failed to parse Gemini JSON response even after cleaning:", e2);
                 throw new Error("Failed to parse generation response from AI. Response was not valid JSON.");
            }
        }

        // --- Validate Parsed Structure ---
        if (
            typeof parsedResponse !== 'object' || parsedResponse === null ||
            typeof parsedResponse.message !== 'string' ||
            typeof parsedResponse.generatedFiles !== 'object' || parsedResponse.generatedFiles === null ||
            typeof parsedResponse.generatedFiles.page !== 'string' || // Check existence and type
            typeof parsedResponse.generatedFiles.clientComponent !== 'string' ||
            typeof parsedResponse.generatedFiles.metadata !== 'string' ||
            (parsedResponse.identifiedDependencies !== null && !Array.isArray(parsedResponse.identifiedDependencies))
        ) {
            console.error("[API generate-tool] Invalid structure in parsed AI response:", parsedResponse);
            throw new Error("Received malformed generation data structure from AI.");
        }

        // --- Additional validation for metadata string ---
        let parsedMetadata;
        try {
            parsedMetadata = JSON.parse(parsedResponse.generatedFiles.metadata); // Try parsing the metadata string
            // Basic check on parsed metadata structure
             if (typeof parsedMetadata !== 'object' || parsedMetadata === null || typeof parsedMetadata.title !== 'string' || typeof parsedMetadata.description !== 'string') {
                 console.warn("[API generate-tool] Generated metadata JSON string seems to be missing required fields (title, description).");
                 // Don't throw an error here, let it proceed but log warning
             }
        } catch (jsonError) {
             console.error("[API generate-tool] Generated metadata string is not valid JSON:", parsedResponse.generatedFiles.metadata, jsonError);
             // Consider how critical valid metadata JSON is. Maybe still return success but with a warning?
             // For now, let's throw an error as metadata is important.
             throw new Error("AI generated invalid JSON string for metadata.json.");
        }

        // Construct final response structure matching frontend expectations
        const finalResponseData = {
             success: true,
             message: parsedResponse.message,
             generatedFiles: {
                 [serverComponentPath]: parsedResponse.generatedFiles.page,
                 [clientComponentPath]: parsedResponse.generatedFiles.clientComponent,
                 [metadataPath]: parsedResponse.generatedFiles.metadata, // Send the raw JSON string
             },
             identifiedDependencies: parsedResponse.identifiedDependencies,
        };


        return NextResponse.json(finalResponseData, { status: 200 });

    } catch (error: unknown) {
        console.error("[API generate-tool] Error in POST handler:", error);
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
         if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.includes("response was blocked due to safety")) {
              console.warn("[API generate-tool] Generation blocked by safety settings.");
             return NextResponse.json({ success: false, message: "Generation blocked due to safety settings.", error: message }, { status: 400 }); // 400 Bad Request is appropriate
         }
        // Use 500 Internal Server Error for other unexpected errors
        return NextResponse.json({ success: false, message: `Internal Server Error: ${message}`, error: message }, { status: 500 });
    }
}