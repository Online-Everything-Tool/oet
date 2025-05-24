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
  process.env.DEFAULT_GEMINI_MODEL_NAME || 'models/gemini-1.5-flash-latest';

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
  modelName?: string;
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
  console.log(
    `[API fix-linting-errors] Received POST request (${new Date().toISOString()})`
  );

  if (!genAI) {
    return NextResponse.json(
      {
        success: false,
        message: 'AI service configuration error (API Key missing).',
      },
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
        'Invalid structure in "filesToFix". Each item must have "path" and "currentContent" strings.'
      );
    }
    if (typeof lintErrors !== 'string' || !lintErrors.trim()) {
      throw new Error('Missing or empty "lintErrors" string.');
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Invalid request body format';
    console.error(
      '[API fix-linting-errors] Error parsing request body:',
      message
    );
    return NextResponse.json(
      { success: false, message: message },
      { status: 400 }
    );
  }

  const { filesToFix, lintErrors, modelName = DEFAULT_MODEL_NAME } = body;
  const model = genAI.getGenerativeModel({ model: modelName });
  const fixedFilesResults: Record<string, string | null> = {};
  let allSucceeded = true;
  let overallMessage = 'Lint fixing process completed.';
  let promptTemplate: string;

  try {
    promptTemplate = await getPromptTemplate();
  } catch (templateError) {
    console.error(
      '[API fix-linting-errors] Prompt template load error:',
      templateError
    );
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to load AI prompt configuration.',
      },
      { status: 500 }
    );
  }

  console.log(
    `[API fix-linting-errors] Attempting to fix ${filesToFix.length} file(s) using model ${modelName}.`
  );

  for (const file of filesToFix) {
    console.log(`[API fix-linting-errors] Processing file: ${file.path}`);

    const populatedPrompt = promptTemplate
      .replace(/{{FILE_PATH}}/g, file.path)
      .replace(/{{FILE_CONTENT}}/g, file.currentContent)
      .replace(/{{LINT_ERRORS}}/g, lintErrors);

    try {
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
      const responseText = result.response.text().trim();

      if (!responseText || responseText === file.currentContent) {
        console.warn(
          `[API fix-linting-errors] AI did not change content for ${file.path} or returned empty. Assuming no fix or unable to fix.`
        );
        fixedFilesResults[file.path] = file.currentContent;
      } else {
        fixedFilesResults[file.path] = responseText;
        console.log(
          `[API fix-linting-errors] AI proposed fixes for ${file.path}.`
        );
      }
    } catch (error: unknown) {
      const extractedMessage =
        error instanceof Error
          ? error.message
          : `Unknown AI service error for ${file.path}.`;

      console.error(
        `[API fix-linting-errors] Error during AI analysis for ${file.path}: ${extractedMessage}`
      );
      fixedFilesResults[file.path] = null;
      allSucceeded = false;
      overallMessage = `Lint fixing completed with some errors. Check individual file results.`;
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
        console.warn(`[API fix-linting-errors] Safety block for ${file.path}.`);
      }
    }
  }

  if (
    !allSucceeded &&
    Object.values(fixedFilesResults).every((content) => content === null)
  ) {
    return NextResponse.json(
      {
        success: false,
        message: 'AI lint fixing failed for all files or was blocked.',
        fixedFiles: fixedFilesResults,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: overallMessage,
      fixedFiles: fixedFilesResults,
    },
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json({
    message:
      'API route /api/fix-linting-errors is active. Use POST with prNumber, lintErrors, and filesToFix.',
  });
}
