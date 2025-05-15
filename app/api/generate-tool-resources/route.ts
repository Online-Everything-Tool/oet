// --- FILE: app/api/generate-tool-resources/route.ts ---
import { NextRequest, NextResponse } from 'next/server';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerationConfig,
  SafetySetting,
} from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';

interface RequestBody {
  toolDirective: string;
  generativeDescription: string;
  additionalDescription?: string;
  modelName?: string;
  generativeRequestedDirectives?: string[];
  userSelectedExampleDirectives?: string[] | null;
}

interface LibraryDependency {
  packageName: string;
  reason?: string;
  importUsed?: string;
}

interface GeminiGenerationResponse {
  message: string;
  generatedFiles: Record<string, string> | null;
  identifiedDependencies: LibraryDependency[] | null;
}

const DEFAULT_MODEL_NAME = 'gemini-1.5-flash-latest';
const API_KEY = process.env.GEMINI_API_KEY;

const CORE_CONTEXT_FILES = [
  'package.json',
  'tsconfig.json',
  'app/layout.tsx',
  'app/globals.css',

  'src/types/tools.ts',
  'src/types/storage.ts',

  'app/tool/_hooks/useToolState.ts',
  'app/tool/_hooks/useToolUrlState.ts',
  'app/tool/_hooks/useImageProcessing.ts',

  'app/tool/_components/form/Button.tsx',
  'app/tool/_components/form/Checkbox.tsx',
  'app/tool/_components/form/Input.tsx',
  'app/tool/_components/form/RadioGroup.tsx',
  'app/tool/_components/form/Select.tsx',
  'app/tool/_components/form/Textarea.tsx',
  'app/tool/_components/form/Range.tsx',
  'app/tool/_components/file-storage/FileSelectionModal.tsx',
  'app/tool/_components/shared/FilenamePromptModal.tsx',

  'app/context/FileLibraryContext.tsx',
  'app/context/ImageLibraryContext.tsx',
  'app/context/MetadataContext.tsx',

  'app/lib/itdeSignalStorageUtils.ts',
  'app/tool/_hooks/useItdeDiscovery.ts',
  'app/tool/_hooks/useItdeTargetHandler.ts',

  'app/tool/_components/shared/SendToToolButton.tsx',
  'app/tool/_components/shared/IncomingDataModal.tsx',
  'app/tool/_components/shared/ReceiveItdeDataTrigger.tsx',

  'app/lib/utils.ts',
  'app/lib/colorUtils.ts',
  'app/lib/db.ts',

  'src/constants/charset.ts',
  'src/constants/text.ts',
];

function toPascalCase(kebabCase: string): string {
  if (!kebabCase) return '';
  return kebabCase
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

async function getExampleFileContent(
  directive: string
): Promise<{ filePath: string; content: string }[]> {
  const toolDirectoryPath = path.join(process.cwd(), 'app', 'tool', directive);
  const results: { filePath: string; content: string }[] = [];

  try {
    await fs.access(toolDirectoryPath);

    const getAllFiles = async (
      dirPath: string,
      baseDirForRelativePath: string
    ): Promise<void> => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await getAllFiles(fullPath, baseDirForRelativePath);
        } else if (entry.isFile()) {
          const relativePathToToolRoot = path.relative(
            baseDirForRelativePath,
            fullPath
          );

          const projectRelativePath = path
            .join('app', 'tool', directive, relativePathToToolRoot)
            .replace(/\\/g, '/');
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            results.push({ filePath: projectRelativePath, content });
          } catch (readError: unknown) {
            const message =
              readError instanceof Error
                ? readError.message
                : String(readError);
            console.warn(
              `[API generate-tool/getExample] Error reading file ${projectRelativePath} for tool ${directive}:`,
              message
            );
          }
        }
      }
    };
    await getAllFiles(toolDirectoryPath, toolDirectoryPath);
  } catch (dirError: unknown) {
    const isFsError =
      typeof dirError === 'object' && dirError !== null && 'code' in dirError;
    const errorCode = isFsError ? (dirError as { code: string }).code : null;
    if (errorCode === 'ENOENT') {
      console.log(
        `[API generate-tool/getExample] Example tool directory not found: app/tool/${directive}`
      );
    } else {
      const message =
        dirError instanceof Error ? dirError.message : String(dirError);
      console.warn(
        `[API generate-tool/getExample] Error accessing example tool directory app/tool/${directive}:`,
        message
      );
    }
    return [];
  }
  results.sort((a, b) => a.filePath.localeCompare(b.filePath));
  return results;
}

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    console.error(
      '[API generate-tool] Error: GEMINI_API_KEY is not configured.'
    );
    return NextResponse.json(
      { success: false, message: 'API key not configured' },
      { status: 500 }
    );
  }

  try {
    const body: RequestBody = await req.json();
    const {
      toolDirective,
      generativeDescription,
      additionalDescription,
      modelName = DEFAULT_MODEL_NAME,
      generativeRequestedDirectives = [],
      userSelectedExampleDirectives,
    } = body;

    if (!toolDirective || !generativeDescription) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Missing required fields: toolDirective or generativeDescription.',
        },
        { status: 400 }
      );
    }

    let exampleFileContext = '';
    const directivesToFetch = [
      ...new Set(
        [
          ...generativeRequestedDirectives,
          ...(userSelectedExampleDirectives || []),
        ].filter((d): d is string => typeof d === 'string' && d.trim() !== '')
      ),
    ];

    if (directivesToFetch.length > 0) {
      console.log(
        `[API generate-tool] Fetching examples for: ${directivesToFetch.join(', ')}`
      );
      exampleFileContext += '\n\n--- Relevant Example File Content ---\n';
      for (const directive of directivesToFetch) {
        const files = await getExampleFileContent(directive);
        if (files.length > 0) {
          exampleFileContext += `\nExample Tool: ${directive}\n`;
          files.forEach((file) => {
            const lang = file.filePath.split('.').pop() || '';
            exampleFileContext += `\n\`\`\`${lang}\n// File: ${file.filePath}\n${file.content}\n\`\`\`\n`;
          });
        } else {
          exampleFileContext += `\n// No files found or error reading for example tool: ${directive}\n`;
        }
      }
      exampleFileContext += '\n--- End Example File Content ---\n';
    } else {
      console.log(
        `[API generate-tool] No specific example directives provided or found.`
      );
      exampleFileContext =
        '\nNo specific existing tool examples were requested or found.\n';
    }

    console.log(`[API generate-tool] Reading core context files...`);
    let coreContextContent = '\n\n--- Core Project Definitions ---\n';
    for (const filePath of CORE_CONTEXT_FILES) {
      const fullPath = path.join(process.cwd(), filePath);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const lang = filePath.split('.').pop() || '';
        coreContextContent += `\n\`\`\`${lang}\n// File: ${filePath}\n${content}\n\`\`\`\n`;
      } catch (error: unknown) {
        const isFsError =
          typeof error === 'object' && error !== null && 'code' in error;
        const errorCode = isFsError ? (error as { code: string }).code : null;
        if (errorCode === 'ENOENT') {
          console.warn(
            `[API generate-tool] Core context file not found: ${filePath}`
          );
          coreContextContent += `\n// File: ${filePath} (Not Found)\n`;
        } else {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[API generate-tool] Error reading core context file ${filePath}:`,
            message
          );
          coreContextContent += `\n// File: ${filePath} (Error Reading)\n`;
        }
      }
    }
    coreContextContent += '\n--- End Core Project Definitions ---\n';
    console.log(`[API generate-tool] Finished reading core context files.`);

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    const generationConfig: GenerationConfig = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    };

    const safetySettings: SafetySetting[] = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ];

    const componentName = toPascalCase(toolDirective);
    const toolBasePath = `app/tool/${toolDirective}`;
    const serverComponentPath = `${toolBasePath}/page.tsx`;
    const clientComponentPath = `${toolBasePath}/_components/${componentName}Client.tsx`;
    const metadataPath = `${toolBasePath}/metadata.json`;

    const prompt = `
You are an expert Next.js developer tasked with generating code for the "Online Everything Tool" project.

**Task:** Generate the necessary code resources for a new client-side utility tool.

**Target Tool Directive:** ${toolDirective}
**AI Generated Description:** ${generativeDescription}
**User Provided Refinements:** ${additionalDescription || 'None'}

**Project Structure & Rules:**
1.  **Client-Side Focus:** Core tool logic MUST execute entirely in the user's browser. No backend needed for the main functionality unless explicitly stated otherwise (rare).
2.  **Core File Structure:** Each tool lives in \`app/tool/<directive>/\` and typically requires THREE core files:
    *   \`${serverComponentPath}\`: Standard React Server Component wrapper. Imports metadata, ToolHeader, ToolSuspenseWrapper, and the main client component. Renders these, passing necessary props. Follow patterns from examples.
    *   \`${clientComponentPath}\`: Main Client Component named \`${componentName}Client.tsx\`. Contains core state (useState), logic (handlers, effects), and UI (HTML).
    *   \`${metadataPath}\`: Contains tool metadata (title, description, inputConfig, outputConfig etc.). Use the 'ToolMetadata' type definition from \`src/types/tools.ts\`.
3.  **Decomposition (IMPORTANT):** For tools with significant complexity (many states, complex UI sections, intricate logic), DO NOT put everything into the main Client Component. Instead, decompose by generating additional helper files:
    *   **Custom Hooks:** For tool-specific complex state logic, side effects, or reusable calculations, create custom hooks in \`${toolBasePath}/_hooks/<hookName>.ts\`.
    *   **Sub-Components:** For complex UI sections, break them into smaller, focused presentational components in \`${toolBasePath}/_components/<SubComponentName>.tsx\`.
4.  **UI:** Use standard HTML elements. Style with Tailwind CSS using project's CSS variables from \`app/globals.css\` (e.g., \`rgb(var(--color-text-base))\`). Keep UI clean and functional.
5.  **State Management:**
    *   Primary tool state (inputs, outputs that need to persist, user settings for the tool) MUST use the \`useToolState\` hook for persistence in Dexie. Structure the state object logically.
    *   Simple state that represents a meaningful input, configuration, or result that could be shared between users via a URL link can use the \`useToolUrlState\` hook. Define corresponding \`urlStateParams\` in \`metadata.json\` for such cases. For most other internal tool state and primary input/output references, prefer \`useToolState\`.
    *   Standard React hooks (useState, useCallback, useEffect, etc.) should be used for local component state.
6.  **Inter-Tool Data Exchange (ITDE) - CRUCIAL:** New tools should be designed to participate in ITDE where applicable.
    *   **Metadata Configuration:** The \`metadata.json\` file MUST accurately define its \`inputConfig\` (array) and \`outputConfig\` (object). Refer to \`src/types/tools.ts\`. This is vital for discovery.
        *   \`inputConfig\` should list MIME types the tool can receive (e.g., "image/*", "text/plain").
        *   \`outputConfig\` should describe the \`dataType\` (e.g., "fileReference", "text", "none"), any relevant state keys from the tool's \`useToolState\` (like \`processedFileId\` or \`outputText\`) for accessing the output, and the \`fileCategory\` if applicable.
    *   **Sending Data:** If the tool produces shareable output, its Client Component should implement UI elements (e.g., a "Send To..." button) that allow users to select a compatible target tool. This involves using discovery mechanisms (see \`useItdeDiscovery\` hook pattern in examples) and signaling the target tool (see \`itdeSignalStorageUtils.ts\` patterns in examples).
    *   **Receiving Data:** If the tool accepts data via ITDE, its Client Component should:
        *   Employ a handler (see \`useItdeTargetHandler\` hook pattern in examples) to detect incoming signals.
        *   Provide a UI mechanism (e.g., a modal) for the user to accept or ignore incoming data.
        *   When data is accepted (e.g., in an \`onProcessSignal\` callback), the tool must fetch the data from the source tool. This involves:
            1.  Consulting the source tool's \`outputConfig\` (via \`MetadataContext\`).
            2.  Retrieving the source tool's persisted state (from Dexie, likely using \`FileLibraryContext\` to get the state file by the source's state ID: \`state-<sourceDirective>\`).
            3.  Extracting the specific output data (e.g., a \`processedFileId\` or \`outputText\` value) from that source state.
            4.  Setting the current tool's own input state (e.g., using its \`setToolState\` to update a \`selectedFileId\` or input text field) with the received data, and then triggering its own processing logic if appropriate.
7.  **Shared Components & Hooks:** Utilize the provided shared components (e.g., \`Button\`, \`Input\`, \`FileSelectionModal\`) and hooks (e.g., \`useImageProcessing\`, \`useFileLibrary\`) from the Core Project Definitions where appropriate. Study their usage in the examples.

${coreContextContent}

**Provided Examples:** (Study these carefully for patterns, including state management, ITDE implementation, UI component usage, and decomposition. The examples provide the full source code for each listed example tool.)
${exampleFileContext}

**Generation Task:**
Generate the FULL, COMPLETE, and VALID source code for the new tool "${toolDirective}", strictly adhering to all the rules, ITDE patterns, types, hooks, and components demonstrated above and in the examples/core context.
This includes generating the **three core files** (\`${serverComponentPath}\`, \`${clientComponentPath}\`, \`${metadataPath}\`) AND **any necessary additional custom hook or sub-component files** (in \`${toolBasePath}/_hooks/\` or \`${toolBasePath}/_components/\`) if the tool's complexity warrants decomposition according to Rule #3.
Ensure the \`metadata.json\` file always includes \`inputConfig\` (as an array) and \`outputConfig\` (as an object), as these are mandatory fields. If a tool does not accept any specific inputs, provide an empty array for \`inputConfig\` (e.g., \`"inputConfig": []\`). If a tool does not have a transferable output, use \`"outputConfig": { "transferableContent": { "dataType": "none" } }\`.

Also, identify any potential *external* npm libraries needed (beyond React, Next.js, and those defined in the core context like Dexie, uuid, etc.).

**Output Format:**
Return ONLY a valid JSON object adhering EXACTLY to the following structure. Do NOT include any extra text, explanations, or markdown formatting outside the JSON structure itself.
The \`generatedFiles\` object MUST be a map where keys are the full relative file paths from the project root (e.g., "app/tool/${toolDirective}/page.tsx", "app/tool/${toolDirective}/_components/${componentName}Client.tsx", "app/tool/${toolDirective}/_hooks/useLogic.ts") and values are the complete source code strings for EACH generated file.
The value for the metadata file (\`app/tool/${toolDirective}/metadata.json\`) MUST be a valid JSON *string*.
\`\`\`json
{
  "message": "<Brief message about generation success or any warnings>",
  "generatedFiles": {
    "app/tool/${toolDirective}/page.tsx": "<Full source code for server component wrapper>",
    "app/tool/${toolDirective}/_components/${componentName}Client.tsx": "<Full source code for main client component>",
    "app/tool/${toolDirective}/metadata.json": "<JSON STRING for metadata file>"
  },
  "identifiedDependencies": [
    { "packageName": "string", "reason": "string (optional)", "importUsed": "string (optional)" }
  ]
}
\`\`\`
Ensure the code within "generatedFiles" values is complete and valid source code. Ensure the "metadata" value is a valid JSON *string*. Do not add comments like "// Content for ..." within the generated code strings unless they are actual necessary code comments.
`;

    const parts = [{ text: prompt }];
    console.log(
      `[API generate-tool] Sending prompt to ${modelName} for ${toolDirective} (Prompt length: ~${prompt.length} chars)...`
    );

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig,
      safetySettings,
    });

    if (!result.response) {
      throw new Error('Gemini API call failed: No response received.');
    }
    const responseText = result.response.text();
    console.log('--- RAW AI Response Text (generate-tool-resources) ---');

    console.log(
      `--- END RAW AI Response Text (length: ${responseText.length}) ---`
    );

    let parsedResponse: GeminiGenerationResponse;
    try {
      parsedResponse = JSON.parse(
        responseText.trim().replace(/^```json\s*|\s*```$/g, '')
      ) as GeminiGenerationResponse;
      console.log(
        '[API generate-tool] Successfully parsed Gemini JSON response.'
      );

      if (
        !parsedResponse ||
        typeof parsedResponse.generatedFiles !== 'object' ||
        parsedResponse.generatedFiles === null ||
        Object.keys(parsedResponse.generatedFiles).length < 3
      ) {
        console.warn(
          "[API generate-tool] Parsed response missing core 'generatedFiles' or insufficient files.",
          parsedResponse?.generatedFiles
        );
        throw new Error(
          'AI response missing expected core generated files or invalid structure.'
        );
      }
      const fileKeys = Object.keys(parsedResponse.generatedFiles);
      if (
        !fileKeys.includes(serverComponentPath) ||
        !fileKeys.includes(clientComponentPath) ||
        !fileKeys.includes(metadataPath)
      ) {
        console.warn(
          `[API generate-tool] Parsed response 'generatedFiles' missing one or more core keys: ${serverComponentPath}, ${clientComponentPath}, ${metadataPath}. Found: ${fileKeys.join(', ')}`
        );
      }
    } catch (e) {
      console.error(
        '[API generate-tool] Failed to parse Gemini JSON response:',
        e,
        '\nRaw Response Text Snippet:\n',
        responseText.substring(0, 1000) + '...'
      );
      throw new Error(
        'Failed to parse generation response from AI. Response was not valid JSON or had unexpected structure.'
      );
    }

    if (
      typeof parsedResponse.message !== 'string' ||
      typeof parsedResponse.generatedFiles !== 'object' ||
      !Object.values(parsedResponse.generatedFiles).every(
        (content) => typeof content === 'string'
      ) ||
      (parsedResponse.identifiedDependencies !== undefined &&
        parsedResponse.identifiedDependencies !== null &&
        !Array.isArray(parsedResponse.identifiedDependencies))
    ) {
      console.error(
        '[API generate-tool] Invalid structure in parsed AI response (after initial parse):',
        parsedResponse
      );
      throw new Error('Received malformed generation data structure from AI.');
    }

    const metadataContent = parsedResponse.generatedFiles[metadataPath];
    if (typeof metadataContent !== 'string') {
      console.error(
        `[API generate-tool] Metadata content missing or not a string at path: ${metadataPath}`
      );
      throw new Error(
        `AI response missing metadata content string at path: ${metadataPath}`
      );
    }
    try {
      const parsedMetadata = JSON.parse(metadataContent);
      if (
        typeof parsedMetadata !== 'object' ||
        parsedMetadata === null ||
        typeof parsedMetadata.title !== 'string' ||
        typeof parsedMetadata.description !== 'string' ||
        !Array.isArray(parsedMetadata.inputConfig) ||
        typeof parsedMetadata.outputConfig !== 'object'
      ) {
        console.warn(
          '[API generate-tool] Generated metadata JSON string missing required fields (title, description, inputConfig, outputConfig) or wrong types.'
        );
      }
    } catch (jsonError) {
      console.error(
        '[API generate-tool] Generated metadata string is not valid JSON:',
        metadataContent,
        jsonError
      );
      throw new Error('AI generated invalid JSON string for metadata.json.');
    }

    const finalResponseData = {
      success: true,
      message: parsedResponse.message,
      generatedFiles: parsedResponse.generatedFiles,
      identifiedDependencies: parsedResponse.identifiedDependencies ?? null,
    };

    return NextResponse.json(finalResponseData, { status: 200 });
  } catch (error: unknown) {
    console.error('[API generate-tool] Error in POST handler:', error);
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string' &&
      error.message.includes('response was blocked due to safety')
    ) {
      console.warn(
        '[API generate-tool] Generation blocked by safety settings.'
      );
      return NextResponse.json(
        {
          success: false,
          message: 'Generation blocked due to safety settings.',
          error: message,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        message: `Internal Server Error: ${message}`,
        error: message,
      },
      { status: 500 }
    );
  }
}
