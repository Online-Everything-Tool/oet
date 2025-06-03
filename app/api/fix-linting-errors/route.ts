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
  if (promptTemplateCache) return promptTemplateCache;
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
  if (fileMatch && fileMatch[1]) fixedContent = fileMatch[1].trim();
  const descRegex =
    /---START_FIX_DESCRIPTION---([\s\\S]*?)---END_FIX_DESCRIPTION---/;
  const descMatch = responseText.match(descRegex);
  if (descMatch && descMatch[1]) fixDescription = descMatch[1].trim();
  if (!fixedContent && !fixDescription)
    console.warn(
      `[API fix-linting-errors] Could not parse AI response for ${expectedFilePath}.`
    );
  return {
    fixedContent,
    fixDescription:
      fixDescription ||
      (fixedContent
        ? 'AI proposed changes.'
        : 'No specific description provided.'),
  };
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const filePathMarkerRegex =
  /^(?:\.\/)?((?:app|src|lib|components|tool|pages|_components|_hooks)[\w/\-.]+\.(?:[jt]sx?|[cm]js))([:(]|$)/i;

const eslintHeaderPathRegex =
  /^(?:\.\/)?((?:app|src|lib|components|tool|pages|_components|_hooks)[\w/\-.]+\.(?:[jt]sx?|[cm]js))$/i;

function preprocessLintOutput(
  globalLintErrorsLog: string
): Map<string, string[]> {
  const errorsByFile = new Map<string, string[]>();
  let currentApplicableFileNormalized: string | null = null;
  const lines = globalLintErrorsLog.replace(/\r\n/g, '\n').split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (
      !trimmedLine ||
      trimmedLine.startsWith('info  - Need to disable some ESLint rules?') ||
      trimmedLine.startsWith('Next.js build worker exited')
    ) {
      continue;
    }

    const eslintHeaderMatch = trimmedLine.match(eslintHeaderPathRegex);
    if (eslintHeaderMatch && eslintHeaderMatch[0] === trimmedLine) {
      const pathKey = path.normalize(eslintHeaderMatch[1]);
      currentApplicableFileNormalized = pathKey;
      if (!errorsByFile.has(pathKey)) {
        errorsByFile.set(pathKey, []);
      }
      continue;
    }

    const filePathMarkerMatch = line.match(filePathMarkerRegex);
    if (filePathMarkerMatch) {
      const pathInErrorLineNormalized = path.normalize(filePathMarkerMatch[1]);
      currentApplicableFileNormalized = pathInErrorLineNormalized;
      if (!errorsByFile.has(pathInErrorLineNormalized)) {
        errorsByFile.set(pathInErrorLineNormalized, []);
      }
      errorsByFile.get(pathInErrorLineNormalized)!.push(line);
    } else if (currentApplicableFileNormalized) {
      errorsByFile.get(currentApplicableFileNormalized)!.push(line);
    } else {
    }
  }

  for (const [filePath, errors] of Array.from(errorsByFile.entries())) {
    if (errors.length === 0 || errors.every((e) => e.trim() === '')) {
      errorsByFile.delete(filePath);
    }
  }

  console.log(
    `[API fix-linting-errors] Preprocessed lint log. Found issues for ${errorsByFile.size} unique file paths.`
  );
  return errorsByFile;
}

const CRITICAL_ERROR_PATTERNS = [
  /^\s*\d+:\d+\s+error\b/i,
  /Type error:/i,
  /\bTS\d{4,5}:/i,
  /Cannot find name/i,
  /is not assignable to type/i,
  /Property .* does not exist on type/i,
  /Object is possibly 'null' or 'undefined'/i,
  /Expected \d+ arguments, but got \d+/i,
  /Module .* has no exported member/i,
  /react\/jsx-no-undef/i,
];

function containsCriticalError(errorLines: string[]): boolean {
  if (!errorLines || errorLines.length === 0) return false;
  for (const line of errorLines) {
    for (const pattern of CRITICAL_ERROR_PATTERNS) {
      if (pattern.test(line)) {
        console.log(
          `[containsCriticalError] Critical pattern matched: "${pattern}" in line: "${line}"`
        );
        return true;
      }
    }
  }
  return false;
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log(
    `[API fix-linting-errors] Received POST request at ${new Date(requestStartTime).toISOString()}`
  );

  if (!genAI) {
    /* ... API key error handling ... */
    return NextResponse.json(
      {
        success: false,
        message: 'AI service configuration error (API Key missing).',
        fixedFileResults: {},
      },
      { status: 500 }
    );
  }

  let body: RequestBody;
  try {
    /* ... body parsing ... */
    body = await request.json();
    if (!Array.isArray(body.filesToFix) || body.filesToFix.length === 0)
      throw new Error('Missing or empty "filesToFix" array.');
    if (
      !body.filesToFix.every(
        (f) =>
          typeof f.path === 'string' && typeof f.currentContent === 'string'
      )
    )
      throw new Error('Invalid structure in "filesToFix".');
    if (typeof body.lintErrors !== 'string')
      console.warn(
        '[API fix-linting-errors] "lintErrors" string is missing or not a string.'
      );
  } catch (error: unknown) {
    /* ... body parsing error handling ... */
    const message =
      error instanceof Error ? error.message : 'Invalid request body format';
    return NextResponse.json(
      {
        success: false,
        message: message,
        error: message,
        fixedFileResults: {},
      },
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

  try {
    promptTemplate = await getPromptTemplate();
  } catch (templateError) {
    /* ... template error handling ... */
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
      },
      { status: 500 }
    );
  }

  const preprocessedErrorsByFile = preprocessLintOutput(
    globalLintErrorsInput || ''
  );

  console.log(
    `[API fix-linting-errors] Iterating through ${filesToFix.length} file(s) provided by ALF workflow to check against preprocessed errors.`
  );

  for (const file of filesToFix) {
    const fileProcessStartTime = Date.now();
    const currentFilePathNormalized = path.normalize(file.path);
    console.log(
      `[API fix-linting-errors] Checking file from ALF list: ${currentFilePathNormalized}`
    );

    const errorsForThisSpecificFile = preprocessedErrorsByFile.get(
      currentFilePathNormalized
    );

    if (!errorsForThisSpecificFile || errorsForThisSpecificFile.length === 0) {
      console.log(
        `[API fix-linting-errors] No preprocessed errors/warnings found for ${file.path}. Skipping AI processing for this file.`
      );
      continue;
    }

    const rawErrorBlockForFile = errorsForThisSpecificFile.join('\n');
    console.log(
      `[API fix-linting-errors] Error block for ${file.path} (length ${rawErrorBlockForFile.length}):\n---\n${rawErrorBlockForFile}\n---`
    );

    if (!containsCriticalError(errorsForThisSpecificFile)) {
      console.log(
        `[API fix-linting-errors] Error block for ${file.path} does not contain critical errors. Skipping AI fix for this file.`
      );

      continue;
    }

    console.log(
      `[API fix-linting-errors] Critical error found for ${file.path}. Proceeding with AI call.`
    );
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
      if (!result.response)
        throw new Error(
          `AI analysis failed for ${file.path}: No response object received.`
        );
      const rawResponseText = result.response.text();
      const finishReason = result.response.candidates?.[0]?.finishReason;
      if (finishReason === 'MAX_TOKENS')
        console.warn(
          `[API fix-linting-errors] AI response for ${file.path} was truncated (MAX_TOKENS).`
        );

      const parsedResult = parseNewAIResponseFormat(rawResponseText, file.path);

      if (
        parsedResult.fixedContent === null &&
        parsedResult.fixDescription === null &&
        !rawResponseText.includes(
          `---START_FIXED_FILE:${escapeRegex(file.path)}---`
        )
      ) {
        console.warn(
          `[API fix-linting-errors] AI did not return content in the expected new format for ${file.path}. Raw (first 300): ${rawResponseText.substring(0, 300)}`
        );
        fixedFileResultsAccumulator[file.path] = {
          fixedContent: null,
          fixDescription: 'AI response format error or no fix proposed.',
        };
        allAttemptedAiCallsSucceeded = false;
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
        fixedFileResultsAccumulator[file.path] = {
          fixedContent: file.currentContent,
          fixDescription:
            parsedResult.fixDescription ||
            'AI proposed no changes or fix was identical.',
        };
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
      fixedFileResultsAccumulator[file.path] = {
        fixedContent: null,
        fixDescription: `AI call failed for this file: ${extractedMessage}`,
      };
    }
    console.log(
      `[API fix-linting-errors] Finished AI processing for ${file.path} in ${Date.now() - fileProcessStartTime}ms.`
    );
  }

  let determinedOverallMessage: string;
  if (!anyAiCallAttempted) {
    determinedOverallMessage =
      'No files required AI processing (e.g., no critical errors found or all files were skipped).';
  } else {
    /* ... */
    if (allAttemptedAiCallsSucceeded) {
      determinedOverallMessage = anyFileActuallyChangedByAI
        ? 'Lint fixing process completed successfully. AI proposed fixes for one or more files.'
        : 'Lint fixing process completed. AI was called for files with errors, but proposed no functional changes.';
    } else {
      determinedOverallMessage =
        'Lint fixing completed with partial success. Some files may have failed AI processing.';
    }
  }
  console.log(
    `[API fix-linting-errors] Overall outcome: ${determinedOverallMessage}`
  );
  const finalSuccess =
    allAttemptedAiCallsSucceeded ||
    (anyAiCallAttempted && anyFileActuallyChangedByAI);
  return NextResponse.json(
    {
      success: finalSuccess,
      message: determinedOverallMessage,
      fixedFileResults: fixedFileResultsAccumulator,
    },
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json({
    message:
      'API route /api/fix-linting-errors is active. Use POST with filesToFix and lintErrors.',
  });
}
