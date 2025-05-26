// FILE: app/api/generate-modal-narrative/route.ts
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
import type { ResouceGenerationEpic } from '@/src/types/build';

const API_KEY = process.env.GEMINI_API_KEY;
const NARRATIVE_MODEL_NAME =

  'models/gemini-1.5-flash-latest';

if (!API_KEY) {
  console.error(
    'FATAL ERROR (generate-modal-narrative): GEMINI_API_KEY missing.'
  );
}
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

interface RequestBody {
  toolDirective: string;
  toolDescription: string;
  generationModelName?: string;
  userAdditionalDescription?: string;
  aiRequestedExamples?: string[];
  userSelectedExamples?: string[];
}

const generationConfig: GenerationConfig = {
  temperature: 0.75,
  topK: 50,
  topP: 0.95,
  maxOutputTokens: 3072,
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

async function readNarrativePromptTemplate(): Promise<string> {
  if (promptTemplateCache) return promptTemplateCache;
  try {
    const templatePath = path.join(
      process.cwd(),
      'app',
      'api',
      'generate-modal-narrative',
      '_prompts',
      'narrative_prompt_template.md'
    );
    promptTemplateCache = await fs.readFile(templatePath, 'utf-8');
    return promptTemplateCache;
  } catch (error) {
    console.error('Error reading narrative prompt template:', error);
    throw new Error('Failed to load prompt template for modal narrative.');
  }
}

const defaultFallbackEpic: ResouceGenerationEpic = {
  epicCompanyName: "Cogsworth's Calculators & Curios",
  epicCompanyEmployeeName: "Barnaby 'Bytes' Buttons",
  epicCompanyJobTitle: 'Chief Innovation Quasher',
  epicCompanyEmployeeEmoji: '⚙️',
  epicNarrative: [
    {
      chapterEmoji: '🧐',
      chapterStory:
        'Hmph. Another blip on the disrupto-meter. Probably nothing.',
    },
    {
      chapterEmoji: '🤔',
      chapterStory:
        'User seems rather... determined. Are they... building something?',
    },
    {
      chapterEmoji: '😬',
      chapterStory:
        "Wait, that description sounds suspiciously like our top-secret 'Project UtilityMax'!",
    },
    {
      chapterEmoji: '😅',
      chapterStory:
        "Okay, okay, deep breaths. It's just a free tool. How good can it *really* be?",
    },
    {
      chapterEmoji: '💦',
      chapterStory:
        "The progress bar... it's... progressing! This wasn't in the quarterly forecast!",
    },
    {
      chapterEmoji: '😨',
      chapterStory:
        "They're using *that* much AI power?! For FREE?! My quarterly bonus just whimpered.",
    },
    {
      chapterEmoji: '😰',
      chapterStory:
        "Quick, someone unplug the internet! No, wait, that's where our revenue comes from...",
    },
    {
      chapterEmoji: '😱',
      chapterStory:
        "It's... it's actually working! The market! Our carefully crafted walled garden!",
    },
    {
      chapterEmoji: '🔥',
      chapterStory:
        'THIS IS FINE. EVERYTHING IS FINE. *shreds TPS reports with vigor*',
    },
    {
      chapterEmoji: '💀',
      chapterStory:
        "So, hypothetically, what's OET's dental plan like? Asking for... research.",
    },
  ],
};

export async function POST(request: NextRequest) {
  console.log('[API generate-modal-narrative] Received POST request');

  if (!genAI) {
    console.error(
      '[API generate-modal-narrative] AI service not configured (GEMINI_API_KEY missing). Returning fallback epic.'
    );
    return NextResponse.json(defaultFallbackEpic, { status: 200 });
  }

  let toolDirective: string | undefined;
  let toolDescription: string | undefined;
  let generationModelName: string;
  let userAdditionalDescription: string;
  let aiRequestedExamples: string[] | undefined;
  let userSelectedExamples: string[] | undefined;

  try {
    const body: RequestBody = await request.json();
    toolDirective = body.toolDirective?.trim();
    toolDescription = body.toolDescription?.trim();

    if (!toolDirective || !toolDescription) {
      console.warn(
        '[API generate-modal-narrative] Missing toolDirective or toolDescription. Returning fallback epic.'
      );
      return NextResponse.json(defaultFallbackEpic, { status: 200 });
    }

    generationModelName =
      body.generationModelName?.trim() || 'an unspecified AI model';
    userAdditionalDescription =
      body.userAdditionalDescription?.trim() || 'None provided.';
    aiRequestedExamples = body.aiRequestedExamples;
    userSelectedExamples = body.userSelectedExamples;
  } catch (error) {
    console.warn(
      '[API generate-modal-narrative] Invalid request body. Returning fallback epic.',
      error
    );
    return NextResponse.json(defaultFallbackEpic, { status: 200 });
  }

  let promptTemplate: string;
  try {
    promptTemplate = await readNarrativePromptTemplate();
  } catch (templateError) {
    console.error(
      '[API generate-modal-narrative] Prompt template load error. Returning fallback epic.',
      templateError
    );
    return NextResponse.json(defaultFallbackEpic, { status: 200 });
  }

  const formatExampleListForPrompt = (examples?: string[]): string => {
    if (!examples || examples.length === 0)
      return '    - None selected/provided.';
    return examples.map((ex) => `    - \`${ex}\``).join('\n');
  };

  const aiRequestedExamplesListString =
    formatExampleListForPrompt(aiRequestedExamples);
  const userSelectedExamplesListString =
    formatExampleListForPrompt(userSelectedExamples);

  const prompt = promptTemplate
    .replace(/{{TOOL_DIRECTIVE}}/g, toolDirective)
    .replace(/{{TOOL_DESCRIPTION}}/g, toolDescription)
    .replace(
      /{{GENERATION_MODEL_NAME}}/g,
      generationModelName.replace('models/', '')
    )
    .replace(/{{USER_ADDITIONAL_DESCRIPTION}}/g, userAdditionalDescription)
    .replace(/{{AI_REQUESTED_EXAMPLES_LIST}}/g, aiRequestedExamplesListString)
    .replace(
      /{{USER_SELECTED_EXAMPLES_LIST}}/g,
      userSelectedExamplesListString
    );

  try {
    console.log(
      `[API generate-modal-narrative] Calling Gemini (${NARRATIVE_MODEL_NAME}) for narrative for tool: ${toolDirective}.`
    );
    const model = genAI.getGenerativeModel({ model: NARRATIVE_MODEL_NAME });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings,
    });

    if (!result.response) {
      console.warn(
        '[API generate-modal-narrative] AI analysis failed: No response object. Returning fallback epic.'
      );
      return NextResponse.json(defaultFallbackEpic, { status: 200 });
    }

    const responseText = result.response.text();
    if (!responseText || responseText.trim() === '') {
      console.warn(
        '[API generate-modal-narrative] AI returned empty response. Returning fallback epic.'
      );
      return NextResponse.json(defaultFallbackEpic, { status: 200 });
    }

    try {
      const narrativeResult = JSON.parse(responseText) as ResouceGenerationEpic;

      if (
        !narrativeResult.epicCompanyName ||
        !narrativeResult.epicCompanyEmployeeName ||
        !narrativeResult.epicCompanyJobTitle ||
        !narrativeResult.epicCompanyEmployeeEmoji ||
        !Array.isArray(narrativeResult.epicNarrative) ||
        narrativeResult.epicNarrative.length !== 10 ||
        !narrativeResult.epicNarrative.every(
          (ch) =>
            typeof ch.chapterEmoji === 'string' &&
            ch.chapterEmoji.trim() !== '' &&
            typeof ch.chapterStory === 'string' &&
            ch.chapterStory.trim() !== ''
        )
      ) {

        console.log(responseText);

        return NextResponse.json(defaultFallbackEpic, { status: 200 });
      }
      console.log(
        `[API generate-modal-narrative] Narrative generation successful for ${toolDirective}`
      );
      return NextResponse.json(narrativeResult, { status: 200 });
    } catch (parseError) {
      console.error(
        '[API generate-modal-narrative] Error parsing JSON response from AI. Returning fallback epic:',
        parseError,
        `Raw text: ${responseText}`
      );
      return NextResponse.json(defaultFallbackEpic, { status: 200 });
    }
  } catch (error: unknown) {
    console.error(
      '[API generate-modal-narrative] Error during AI narrative generation. Returning fallback epic:',
      error
    );
    let isSafetyBlock = false;
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as { message: string }).message === 'string'
    ) {
      isSafetyBlock = (error as { message: string }).message
        .toLowerCase()
        .includes('safety');
    }
    if (isSafetyBlock) {
      console.warn(
        '[API generate-modal-narrative] Narrative generation blocked by safety settings. Returning fallback.'
      );
    }
    return NextResponse.json(defaultFallbackEpic, { status: 200 });
  }
}
