// --- FILE: app/api/generate-tool-resources/route.ts ---
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
    generatedFiles: Record<string, string> | null; // Key = file path, Value = file content
    identifiedDependencies: LibraryDependency[] | null;
}

// --- Constants ---
const DEFAULT_MODEL_NAME = "gemini-1.5-flash-latest";
const API_KEY = process.env.GEMINI_API_KEY;

// --- Files to add to the core context ---
const CORE_CONTEXT_FILES = [
  // Project Files
  'package.json', 'tsconfig.json',
  // Types
  'src/types/tools.ts', 'src/types/history.ts', 'src/types/image.ts', 'src/types/build.ts',
  // Hooks
  'app/tool/_hooks/useToolUrlState.ts', 'app/tool/_hooks/useImageProcessing.ts',
  // Components (Shared)
  'app/tool/_components/ImageSelectionModal.tsx', // Example of a shared tool component
  // Contexts
  'app/context/HistoryContext.tsx', 'app/context/ImageLibraryContext.tsx',
  // Utils
  'app/lib/utils.ts', 'app/lib/colorUtils.ts', 'app/lib/db.ts',
  // Constants
  'src/constants/charset.ts', 'src/constants/history.ts', 'src/constants/text.ts',
];
// --- End Core Context Files ---


// --- Helper: Convert directive to PascalCase for component name ---
function toPascalCase(kebabCase: string): string {
    if (!kebabCase) return '';
    return kebabCase.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

// --- Helper: Get Content of Example Files ---
async function getExampleFileContent(directive: string): Promise<{ filePath: string; content: string }[]> {
    const filePathsToTry = [
        `app/tool/${directive}/page.tsx`,
        `app/tool/${directive}/_components/${toPascalCase(directive)}Client.tsx`, // Main client component
        `app/tool/${directive}/metadata.json`
        // Note: This helper doesn't automatically fetch potential sub-components or hooks from examples,
        // but the AI prompt encourages looking at the provided example file content.
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


// --- Main API Handler ---
export async function POST(req: NextRequest) {
    if (!API_KEY) {
        console.error("[API generate-tool] Error: GEMINI_API_KEY is not configured.");
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
             .filter((d): d is string => typeof d === 'string' && d.trim() !== '')
        )];


        if (directivesToFetch.length > 0) {
            console.log(`[API generate-tool] Fetching examples for: ${directivesToFetch.join(', ')}`);
            exampleFileContext += "\n\n--- Relevant Example File Content ---\n";
            for (const directive of directivesToFetch) {
                 const files = await getExampleFileContent(directive);
                 if (files.length > 0) {
                    exampleFileContext += `\nExample Tool: ${directive}\n`;
                    files.forEach(file => {
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
        let coreContextContent = "\n\n--- Core Project Definitions ---\n";
        for (const filePath of CORE_CONTEXT_FILES) {
            const fullPath = path.join(process.cwd(), filePath);
            try {
                const content = await fs.readFile(fullPath, 'utf-8');
                const lang = filePath.split('.').pop() || '';
                coreContextContent += `\n\`\`\`${lang}\n// File: ${filePath}\n${content}\n\`\`\`\n`;
                console.log(`[API generate-tool]   Added context: ${filePath}`);
            } catch (error: unknown) {
                const isFsError = typeof error === 'object' && error !== null && 'code' in error;
                const errorCode = isFsError ? (error as { code: string }).code : null;
                if (errorCode === 'ENOENT') {
                    console.warn(`[API generate-tool] Core context file not found: ${filePath}`);
                    coreContextContent += `\n// File: ${filePath} (Not Found)\n`;
                } else {
                    const message = error instanceof Error ? error.message : String(error);
                    console.error(`[API generate-tool] Error reading core context file ${filePath}:`, message);
                    coreContextContent += `\n// File: ${filePath} (Error Reading)\n`;
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
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
        };

        const safetySettings: SafetySetting[] = [
             { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
             { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
             { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
             { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ];

        const componentName = toPascalCase(toolDirective);
        const toolBasePath = `app/tool/${toolDirective}`;
        const serverComponentPath = `${toolBasePath}/page.tsx`;
        const clientComponentPath = `${toolBasePath}/_components/${componentName}Client.tsx`;
        const metadataPath = `${toolBasePath}/metadata.json`;

        // --- Prompt with Decomposition Rule ---
        const prompt = `You are an expert Next.js developer tasked with generating code for the "Online Everything Tool" project.

**Task:** Generate the necessary code resources for a new client-side utility tool.

**Target Tool Directive:** ${toolDirective}
**AI Generated Description:** ${generativeDescription}
**User Provided Refinements:** ${additionalDescription || "None"}

**Project Structure & Rules:**
1.  **Client-Side Focus:** Core tool logic MUST execute entirely in the user's browser. No backend needed for the main functionality unless explicitly stated otherwise (rare).
2.  **Core File Structure:** Each tool lives in \`app/tool/<directive>/\` and typically requires THREE core files:
    *   \`${serverComponentPath}\`: Standard **React Server Component** wrapper. Imports metadata, ToolHeader, ToolSuspenseWrapper, and the main client component. Renders these, passing necessary props. Follow patterns from examples.
    *   \`${clientComponentPath}\`: The main **React Client Component** (\`'use client';\`). Contains core state (useState), logic (handlers, effects), and UI (HTML/Shoelace). Uses provided hooks (useToolUrlState, useHistory, useImageLibrary etc.).
    *   \`${metadataPath}\`: Contains tool metadata (title, description, urlStateParams, outputConfig etc.). Use the 'ToolMetadata' type definition.
3.  **Decomposition (IMPORTANT):** For tools with significant complexity (many states, complex UI sections, intricate logic), **DO NOT put everything into the main Client Component.** Instead, decompose the logic and UI by generating additional helper files:
    *   **Custom Hooks:** If complex state logic, side effects, or reusable calculations are needed *specifically for this tool*, create custom hooks. Place them in \`${toolBasePath}/_hooks/<hookName>.ts\`. (e.g., \`${toolBasePath}/_hooks/useMontageState.ts\`).
    *   **Sub-Components:** If the UI is complex, break it down into smaller, focused presentational components. Place them in \`${toolBasePath}/_components/<ComponentName>.tsx\`. (e.g., \`${toolBasePath}/_components/ImageAdjustmentCard.tsx\`). The main Client Component should then import and use these.
4.  **UI:** Use standard HTML elements or Shoelace Web Components (\`<sl-...>\`). Style with Tailwind CSS using project's \`rgb(var(--color-...))\` variables. Keep UI clean and functional.
5.  **State Management:** Use React hooks (useState, useCallback, useEffect, useMemo, useRef) within Client Components or Custom Hooks.
6.  **URL State Syncing (\`useToolUrlState\`):** If simple state needs persistence, define \`urlStateParams\` in \`metadata.json\` and use the \`useToolUrlState\` hook in the Client Component.
7.  **History Logging (\`useHistory\`):** The Client Component (or relevant hook) MUST import and use the \`useHistory\` hook. Call \`addHistoryEntry({ toolName, toolRoute, trigger, input, output, status })\` for significant actions. Format \`input\` and \`output\` appropriately (use \`imageId\` in output if applicable and configure \`outputConfig\` in metadata). Truncate long text.
8.  **Types & Constants:** Use the types and constants defined in the Core Project Definitions below.

${coreContextContent}

**Provided Examples:** (Study these carefully for patterns, including potential decomposition in complex examples if provided)
${exampleFileContext}

**Generation Task:**
Generate the FULL, COMPLETE, and VALID source code for the new tool "${toolDirective}", strictly adhering to all the rules, types, hooks, and patterns demonstrated above and in the examples.
This includes generating the **three core files** (\`${serverComponentPath}\`, \`${clientComponentPath}\`, \`${metadataPath}\`) AND **any necessary additional custom hook or sub-component files** (in \`${toolBasePath}/_hooks/\` or \`${toolBasePath}/_components/\`) if the tool's complexity warrants decomposition according to Rule #3.

Also, identify any potential *external* npm libraries needed (beyond React, Next.js, Shoelace, and those defined in the core context like Dexie, uuid, etc.).

**Output Format:**
Return ONLY a valid JSON object adhering EXACTLY to the following structure. Do NOT include any extra text, explanations, or markdown formatting outside the JSON structure itself.
The \`generatedFiles\` object MUST be a map where keys are the full relative file paths from the project root (e.g., "app/tool/my-tool/page.tsx", "app/tool/my-tool/_components/MyToolClient.tsx", "app/tool/my-tool/_hooks/useLogic.ts") and values are the complete source code strings for EACH generated file.
The value for the metadata file (\`app/tool/<directive>/metadata.json\`) MUST be a valid JSON *string*.
\`\`\`json
{
  "message": "<Brief message about generation success or any warnings>",
  "generatedFiles": {
    "app/tool/your-tool-directive/page.tsx": "<Full source code for server component wrapper>",
    "app/tool/your-tool-directive/_components/YourToolDirectiveClient.tsx": "<Full source code for main client component>",
    "app/tool/your-tool-directive/metadata.json": "<JSON STRING for metadata file>",
    // --- OPTIONAL FILES (Include ONLY if generated based on complexity) ---
    "app/tool/your-tool-directive/_hooks/useSomeToolLogic.ts": "<Full source code for custom hook>",
    "app/tool/your-tool-directive/_components/SubComponentUI.tsx": "<Full source code for sub-component>"
    // --- Add more optional files here as needed ---
  },
  "identifiedDependencies": [
    { "packageName": "string", "reason": "string (optional)", "importUsed": "string (optional)" }
  ] // or null if none identified
}
\`\`\`
Ensure the code within "generatedFiles" values is complete and valid source code. Ensure the "metadata" value is a valid JSON *string*. Do not add comments like "// Content for ..." within the generated code strings unless they are actual necessary code comments.
`;
        // --- End Prompt ---


        const parts = [{ text: prompt }];
        console.log(`[API generate-tool] Sending prompt to ${modelName} for ${toolDirective} (Prompt length: ~${prompt.length} chars)...`);

        const result = await model.generateContent({ contents: [{ role: "user", parts }], generationConfig, safetySettings });

        if (!result.response) {
            throw new Error("Gemini API call failed: No response received.");
        }

        const responseText = result.response.text();
        // Log raw response *before* parsing attempt
        console.log("--- RAW AI Response Text ---");
        console.log(responseText);
        console.log("--- END RAW AI Response Text ---");

        // --- Parse Gemini Response ---
        let parsedResponse: GeminiGenerationResponse;
        try {
            // Attempt to directly parse (or clean and parse)
            parsedResponse = JSON.parse(responseText.trim().replace(/^```json\s*|\s*```$/g, '')) as GeminiGenerationResponse;
            console.log("[API generate-tool] Successfully parsed Gemini JSON response.");
             // --- Validate structure (checks if generatedFiles exists and is an object with >= 3 files) ---
             if (!parsedResponse || typeof parsedResponse.generatedFiles !== 'object' || parsedResponse.generatedFiles === null || Object.keys(parsedResponse.generatedFiles).length < 3) {
                 console.warn("[API generate-tool] Parsed response missing core 'generatedFiles' or insufficient files.", parsedResponse?.generatedFiles);
                 // Log the parsed object that failed validation
                 console.error("[API generate-tool] Parsed object structure:", JSON.stringify(parsedResponse, null, 2));
                 throw new Error("AI response missing expected core generated files or invalid structure.");
             }
             const fileKeys = Object.keys(parsedResponse.generatedFiles);
             if (!fileKeys.includes(serverComponentPath) || !fileKeys.includes(clientComponentPath) || !fileKeys.includes(metadataPath)) {
                  console.warn(`[API generate-tool] Parsed response 'generatedFiles' missing one or more core keys: ${serverComponentPath}, ${clientComponentPath}, ${metadataPath}`);
                  // Allowing this to proceed as a warning, as the core check is for >= 3 files
             }
             // --- End Validation ---

        } catch (e) {
            console.error("[API generate-tool] Failed to parse Gemini JSON response:", e);
            // Response text already logged above
            throw new Error("Failed to parse generation response from AI. Response was not valid JSON.");
        }

        // --- Validate Parsed Structure (Corrected check for dependencies) ---
        if (
            typeof parsedResponse.message !== 'string' ||
            typeof parsedResponse.generatedFiles !== 'object' || // null checked during parsing
            !Object.values(parsedResponse.generatedFiles).every(content => typeof content === 'string') ||
            // Correctly checks if dependencies exists AND is not null AND is not an array
            (
                parsedResponse.identifiedDependencies !== undefined &&
                parsedResponse.identifiedDependencies !== null &&
                !Array.isArray(parsedResponse.identifiedDependencies)
            )
        ) {
            console.error("[API generate-tool] Invalid structure in parsed AI response (after initial parse):", parsedResponse);
            throw new Error("Received malformed generation data structure from AI.");
        }
        // --- End Validation ---


        // --- Additional validation for metadata string ---
        let parsedMetadata;
        const metadataContent = parsedResponse.generatedFiles[metadataPath]; // Get metadata string using path
        if (typeof metadataContent !== 'string') {
             // This check is now more important as core file presence was relaxed slightly above
             console.error(`[API generate-tool] Metadata content missing or not a string at path: ${metadataPath}`);
             throw new Error(`AI response missing metadata content string at path: ${metadataPath}`);
        }
        try {
            parsedMetadata = JSON.parse(metadataContent); // Parse the string value
             // Basic check on parsed metadata structure
             if (typeof parsedMetadata !== 'object' || parsedMetadata === null || typeof parsedMetadata.title !== 'string' || typeof parsedMetadata.description !== 'string') {
                 console.warn("[API generate-tool] Generated metadata JSON string seems to be missing required fields (title, description).");
                 // Don't throw an error here, let it proceed but log warning
             }
        } catch (jsonError) {
             console.error("[API generate-tool] Generated metadata string is not valid JSON:", metadataContent, jsonError);
             // Consider how critical valid metadata JSON is. Throw error for now.
             throw new Error("AI generated invalid JSON string for metadata.json.");
        }

        // Construct final response structure
        const finalResponseData = {
             success: true,
             message: parsedResponse.message,
             generatedFiles: parsedResponse.generatedFiles, // Pass the map directly
             // Use nullish coalescing to ensure it's null or an array
             identifiedDependencies: parsedResponse.identifiedDependencies ?? null,
        };


        return NextResponse.json(finalResponseData, { status: 200 });

    } catch (error: unknown) {
        // Restore full error handling
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
// --- END FILE: app/api/generate-tool-resources/route.ts ---