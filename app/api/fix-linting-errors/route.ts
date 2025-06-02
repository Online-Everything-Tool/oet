// FILE: app/api/fix-linting-errors/route.ts
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

const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL_NAME =
  process.env.DEFAULT_GEMINI_LINT_FIX_MODEL_NAME ||
  'models/gemini-1.5-flash-latest';

if (!API_KEY) {
  console.error('FATAL ERROR (fix-linting-errors): GEMINI_API_KEY missing.');
}
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

interface FileToFix {
  path: string;
  currentContent: string;
}

interface RequestBody {
  filesToFix: FileToFix[];
  lintErrors: string;
}

interface AiFixedFileResult {
  filePath: string;
  fixedContent: string | null;
  fixDescription: string | null;
}

interface ApiResponse {
  success: boolean;
  message: string;

  fixedFileResults?: Record<string, Omit<AiFixedFileResult, 'filePath'>>;
  error?: string;
}

const generationConfig: GenerationConfig = {
  temperature: 0.2,
  topK: 30,
  topP: 0.8,
  maxOutputTokens: 8192,
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

let promptTemplateCache: string | null = null;

async function getPromptTemplate(): Promise<string> {
  if (promptTemplateCache) {
    return promptTemplateCache;
  }
  try {
    const templatePath = path.join(
      process.cwd(),
      'app',
      'api',
      'fix-linting-errors',
      '_prompts',
      'prompt_template.md'
    );
    promptTemplateCache = await fs.readFile(templatePath, 'utf-8');
    console.log(
      '[API fix-linting-errors] Prompt template loaded successfully.'
    );
    return promptTemplateCache;
  } catch (error) {
    console.error(
      '[API fix-linting-errors] Error reading prompt template:',
      error
    );
    throw new Error('Failed to load prompt template for lint fixing.');
  }
}

function parseNewAIResponseFormat(
  responseText: string,
  expectedFilePath: string
): Omit<AiFixedFileResult, 'filePath'> {
  let fixedContent: string | null = null;
  let fixDescription: string | null = null;

  const fileRegex = new RegExp(
    `---START_FIXED_FILE:${escapeRegex(expectedFilePath)}---([\\s\\S]*?)---END_FIXED_FILE:${escapeRegex(expectedFilePath)}---`
  );
  const fileMatch = responseText.match(fileRegex);
  if (fileMatch && fileMatch[1]) {
    fixedContent = fileMatch[1].trim();
  }

  const descRegex =
    /---START_FIX_DESCRIPTION---([\s\S]*?)---END_FIX_DESCRIPTION---/;
  const descMatch = responseText.match(descRegex);
  if (descMatch && descMatch[1]) {
    fixDescription = descMatch[1].trim();
  } else {
    console.log('[DEBUG] Extracted No fixDescription');
  }

  if (!fixedContent || !fixDescription) {
    console.warn(
      `[API fix-linting-errors] Could not parse new AI response format for ${expectedFilePath}. Response (first 300 chars): ${responseText.substring(0, 300)}`
    );
  } else {
    console.log(
      `[DEBUG] Extracted: ${escapeRegex(expectedFilePath)} length: ${fixedContent.length} with fix description: ${fixDescription}`
    );
  }
  return { fixedContent, fixDescription };
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log(
    `[API fix-linting-errors] Received POST request at ${new Date(requestStartTime).toISOString()}`
  );

  if (!genAI) {
    console.error(
      '[API fix-linting-errors] AI service not configured (GEMINI_API_KEY missing).'
    );
    return NextResponse.json(
      {
        success: false,
        message: 'AI service configuration error (API Key missing).',
        fixedFileResults: {},
      } as ApiResponse,
      { status: 500 }
    );
  }

  let body: RequestBody;
  try {
    body = await request.json();
    const { filesToFix, lintErrors } = body;
    if (!Array.isArray(filesToFix) || filesToFix.length === 0) {
      throw new Error('Missing or empty "filesToFix" array.');
    }
    if (
      !filesToFix.every(
        (f) =>
          typeof f.path === 'string' && typeof f.currentContent === 'string'
      )
    ) {
      throw new Error(
        'Invalid structure in "filesToFix". Each item must have "path" (string) and "currentContent" (string).'
      );
    }
    if (typeof lintErrors !== 'string') {
      console.warn(
        '[API fix-linting-errors] "lintErrors" string is missing or not a string. Treating as empty.'
      );
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Invalid request body format';
    console.error(
      '[API fix-linting-errors] Error parsing request body:',
      message,
      error
    );
    return NextResponse.json(
      {
        success: false,
        message: message,
        error: message,
        fixedFileResults: {},
      } as ApiResponse,
      { status: 400 }
    );
  }

  const { filesToFix, lintErrors: globalLintErrorsInput } = body;
  const modelToUse = DEFAULT_MODEL_NAME;
  const model = genAI.getGenerativeModel({ model: modelToUse });
  const fixedFileResultsAccumulator: Record<
    string,
    Omit<AiFixedFileResult, 'filePath'>
  > = {};

  let anyAiCallAttempted = false;
  let allAttemptedAiCallsSucceeded = true;
  let anyFileActuallyChangedByAI = false;
  let promptTemplate: string;
  const globalLintErrors = (globalLintErrorsInput || '').replace(/\r\n/g, '\n');

  try {
    promptTemplate = await getPromptTemplate();
  } catch (templateError) {
    const errMsg =
      templateError instanceof Error
        ? templateError.message
        : 'Unknown template error';
    return NextResponse.json(
      {
        success: false,
        message: `Failed to load AI prompt configuration: ${errMsg}`,
        error: errMsg,
        fixedFileResults: {},
      } as ApiResponse,
      { status: 500 }
    );
  }

  console.log(
    `[API fix-linting-errors] Attempting to fix ${filesToFix.length} file(s) using model ${modelToUse}.`
  );

  for (const file of filesToFix) {
    const fileProcessStartTime = Date.now();
    console.log(`[API fix-linting-errors] Processing file: ${file.path}`);

    const lines = globalLintErrors.split('\n');
    const rawMessagesBlockForThisFileArray: string[] = [];
    const currentFilePathNormalized = path.normalize(file.path);
    const pathHeaderRegex =
      /^(?:\.\/)?((?:app|src|node_modules)[\w/\-.]+\.(tsx|ts|js|jsx|mjs|cjs))$/i;
    let collectingForCurrentFileTarget = false;

    for (const line of lines) {
      const trimmedLineStart = line.trimStart();
      const trimmedLineFull = line.trim();
      let lineIsPathHeaderForTargetFile = false;
      let lineIsDifferentPathHeader = false;

      const pathMatch = trimmedLineStart.match(pathHeaderRegex);
      if (pathMatch && pathMatch[0] === trimmedLineStart) {
        const matchedPathNormalized = path.normalize(pathMatch[1]);
        if (matchedPathNormalized === currentFilePathNormalized) {
          lineIsPathHeaderForTargetFile = true;
        } else {
          lineIsDifferentPathHeader = true;
        }
      }

      if (lineIsPathHeaderForTargetFile) {
        collectingForCurrentFileTarget = true;
      } else if (lineIsDifferentPathHeader) {
        if (collectingForCurrentFileTarget) {
          collectingForCurrentFileTarget = false;
          break;
        }
      } else if (collectingForCurrentFileTarget && trimmedLineFull) {
        rawMessagesBlockForThisFileArray.push(line);
      }
    }
    const rawErrorBlockForFile = rawMessagesBlockForThisFileArray.join('\n');
    console.log(
      `[API fix-linting-errors] For file ${file.path}, RAW extracted error block (length ${rawErrorBlockForFile.length}):\n---\n${rawErrorBlockForFile}\n---`
    );

    let blockContainsActualError = false;
    const structuredErrorPattern = /^\s*\d+:\d+\s+error\b/i;
    const prefixErrorPattern = /^\s*(Error:|Type error:)/i;
    const toolOutputErrorPattern =
      /-\s*(?:ESLint|TypeScript|eslint|typescript).*\(error\)/i;
    const tsErrorCodePattern = /^\s*error\s+TS\d+:/i;

    if (rawErrorBlockForFile.trim()) {
      for (const lineInBlock of rawMessagesBlockForThisFileArray) {
        const trimmedLineStart = lineInBlock.trimStart();
        const trimmedLineFull = lineInBlock.trim();
        if (
          structuredErrorPattern.test(trimmedLineStart) ||
          prefixErrorPattern.test(trimmedLineStart) ||
          toolOutputErrorPattern.test(trimmedLineFull) ||
          tsErrorCodePattern.test(trimmedLineStart)
        ) {
          blockContainsActualError = true;
          break;
        }
      }
    }
    if (!rawErrorBlockForFile.trim() || !blockContainsActualError) {
      const skipReason = !rawErrorBlockForFile.trim()
        ? 'No error messages found for this file in the lint output'
        : 'The error block for this file does not contain any lines matching critical error patterns.';
      console.log(
        `[API fix-linting-errors] ${skipReason} for ${file.path}. Skipping AI processing.`
      );
      console.log(
        `[API fix-linting-errors] Finished processing ${file.path} in ${Date.now() - fileProcessStartTime}ms (skipped AI).`
      );
      continue;
    }

    anyAiCallAttempted = true;
    const populatedPrompt = promptTemplate
      .replace(/{{FILE_PATH}}/g, file.path)
      .replace(/{{FILE_CONTENT}}/g, file.currentContent)
      .replace(/{{LINT_ERRORS}}/g, rawErrorBlockForFile);

    try {
      console.log(
        `[API fix-linting-errors] Sending to AI for ${file.path}. Prompt length: ~${populatedPrompt.length}`
      );
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: populatedPrompt }] }],
        generationConfig,
        safetySettings,
      });

      if (!result.response) {
        throw new Error(
          `AI analysis failed for ${file.path}: No response object received.`
        );
      }

      const rawResponseText = result.response.text();
      const finishReason = result.response.candidates?.[0]?.finishReason;
      if (finishReason === 'MAX_TOKENS') {
        console.warn(
          `[API fix-linting-errors] AI response for ${file.path} was truncated (MAX_TOKENS).`
        );
      }

      const parsedResult = parseNewAIResponseFormat(rawResponseText, file.path);

      if (
        parsedResult.fixedContent === null &&
        parsedResult.fixDescription === null
      ) {
        console.warn(
          `[API fix-linting-errors] AI did not return content in the expected new format for ${file.path}, or returned empty. Raw text (first 300): ${rawResponseText.substring(0, 300)}`
        );
      } else if (
        parsedResult.fixedContent &&
        parsedResult.fixedContent !== file.currentContent.trim()
      ) {
        fixedFileResultsAccumulator[file.path] = {
          fixedContent: parsedResult.fixedContent,
          fixDescription: parsedResult.fixDescription || 'AI proposed changes.',
        };
        anyFileActuallyChangedByAI = true;
      } else {
        console.log(
          `[API fix-linting-errors] AI proposed no changes for ${file.path} or returned original content. Description: ${parsedResult.fixDescription || '(none)'}`
        );
        if (parsedResult.fixDescription) {
          fixedFileResultsAccumulator[file.path] = {
            fixedContent: file.currentContent,
            fixDescription: parsedResult.fixDescription,
          };
        }
      }
    } catch (error: unknown) {
      const extractedMessage =
        error instanceof Error
          ? error.message
          : `Unknown AI service error for ${file.path}.`;
      console.error(
        `[API fix-linting-errors] Error during AI analysis for ${file.path}: ${extractedMessage}`,
        error
      );
      allAttemptedAiCallsSucceeded = false;
    }
    console.log(
      `[API fix-linting-errors] Finished processing ${file.path} in ${Date.now() - fileProcessStartTime}ms.`
    );
  }

  let determinedOverallMessage: string;
  if (!anyAiCallAttempted) {
    determinedOverallMessage =
      'No files required AI processing (e.g., no critical errors found or all files were skipped).';
  } else {
    if (allAttemptedAiCallsSucceeded) {
      if (anyFileActuallyChangedByAI) {
        determinedOverallMessage =
          'Lint fixing process completed successfully. AI proposed fixes for one or more files.';
      } else {
        determinedOverallMessage =
          'Lint fixing process completed. AI was called for files with errors, but proposed no functional changes to the content (may have provided descriptions).';
      }
    } else {
      determinedOverallMessage =
        'Lint fixing completed with partial success. Some files could not be processed fully by AI, or AI calls failed.';
    }
  }
  console.log(
    `[API fix-linting-errors] Overall outcome: ${determinedOverallMessage}`
  );
  return NextResponse.json(
    {
      success:
        allAttemptedAiCallsSucceeded &&
        Object.keys(fixedFileResultsAccumulator).length > 0
          ? anyFileActuallyChangedByAI
          : allAttemptedAiCallsSucceeded,
      message: determinedOverallMessage,
      fixedFileResults: fixedFileResultsAccumulator,
    } as ApiResponse,
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json({
    message:
      'API route /api/fix-linting-errors is active. Use POST with filesToFix and lintErrors.',
  });
}
