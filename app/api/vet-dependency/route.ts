// FILE: app/api/vet-dependency/route.ts
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
import type {
  VetDependencyResult,
  ApiVetDependencyResponse,
} from '@/src/types/build';

const API_KEY = process.env.GEMINI_API_KEY;

const DEFAULT_VETTING_MODEL_NAME =
  process.env.DEFAULT_GEMINI_VETTING_MODEL_NAME ||
  process.env.DEFAULT_GEMINI_MODEL_NAME ||
  'models/gemini-1.5-flash-latest';

if (!API_KEY) {
  console.error('FATAL ERROR (vet-dependency): GEMINI_API_KEY missing.');
}
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

interface VetDependencyRequestBody {
  packageName: string;
  toolDirective: string;
  toolDescription: string;
  vettingModelName?: string;
}

const generationConfig: GenerationConfig = {
  temperature: 0.3,
  topK: 40,
  topP: 0.9,
  maxOutputTokens: 1024,
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

let promptTemplateCache: string | null = null;

async function readVettingPromptTemplate(): Promise<string> {
  if (promptTemplateCache) return promptTemplateCache;
  try {
    const templatePath = path.join(
      process.cwd(),
      'app',
      'api',
      'vet-dependency',
      '_prompts',
      'vetting_prompt_template.md'
    );
    promptTemplateCache = await fs.readFile(templatePath, 'utf-8');
    return promptTemplateCache;
  } catch (error) {
    console.error(
      '[API vet-dependency] Error reading vetting prompt template:',
      error
    );
    throw new Error('Failed to load prompt template for dependency vetting.');
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isValidVetDependencyResult(obj: any): obj is VetDependencyResult {
  if (!obj || typeof obj !== 'object') return false;
  const requiredStringFields = [
    'packageName',
    'justification',
    'primaryFunction',
  ];
  const requiredBooleanFields = ['isLikelySafeAndRelevant', 'isRelevant'];
  const makesNetworkCallsValues: VetDependencyResult['makesNetworkCalls'][] = [
    'yes',
    'no',
    'unknown',
    'likely_no',
    'likely_yes',
  ];
  const popularityValues: VetDependencyResult['popularityIndication'][] = [
    'high',
    'medium',
    'low',
    'niche',
    'unknown',
    undefined,
  ];

  for (const field of requiredStringFields) {
    if (typeof obj[field] !== 'string') return false;
  }
  for (const field of requiredBooleanFields) {
    if (typeof obj[field] !== 'boolean') return false;
  }
  if (!makesNetworkCallsValues.includes(obj.makesNetworkCalls)) return false;
  if (!popularityValues.includes(obj.popularityIndication)) return false;

  return true;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiVetDependencyResponse>> {
  console.log('[API vet-dependency] Received POST request');

  if (!genAI) {
    console.error(
      '[API vet-dependency] AI service not configured (GEMINI_API_KEY missing).'
    );
    return NextResponse.json(
      {
        success: false,
        message: 'AI service configuration error.',
        vettingResult: null,
      },
      { status: 500 }
    );
  }

  let requestBody: VetDependencyRequestBody;
  try {
    requestBody = await request.json();
    const { packageName, toolDirective, toolDescription } = requestBody;
    if (!packageName || !toolDirective || !toolDescription) {
      throw new Error(
        'Missing required fields: packageName, toolDirective, toolDescription.'
      );
    }
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : 'Invalid request body.';
    console.error('[API vet-dependency] Invalid request body:', msg);
    return NextResponse.json(
      { success: false, message: msg, vettingResult: null },
      { status: 400 }
    );
  }

  const {
    packageName,
    toolDirective,
    toolDescription,
    vettingModelName = DEFAULT_VETTING_MODEL_NAME,
  } = requestBody;

  let promptTemplate: string;
  try {
    promptTemplate = await readVettingPromptTemplate();
  } catch (templateError: unknown) {
    const msg =
      templateError instanceof Error
        ? templateError.message
        : 'Failed to load AI prompt configuration.';
    console.error(
      '[API vet-dependency] Prompt template load error:',
      msg,
      templateError
    );
    return NextResponse.json(
      { success: false, message: msg, vettingResult: null },
      { status: 500 }
    );
  }

  const prompt = promptTemplate
    .replace(/{{PACKAGE_NAME}}/g, packageName)
    .replace(/{{TOOL_DIRECTIVE}}/g, toolDirective)
    .replace(/{{TOOL_DESCRIPTION}}/g, toolDescription);

  try {
    console.log(
      `[API vet-dependency] Calling Gemini (${vettingModelName}) for vetting package: ${packageName}`
    );
    const model = genAI.getGenerativeModel({ model: vettingModelName });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings,
    });

    if (!result.response) {
      throw new Error(
        'AI vetting failed: No response object received from Gemini.'
      );
    }

    const responseText = result.response.text();
    if (!responseText || responseText.trim() === '') {
      const finishReason = result.response.candidates?.[0]?.finishReason;
      throw new Error(
        `AI returned an empty response for vetting. Finish Reason: ${finishReason || 'Unknown'}`
      );
    }

    let vettingData: VetDependencyResult;
    try {
      const parsedJsonFromAI = JSON.parse(responseText);
      if (!isValidVetDependencyResult(parsedJsonFromAI)) {
        console.warn(
          '[API vet-dependency] AI response failed validation schema.',
          parsedJsonFromAI
        );
        throw new Error(
          'AI response structure is invalid or missing required fields for VetDependencyResult.'
        );
      }
      vettingData = parsedJsonFromAI;
    } catch (parseError: unknown) {
      const msg =
        parseError instanceof Error
          ? parseError.message
          : 'Unknown parsing error.';
      console.error(
        '[API vet-dependency] Error parsing JSON response from AI for vetting:',
        msg,
        `Raw text: ${responseText.substring(0, 500)}...`
      );

      return NextResponse.json(
        {
          success: false,
          message: `Error parsing AI's vetting response: ${msg}`,
          vettingResult: null,
          error: 'AI_RESPONSE_PARSE_FAILURE',
        },
        { status: 502 }
      );
    }

    console.log(
      `[API vet-dependency] Vetting successful for package: ${packageName}`
    );
    return NextResponse.json(
      {
        success: true,
        message: 'Dependency vetted successfully.',
        vettingResult: vettingData,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown AI service error during vetting.';
    console.error(
      '[API vet-dependency] Error during AI vetting process:',
      message,
      error
    );

    let errorType = 'AI_SERVICE_ERROR';
    let status = 500;

    if (message.toLowerCase().includes('safety')) {
      errorType = 'SAFETY_BLOCK';
      status = 400;
    } else if (message.toLowerCase().includes('max_tokens')) {
      errorType = 'MAX_TOKENS';
      status = 400;
    } else if (
      message.toLowerCase().includes('ai returned an empty response')
    ) {
      errorType = 'EMPTY_RESPONSE';
      status = 502;
    }

    return NextResponse.json(
      {
        success: false,
        message: `AI Vetting Error: ${message}`,
        vettingResult: null,
        error: errorType,
      },
      { status: status }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'API route /api/vet-dependency is active. Use POST.',
  });
}
