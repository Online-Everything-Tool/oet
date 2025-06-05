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

import bundledCoreContextData from './_contexts/_core_context_files.json';
import type { GenerationResult } from '@/src/types/build';

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

interface ClientResponsePayload extends GenerationResult {
  success: boolean;
  error?: string;
}

const DEFAULT_MODEL_NAME =
  process.env.DEFAULT_GEMINI_MODEL_NAME || 'models/gemini-1.5-flash-latest';
const API_KEY = process.env.GEMINI_API_KEY;

function directiveToSnakeCase(directive: string): string {
  return directive.replace(/-/g, '_');
}

function formatFileContentObjectForPrompt(
  filesObject: Record<string, string>,
  sectionTitleSegment: string
): string {
  let contentString = `\n\n--- START ${sectionTitleSegment.toUpperCase()} ---\n`;
  if (Object.keys(filesObject).length === 0) {
    contentString += `// No files found for ${sectionTitleSegment}.\n`;
  }
  for (const [filePath, content] of Object.entries(filesObject)) {
    const lang = filePath.split('.').pop() || '';
    contentString += `\n\`\`\`${lang}\n// File: ${filePath}\n${content}\n\`\`\`\n`;
  }
  contentString += `\n--- END ${sectionTitleSegment.toUpperCase()} ---\n`;
  return contentString;
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

function toPascalCase(kebabCase: string): string {
  if (!kebabCase) return '';
  return kebabCase
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function parseDelimitedAIResponse(
  responseText: string
): Omit<ClientResponsePayload, 'success' | 'error'> {
  const generatedFiles: Record<string, string> = {};
  let identifiedDependencies: LibraryDependency[] = [];
  let assetInstructions: string | null = null;
  let message =
    'AI processing complete, but message section was not found in the response.';

  const fileRegex = /---START_FILE:(.*?)---([\s\S]*?)---END_FILE:\1---/g;
  let match;
  while ((match = fileRegex.exec(responseText)) !== null) {
    const filePath = match[1].trim();
    const fileContent = match[2].trim();
    generatedFiles[filePath] = fileContent;
  }

  console.log('generatedFiles length:', Object.keys(generatedFiles).length);

  const depsRegex = /---START_DEPS---([\s\S]*?)---END_DEPS---/;
  const depsMatch = responseText.match(depsRegex);
  if (depsMatch && depsMatch[1]) {
    try {
      const parsedDeps = JSON.parse(depsMatch[1].trim());
      if (Array.isArray(parsedDeps)) {
        identifiedDependencies = parsedDeps.filter(
          (dep: unknown) =>
            typeof dep === 'object' &&
            dep !== null &&
            'packageName' in dep &&
            typeof (dep as { packageName: unknown }).packageName === 'string'
        );
      } else {
        console.warn(
          '[API parseDelimited] Parsed dependencies is not an array, defaulting to empty.'
        );
      }
    } catch (e) {
      console.warn(
        '[API parseDelimited] Failed to parse identifiedDependencies JSON:',
        e,
        `Deps content: "${depsMatch[1].trim()}"`
      );
    }
  }

  console.log('identifiedDependencies length:', identifiedDependencies.length);

  const assetInstructionsRegex =
    /---START_ASSET_INSTRUCTIONS---([\s\S]*?)---END_ASSET_INSTRUCTIONS---/;
  const assetInstructionsMatch = responseText.match(assetInstructionsRegex);
  if (assetInstructionsMatch && assetInstructionsMatch[1]) {
    assetInstructions = assetInstructionsMatch[1].trim();
    if (assetInstructions === '') assetInstructions = null;
  }
  console.log(
    'assetInstructions length:',
    (assetInstructions && assetInstructions.length) || 0
  );

  const messageRegex = /---START_MESSAGE---([\s\S]*?)---END_MESSAGE---/;
  const messageMatch = responseText.match(messageRegex);
  if (messageMatch && messageMatch[1]) {
    message = messageMatch[1].trim();
  }

  console.log('message length:', (message && message.length) || 0);

  if (Object.keys(generatedFiles).length === 0) {
    console.warn(
      "[API parseDelimited] No files extracted from AI's delimited response."
    );
  }

  return { message, generatedFiles, identifiedDependencies, assetInstructions };
}

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      {
        success: false,
        message: 'API key not configured',
        generatedFiles: null,
        identifiedDependencies: null,
        assetInstructions: null,
      } as ClientResponsePayload,
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
            'Missing required fields: toolDirective, generativeDescription',
          generatedFiles: null,
          identifiedDependencies: null,
          assetInstructions: null,
        } as ClientResponsePayload,
        { status: 400 }
      );
    }

    let coreContextContent = '';
    if (
      bundledCoreContextData &&
      Object.keys(bundledCoreContextData).length > 0
    ) {
      coreContextContent = formatFileContentObjectForPrompt(
        bundledCoreContextData as Record<string, string>,
        'Core Project Definitions'
      );
    } else {
      console.warn(
        '[API generate-tool] Bundled core context data is missing or empty.'
      );
      coreContextContent =
        '\n// Critical Error: Bundled core project context was not loaded.\n';
    }

    let exampleFileContext = '';
    const uniqueExampleDirectives = [
      ...new Set(
        [
          ...generativeRequestedDirectives,
          ...(userSelectedExampleDirectives || []),
        ].filter((d): d is string => typeof d === 'string' && d.trim() !== '')
      ),
    ];

    if (uniqueExampleDirectives.length > 0) {
      let exampleContentAccumulator =
        '\n\n--- Relevant Example File Content (Dynamically Loaded based on request) ---\n';
      let examplesFound = 0;
      for (const directive of uniqueExampleDirectives) {
        const snakeCaseDirective = directiveToSnakeCase(directive);
        const toolContextFilename = `_${snakeCaseDirective}.json`;
        const toolContextPath = path.join(
          process.cwd(),
          'app',
          'api',
          'generate-tool-resources',
          '_contexts/tool_contexts',
          toolContextFilename
        );
        try {
          const toolContextJsonString = await fs.readFile(
            toolContextPath,
            'utf-8'
          );
          const toolContextData = JSON.parse(toolContextJsonString) as Record<
            string,
            string
          >;
          if (toolContextData && Object.keys(toolContextData).length > 0) {
            exampleContentAccumulator += `\nExample Tool: ${directive}\n`;
            exampleContentAccumulator += formatFileContentObjectForPrompt(
              toolContextData,
              `Tool: ${directive}`
            );
            examplesFound++;
          } else {
            console.warn(
              `[API generate-tool] Empty or invalid context data for example tool ${directive}`
            );
          }
        } catch (error) {
          console.warn(
            `[API generate-tool] Could not load context for example tool ${directive}: ${error}`
          );
        }
      }
      if (examplesFound > 0) exampleFileContext = exampleContentAccumulator;
      else
        exampleFileContext =
          '\n// No specifically requested example tool contexts were found or loaded.\n';
    } else {
      exampleFileContext =
        '\n// No specific existing tool examples were requested for dynamic loading.\n';
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    const generationConfig: GenerationConfig = {
      temperature: 0.3,
      topK: 20,
      topP: 0.85,
      maxOutputTokens: 16384,
      responseMimeType: 'text/plain',
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
    const coreProjectDefsIntroContent = await readPromptFile(
      '02_core_project_definitions_intro.md'
    );
    const providedExamplesIntroContent = await readPromptFile(
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
      coreProjectDefsIntroContent,
      coreContextContent,
      providedExamplesIntroContent,
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
      throw new Error('Gemini API call failed: No response object received.');
    }
    const responseText = result.response.text();
    if (!responseText || responseText.trim() === '') {
      console.warn(
        '[API generate-tool] Gemini response text is empty or whitespace.'
      );
      const finishReason = result.response.candidates?.[0]?.finishReason;
      throw new Error(
        `AI returned an empty response. Finish Reason: ${finishReason || 'Unknown'}`
      );
    }

    const parsedAIRData = parseDelimitedAIResponse(responseText);

    if (
      !parsedAIRData.generatedFiles ||
      Object.keys(parsedAIRData.generatedFiles).length < 3
    ) {
      console.warn(
        `[API generate-tool] Parsed response missing core 'generatedFiles' or insufficient files (expected at least 3). Files found: ${Object.keys(parsedAIRData.generatedFiles || {}).length}. Raw response: ${responseText.substring(0, 500)}...`
      );
      throw new Error(
        'AI response missing expected core generated files or parsing failed.'
      );
    }

    const metadataContent = parsedAIRData.generatedFiles[metadataPath];
    if (typeof metadataContent !== 'string') {
      throw new Error(
        `AI response missing metadata content string at path: ${metadataPath} (after parsing). Raw file map: ${JSON.stringify(Object.keys(parsedAIRData.generatedFiles))}`
      );
    }
    try {
      const parsedMetadata = JSON.parse(metadataContent);
      if (
        typeof parsedMetadata !== 'object' ||
        !Array.isArray(parsedMetadata.inputConfig) ||
        typeof parsedMetadata.outputConfig !== 'object'
      ) {
        console.warn(
          `[API generate-tool] Parsed metadata.json content is not valid JSON or missing required fields. Content: ${metadataContent.substring(0, 200)}...`
        );
      }
    } catch (jsonError) {
      console.error(
        '[API generate-tool] Generated metadata.json content is not valid JSON:',
        // @ts-expect-error this is needed here
        jsonError.message,
        `Problematic content (first 300 chars): ${metadataContent.substring(0, 300)}...`
      );
      throw new Error(
        'AI generated invalid JSON string for metadata.json content.'
      );
    }

    const finalResponseData: ClientResponsePayload = {
      success: true,
      message: parsedAIRData.message,
      generatedFiles: parsedAIRData.generatedFiles,
      identifiedDependencies: parsedAIRData.identifiedDependencies,
      assetInstructions: parsedAIRData.assetInstructions,
    };
    return NextResponse.json(finalResponseData, { status: 200 });
  } catch (error: unknown) {
    console.error('[API generate-tool] Error in POST handler:', error);
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    const errorPayload: ClientResponsePayload = {
      success: false,
      message: `Internal Server Error: ${message}`,
      error: message,
      generatedFiles: null,
      identifiedDependencies: null,
      assetInstructions: null,
    };
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string' &&
      (error.message
        .toLowerCase()
        .includes('response was blocked due to safety') ||
        error.message.toLowerCase().includes('finish reason: safety'))
    ) {
      console.warn(
        '[API generate-tool] Generation blocked by safety settings.'
      );
      errorPayload.message = 'Generation blocked due to safety settings.';
      return NextResponse.json(errorPayload, { status: 400 });
    }
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string' &&
      (error.message.toLowerCase().includes('max_tokens') ||
        error.message.toLowerCase().includes('finish reason: max_tokens'))
    ) {
      console.warn('[API generate-tool] Generation stopped due to max tokens.');
      errorPayload.message =
        'AI output was too long and got truncated (MAX_TOKENS). Try a more specific request or a model with a larger output limit.';
      return NextResponse.json(errorPayload, { status: 400 });
    }
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string' &&
      error.message.toLowerCase().includes('ai returned an empty response')
    ) {
      console.warn('[API generate-tool] AI returned an empty response.');
      errorPayload.message = `AI returned an empty response. ${message}`;
      return NextResponse.json(errorPayload, { status: 502 });
    }

    return NextResponse.json(errorPayload, { status: 500 });
  }
}
