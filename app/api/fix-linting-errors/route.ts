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
const DEFAULT_MODEL_NAME = 'models/gemini-1.5-flash-latest'; // API controls this

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

interface ApiResponse {
  success: boolean;
  message: string;
  fixedFiles?: Record<string, string | null>;
  error?: string;
}

const generationConfig: GenerationConfig = {
  temperature: 0.2,
  topK: 30,
  topP: 0.8,
  maxOutputTokens: 32768,
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
    if (typeof lintErrors !== 'string' || !lintErrors.trim()) {
      throw new Error('Missing or empty "lintErrors" string.');
    }
    console.log(
      `[API fix-linting-errors] Request body parsed successfully. Files to fix: ${filesToFix.length}`
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Invalid request body format';
    console.error(
      '[API fix-linting-errors] Error parsing request body:',
      message,
      error
    );
    return NextResponse.json(
      { success: false, message: message, error: message } as ApiResponse,
      { status: 400 }
    );
  }

  const { filesToFix, lintErrors: globalLintErrorsInput } = body; // modelName removed from destructuring
  const modelToUse = DEFAULT_MODEL_NAME; // API decides which model to use
  
  const model = genAI.getGenerativeModel({ model: modelToUse });
  const fixedFilesResults: Record<string, string | null> = {};
  let allSucceededOverall = true;
  let anyFileActuallyFixedByAI = false;
  let overallMessage = 'Lint fixing process completed.';
  let promptTemplate: string;

  const globalLintErrors = globalLintErrorsInput.replace(/\r\n/g, '\n');


  try {
    promptTemplate = await getPromptTemplate();
  } catch (templateError) {
    const errMsg =
      templateError instanceof Error
        ? templateError.message
        : 'Unknown template error';
    console.error(
      '[API fix-linting-errors] Prompt template load error:',
      errMsg,
      templateError
    );
    return NextResponse.json(
      {
        success: false,
        message: `Failed to load AI prompt configuration: ${errMsg}`,
        error: errMsg,
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
    let collectingForCurrentFile = false;
    const errorsForThisFileArray: string[] = [];
    const currentFilePathNormalized = path.normalize(file.path);
    const pathHeaderRegex = /^(?:\.\/)?(?:app\/|src\/)?[\w/\-.]+\.(tsx|ts|js|jsx|mjs|cjs)/i;

    for (const line of lines) {
      const trimmedLine = line.trim();
      let lineIsPathHeader = false;
      let linePathNormalized = '';

      const pathMatch = trimmedLine.match(pathHeaderRegex);
      if (pathMatch && pathMatch[0].trim() === trimmedLine) {
        lineIsPathHeader = true;
        linePathNormalized = path.normalize(pathMatch[0].trim());
      }
      
      if (lineIsPathHeader && linePathNormalized === currentFilePathNormalized) {
        collectingForCurrentFile = true;
      } else if (lineIsPathHeader && linePathNormalized !== currentFilePathNormalized) {
        collectingForCurrentFile = false;
      } else if (collectingForCurrentFile && trimmedLine) {
        errorsForThisFileArray.push(line);
      }
    }
    const specificLintErrorsForThisFile = errorsForThisFileArray.join('\n');

    console.log(`[API fix-linting-errors] For file ${file.path}, specificLintErrorsForThisFile (trimmed length ${specificLintErrorsForThisFile.trim().length}):\n---\n${specificLintErrorsForThisFile.trim()}\n---`);

    if (!specificLintErrorsForThisFile.trim()) {
      console.log(
        `[API fix-linting-errors] No specific lint errors found for ${file.path} in the provided global list. Skipping AI processing for this file, retaining original content.`
      );
      fixedFilesResults[file.path] = file.currentContent;
      console.log(
        `[API fix-linting-errors] Finished processing ${file.path} in ${Date.now() - fileProcessStartTime}ms (skipped AI).`
      );
      continue;
    }

    const populatedPrompt = promptTemplate
      .replace(/{{FILE_PATH}}/g, file.path)
      .replace(/{{FILE_CONTENT}}/g, file.currentContent)
      .replace(/{{LINT_ERRORS}}/g, specificLintErrorsForThisFile);

    try {
      console.log(
        `[API fix-linting-errors] Sending to AI for ${file.path} with ${errorsForThisFileArray.length} specific error line(s). Prompt length: ~${populatedPrompt.length}`
      );
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: populatedPrompt }] }],
        generationConfig,
        safetySettings,
      });

      if (!result.response) {
        throw new Error(
          `AI analysis failed for ${file.path}: No response object received from Gemini.`
        );
      }
      
      const rawResponseText = result.response.text();
      console.log(`[API fix-linting-errors] --- START DEBUGGING RAW AI RESPONSE for ${file.path} ---`);
      console.log(`[API fix-linting-errors] rawResponseText length from AI: ${rawResponseText.length}`);
      console.log(`[API fix-linting-errors] rawResponseText (first 500 chars from AI):\n${rawResponseText.substring(0, 500)}`);
      console.log(`[API fix-linting-errors] rawResponseText (last 500 chars from AI):\n${rawResponseText.slice(-500)}`);
      
      const finishReason = result.response.candidates?.[0]?.finishReason;
      const safetyRatings = result.response.candidates?.[0]?.safetyRatings;
      const tokenCount = result.response.usageMetadata?.totalTokenCount;
      const outputTokenCount = result.response.usageMetadata?.candidatesTokenCount;

      console.log(`[API fix-linting-errors] Finish Reason: ${finishReason || 'N/A'}`);
      console.log(`[API fix-linting-errors] Safety Ratings: ${JSON.stringify(safetyRatings)}`);
      console.log(`[API fix-linting-errors] Token Count (Total): ${tokenCount || 'N/A'}`);
      console.log(`[API fix-linting-errors] Token Count (Output/Candidates): ${outputTokenCount || 'N/A'}`);
      console.log(`[API fix-linting-errors] --- END DEBUGGING RAW AI RESPONSE for ${file.path} ---`);
      
      const trimmedRawResponseText = rawResponseText.trim();

      const markdownFenceRegex =
        /^```(?:typescript|javascript|tsx|jsx)?\s*[\r\n]?|\s*[\r\n]?```$/g;
      
      const matches = Array.from(trimmedRawResponseText.matchAll(markdownFenceRegex));
      if (matches.length > 0) {
        console.log(`[API fix-linting-errors] Regex matches for fences found for ${file.path}:`);
        matches.forEach((matchArr, index) => {
          console.log(`  Fence Match ${index + 1}: "${matchArr[0]}" at index ${matchArr.index}`);
        });
      } else {
        console.log(`[API fix-linting-errors] No regex matches for fences found in ${file.path} (after initial trim).`);
      }

      const strippedResponseText = trimmedRawResponseText
        .replace(markdownFenceRegex, '')
        .trim();

      if (trimmedRawResponseText !== strippedResponseText) {
        console.log(
          `[API fix-linting-errors] Content changed after stripping fences for ${file.path}. Original (trimmed) length: ${trimmedRawResponseText.length}, New (stripped & trimmed) length: ${strippedResponseText.length}`
        );
      } else {
        console.log(
          `[API fix-linting-errors] Content UNCHANGED after stripping attempt for ${file.path} (or no fences found). Length: ${strippedResponseText.length}`
        );
      }
      
      if (
        !strippedResponseText ||
        strippedResponseText === file.currentContent.trim()
      ) {
        console.warn(
          `[API fix-linting-errors] AI did not change content for ${file.path} or returned empty (after stripping fences & final trim). Original content will be used.`
        );
        fixedFilesResults[file.path] = file.currentContent;
      } else {
        fixedFilesResults[file.path] = strippedResponseText;
        anyFileActuallyFixedByAI = true;
        console.log(
          `[API fix-linting-errors] AI PROPOSED FIXES for ${file.path}.`
        );
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

      fixedFilesResults[file.path] = null;
      allSucceededOverall = false;

      if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof (error as { message: unknown }).message === 'string' &&
        ((error as { message: string }).message.includes(
          'response was blocked due to safety'
        ) ||
          (error as { message: string }).message.includes(
            'Candidate was blocked due to safety'
          ))
      ) {
        console.warn(`[API fix-linting-errors] SAFETY BLOCK for ${file.path}.`);
      }
    }
    console.log(
      `[API fix-linting-errors] Finished processing ${file.path} in ${Date.now() - fileProcessStartTime}ms.`
    );
  }

  if (
    !allSucceededOverall &&
    Object.values(fixedFilesResults).every((content) => content === null)
  ) {
    overallMessage =
      'AI lint fixing failed for all files due to errors or safety blocks.';
    console.error(`[API fix-linting-errors] ${overallMessage}`);
    return NextResponse.json(
      {
        success: false,
        message: overallMessage,
        fixedFiles: fixedFilesResults,
        error: overallMessage,
      } as ApiResponse,
      { status: 500 }
    );
  } else if (!allSucceededOverall) {
    overallMessage =
      'Lint fixing completed with some errors. Not all files could be processed.';
    console.warn(`[API fix-linting-errors] ${overallMessage}`);
  } else if (allSucceededOverall && !anyFileActuallyFixedByAI) {
    overallMessage =
      'Lint fixing process completed. AI proposed no changes to any files (after stripping fences), or no specific errors were found for any files.';
    console.log(`[API fix-linting-errors] ${overallMessage}`);
  } else if (allSucceededOverall && anyFileActuallyFixedByAI) {
    overallMessage =
      'Lint fixing process completed successfully. AI proposed fixes for one or more files (fences stripped).';
    console.log(`[API fix-linting-errors] ${overallMessage}`);
  }

  console.log(
    `[API fix-linting-errors] Request completed in ${Date.now() - requestStartTime}ms. Sending response.`
  );
  return NextResponse.json(
    {
      success: true,
      message: overallMessage,
      fixedFiles: fixedFilesResults,
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