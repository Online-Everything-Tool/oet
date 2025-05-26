// FILE: app/api/validate-directive/route.ts
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

import type { ApiValidationResponseData } from '@/src/types/build';

interface RequestBody {
  toolDirective: string;
  modelName?: string;
}

interface GeminiValidationResponse {
  isValid: boolean;
  validationMessage: string;
  generativeDescription: string;
  generativeRequestedDirectives: string[];
  directive?: string;
}

const DEFAULT_MODEL_NAME =
  process.env.DEFAULT_GEMINI_MODEL_NAME || 'models/gemini-1.5-flash-latest';
const API_KEY = process.env.GEMINI_API_KEY;

async function getAvailableDirectives(): Promise<string[]> {
  const toolsDirPath = path.join(process.cwd(), 'app', 'tool');
  const directives: string[] = [];
  try {
    const entries = await fs.readdir(toolsDirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('_')) {
        directives.push(entry.name);
      }
    }
  } catch (error) {
    console.error(
      '[API validate-directive] Error reading tools directory:',
      error
    );
  }
  return directives.sort();
}

async function readPromptTemplate(): Promise<string> {
  try {
    const templatePath = path.join(
      process.cwd(),
      'app',
      'api',
      'validate-directive',
      '_prompts',
      'prompt_template.md'
    );
    return await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    console.error('Error reading validate-directive prompt template:', error);
    throw new Error('Failed to load prompt template for directive validation.');
  }
}

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    console.error(
      '[API validate-directive] Error: GEMINI_API_KEY is not configured.'
    );
    return NextResponse.json(
      { success: false, message: 'Server configuration error.' },
      { status: 500 }
    );
  }

  let toolDirective: string | undefined;
  let modelName: string;
  try {
    const body: RequestBody = await req.json();
    toolDirective = body.toolDirective?.trim();

    modelName =
      body.modelName ||
      process.env.DEFAULT_GEMINI_VALIDATION_MODEL_NAME ||
      DEFAULT_MODEL_NAME;

    if (!toolDirective) {
      return NextResponse.json(
        { success: false, message: 'Tool directive is required.' },
        { status: 400 }
      );
    }

    const directiveRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!directiveRegex.test(toolDirective)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid format. Directive must be lowercase kebab-case (e.g., 'text-formatter', 'image-resizer').",
        },
        { status: 400 }
      );
    }
  } catch (parseError) {
    const message =
      parseError instanceof Error
        ? parseError.message
        : 'Unknown body parse error.';
    return NextResponse.json(
      { error: `Invalid request body format: ${message}` },
      { status: 400 }
    );
  }

  const availableDirectives = await getAvailableDirectives();
  if (availableDirectives.includes(toolDirective)) {
    return NextResponse.json(
      {
        success: false,
        message: `Directive "${toolDirective}" already exists.`,
      },
      { status: 409 }
    );
  }

  let promptTemplate: string;
  try {
    promptTemplate = await readPromptTemplate();
  } catch (templateError) {
    const message =
      templateError instanceof Error
        ? templateError.message
        : 'Unknown error loading template.';
    console.error(
      '[API validate-directive] Error loading prompt template:',
      message,
      templateError
    );
    return NextResponse.json(
      { error: `Failed to load AI prompt configuration: ${message}` },
      { status: 500 }
    );
  }

  const prompt = promptTemplate
    .replace(/{{TOOL_DIRECTIVE}}/g, toolDirective)
    .replace(
      /{{AVAILABLE_DIRECTIVES_LIST}}/g,
      availableDirectives.join(', ') || 'None'
    );

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: modelName });

  const generationConfig: GenerationConfig = {
    temperature: 0.3,
    topK: 40,
    topP: 0.85,
    maxOutputTokens: 512,
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

  try {
    const parts = [{ text: prompt }];
    console.log(
      `[API validate-directive] Sending prompt for directive: ${toolDirective} to model: ${modelName}`
    );

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig,
      safetySettings,
    });

    if (!result.response) {
      console.error(
        '[API validate-directive] Gemini API call failed: No response field.'
      );
      throw new Error('AI service did not return a response.');
    }

    const responseText = result.response.text();

    if (!responseText || responseText.trim() === '') {
      console.error(
        '[API validate-directive] Received empty response text from AI model.'
      );
      throw new Error('AI service returned an empty response.');
    }

    let parsedAiResponse: GeminiValidationResponse;
    try {
      parsedAiResponse = JSON.parse(responseText) as GeminiValidationResponse;
    } catch (e) {
      console.error(
        '[API validate-directive] Failed to parse Gemini JSON response:',
        e
      );

      throw new Error('Failed to parse validation response from AI.');
    }

    if (
      typeof parsedAiResponse !== 'object' ||
      parsedAiResponse === null ||
      typeof parsedAiResponse.isValid !== 'boolean' ||
      typeof parsedAiResponse.validationMessage !== 'string' ||
      typeof parsedAiResponse.generativeDescription !== 'string' ||
      !Array.isArray(parsedAiResponse.generativeRequestedDirectives) ||
      !parsedAiResponse.generativeRequestedDirectives.every(
        (item: unknown) => typeof item === 'string'
      )
    ) {
      console.error(
        '[API validate-directive] Invalid structure in parsed AI response:',
        parsedAiResponse
      );
      throw new Error('Received malformed validation data structure from AI.');
    }

    const finalResponse: ApiValidationResponseData = {
      success: parsedAiResponse.isValid,
      message: parsedAiResponse.validationMessage,
      generativeDescription: parsedAiResponse.isValid
        ? parsedAiResponse.generativeDescription
        : null,
      generativeRequestedDirectives:
        parsedAiResponse.generativeRequestedDirectives
          .filter((d) => typeof d === 'string' && d.trim() !== '')
          .slice(0, 10),
    };

    if (finalResponse.success && availableDirectives.includes(toolDirective)) {
      console.warn(
        `[API validate-directive] AI validated "${toolDirective}" but it exists. Overriding.`
      );
      finalResponse.success = false;
      finalResponse.message = `Directive "${toolDirective}" already exists (validation override).`;
      finalResponse.generativeDescription = null;
      finalResponse.generativeRequestedDirectives = [];
    }

    return NextResponse.json(finalResponse, { status: 200 });
  } catch (error: unknown) {
    console.error('[API validate-directive] Overall Error:', error);
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
        '[API validate-directive] Response blocked by safety settings.'
      );

      return NextResponse.json(
        { success: false, message: 'Request blocked due to safety settings.' },
        { status: 400 }
      );
    }
    if (message.includes('AI service returned an empty response.')) {
      return NextResponse.json(
        {
          success: false,
          message:
            'AI service returned an empty response. The selected model might be unavailable or restricted.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: false, message: `Internal Server Error: ${message}` },
      { status: 500 }
    );
  }
}
