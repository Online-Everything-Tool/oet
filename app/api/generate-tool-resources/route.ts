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

const DEFAULT_MODEL_NAME =
  process.env.DEFAULT_GEMINI_MODEL_NAME || 'models/gemini-1.5-flash-latest';
const API_KEY = process.env.GEMINI_API_KEY;

const CORE_CONTEXT_FILES = [
  'package.json',
  'tsconfig.json',
  'app/page.tsx',
  'app/layout.tsx',
  'app/globals.css',

  'src/types/tools.ts',
  'src/types/storage.ts',

  'app/lib/db.ts',
  'app/lib/itdeDataUtils.ts',
  'app/lib/sessionStorageUtils.ts',
  'app/lib/utils.ts',

  'app/context/FileLibraryContext.tsx',
  'app/context/MetadataContext.tsx',

  'app/tool/_hooks/useImageProcessing.ts',
  'app/tool/_hooks/useItdeDiscovery.ts',
  'app/tool/_hooks/useItdeTargetHandler.ts',
  'app/tool/_hooks/useToolState.ts',
  'app/tool/_hooks/useToolUrlState.ts',

  'app/tool/_components/form/Button.tsx',
  'app/tool/_components/form/Checkbox.tsx',
  'app/tool/_components/form/Input.tsx',
  'app/tool/_components/form/RadioGroup.tsx',
  'app/tool/_components/form/Range.tsx',
  'app/tool/_components/form/Select.tsx',
  'app/tool/_components/form/Textarea.tsx',

  'app/tool/_components/shared/FilenamePromptModal.tsx',
  'app/tool/_components/shared/FileSelectionModal.tsx',
  'app/tool/_components/shared/IncomingDataModal.tsx',
  'app/tool/_components/shared/ItdeAcceptChoiceModal.tsx',
  'app/tool/_components/shared/ReceiveItdeDataTrigger.tsx',
  'app/tool/_components/shared/SendToToolButton.tsx',
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

async function readPromptFile(filename: string): Promise<string> {
  try {
    const filePath = path.join(
      process.cwd(),
      'app',
      'api',
      'generate-tool-resources',
      '_prompts',
      filename
    );
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading prompt file ${filename}:`, error);
    throw new Error(`Failed to load prompt configuration: ${filename}`);
  }
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
    let coreContextContent = '';
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
    console.log(`[API generate-tool] Finished reading core context files.`);

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    const generationConfig: GenerationConfig = {
      temperature: 0.3,
      topK: 20,
      topP: 0.85,
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

    let taskDefinitionContent = await readPromptFile('00_task_definition.md');
    const projectStructureRulesContent = await readPromptFile(
      '01_project_structure_rules.md'
    );
    const coreDefsIntroContent = await readPromptFile(
      '02_core_project_definitions_intro.md'
    );
    const examplesIntroContent = await readPromptFile(
      '03_provided_examples_intro.md'
    );
    let generationTaskContent = await readPromptFile(
      '04_generation_task_template.md'
    );
    let outputFormatContent = await readPromptFile(
      '05_output_format_template.md'
    );

    taskDefinitionContent = taskDefinitionContent
      .replace(/{{TOOL_DIRECTIVE}}/g, toolDirective)
      .replace(/{{GENERATIVE_DESCRIPTION}}/g, generativeDescription)
      .replace(/{{ADDITIONAL_DESCRIPTION}}/g, additionalDescription || 'None')
      .replace(/{{SERVER_COMPONENT_PATH}}/g, serverComponentPath)
      .replace(/{{CLIENT_COMPONENT_PATH}}/g, clientComponentPath)
      .replace(/{{METADATA_PATH}}/g, metadataPath)
      .replace(/{{TOOL_BASE_PATH}}/g, toolBasePath)
      .replace(/{{COMPONENT_NAME}}/g, componentName);

    generationTaskContent = generationTaskContent
      .replace(/{{TOOL_DIRECTIVE}}/g, toolDirective)
      .replace(/{{SERVER_COMPONENT_PATH}}/g, serverComponentPath)
      .replace(/{{CLIENT_COMPONENT_PATH}}/g, clientComponentPath)
      .replace(/{{METADATA_PATH}}/g, metadataPath)
      .replace(/{{TOOL_BASE_PATH}}/g, toolBasePath)
      .replace(/{{COMPONENT_NAME}}/g, componentName);

    outputFormatContent = outputFormatContent
      .replace(/{{TOOL_DIRECTIVE}}/g, toolDirective)
      .replace(/{{COMPONENT_NAME}}/g, componentName);

    const promptParts = [
      taskDefinitionContent,
      projectStructureRulesContent,
      coreDefsIntroContent,
      coreContextContent,
      examplesIntroContent,
      exampleFileContext,
      generationTaskContent,
      outputFormatContent,
    ];
    const prompt = promptParts.join('\n\n');

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

    console.log(responseText);
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
