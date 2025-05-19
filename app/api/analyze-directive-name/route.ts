// /app/api/analyze-directive-name/route.ts

import { NextResponse } from 'next/server';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';

const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL_NAME =
  process.env.DEFAULT_GEMINI_MODEL_NAME || 'models/gemini-1.5-flash-latest';

async function getAppPurpose(): Promise<string> {
  try {
    const packageJsonPath = path.resolve(process.cwd(), 'package.json');
    const packageJsonData = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonData);
    return (
      packageJson.description || 'a collection of client-side utility tools'
    );
  } catch (_error) {
    console.warn(
      `[API analyze-directive] Could not read package.json description. ${_error}`
    );
    return 'a collection of client-side utility tools';
  }
}

if (!API_KEY) {
  console.error('FATAL ERROR (analyze-directive): GEMINI_API_KEY missing.');
}
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const generationConfig = { temperature: 0.4, maxOutputTokens: 250 };
const safetySettings = [
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

async function readPromptTemplate(): Promise<string> {
  try {
    const templatePath = path.join(
      process.cwd(),
      'app',
      'api',
      'analyze-directive-name',
      '_prompts',
      'prompt_template.md'
    );
    return await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    console.error(
      'Error reading analyze-directive-name prompt template:',
      error
    );
    throw new Error('Failed to load prompt template for directive analysis.');
  }
}

export async function POST(request: Request) {
  console.log(`[API analyze-directive-name] Received POST request`);

  if (!genAI) {
    return NextResponse.json(
      { error: 'AI service configuration error.' },
      { status: 500 }
    );
  }

  let proposedDirective: string | undefined;
  let existingDirectives: string[] = [];
  let generativeDescription: string | undefined;

  try {
    const body = await request.json();
    proposedDirective = body.proposedDirective?.trim();
    generativeDescription = body.generativeDescription?.trim();

    if (Array.isArray(body.existingDirectives)) {
      existingDirectives = body.existingDirectives.filter(
        (d: unknown) => typeof d === 'string'
      );
    }

    if (!proposedDirective || !generativeDescription) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: proposedDirective, generativeDescription',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: `Invalid request body format: ${error}` },
      { status: 400 }
    );
  }

  const appPurpose = await getAppPurpose();
  let promptTemplate: string;
  try {
    promptTemplate = await readPromptTemplate();
  } catch (_templateError) {
    return NextResponse.json(
      { error: 'Failed to load AI prompt configuration.' },
      { status: 500 }
    );
  }

  const prompt = promptTemplate
    .replace(/{{PROPOSED_DIRECTIVE}}/g, proposedDirective)
    .replace(/{{APP_PURPOSE}}/g, appPurpose)
    .replace(
      /{{EXISTING_DIRECTIVES_LIST}}/g,
      existingDirectives.join(', ') || 'None'
    )
    .replace(/{{GENERATIVE_DESCRIPTION}}/g, generativeDescription);

  try {
    console.log(
      `[API analyze-directive-name] Calling Gemini (${DEFAULT_MODEL_NAME}) for analysis of: ${proposedDirective}`
    );
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL_NAME });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings,
    });

    if (!result.response) {
      throw new Error('AI analysis failed: No response object received.');
    }

    const rawResponseText = result.response.text().trim();
    const cleanedResponseText = rawResponseText.replace(
      /^```json\s*|\s*```$/g,
      ''
    );
    console.log(
      `[API analyze-directive-name] Gemini analysis raw response: ${rawResponseText}`
    );

    try {
      const analysisResult = JSON.parse(cleanedResponseText);

      if (
        typeof analysisResult.score !== 'number' ||
        typeof analysisResult.is_likely_typo !== 'boolean' ||
        !Array.isArray(analysisResult.suggestions) ||
        typeof analysisResult.reasoning !== 'string'
      ) {
        throw new Error('AI response missing expected JSON fields.');
      }
      console.log(
        `[API analyze-directive-name] Analysis successful for ${proposedDirective}`
      );
      return NextResponse.json(analysisResult, { status: 200 });
    } catch (parseError) {
      console.error(
        '[API analyze-directive-name] Error parsing JSON response:',
        parseError,
        `Raw text: ${cleanedResponseText}`
      );

      return NextResponse.json(
        {
          score: 0.5,
          is_likely_typo: false,
          suggestions: [],
          reasoning: 'Error: Could not parse analysis result from AI.',
        },
        { status: 200 }
      );
    }
  } catch (error: unknown) {
    console.error(
      '[API analyze-directive-name] Error during AI analysis:',
      error
    );
    const message =
      error instanceof Error ? error.message : 'Unknown AI service error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'API route /api/analyze-directive-name is active. Use POST.',
  });
}
