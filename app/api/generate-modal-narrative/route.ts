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
import type {
  ResouceGenerationEpic,
  ResouceGenerationEpicChapter,
} from '@/src/types/build';

const API_KEY = process.env.GEMINI_API_KEY;
const NARRATIVE_MODEL_NAME =
  process.env.DEFAULT_GEMINI_NARRATIVE_MODEL_NAME ||
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

interface ProcessedRequestData {
  toolDirective: string;
  toolDescription: string;
  generationModelName: string;
  userAdditionalDescription: string;
  aiRequestedExamples?: string[];
  userSelectedExamples?: string[];
}

const generationConfig: GenerationConfig = {
  temperature: 0.8,
  topK: 50,
  topP: 0.95,
  maxOutputTokens: 4096,
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

let mainPromptTemplateCache: string | null = null;
const exampleNarrativeTemplatesCache: string[] = [];

async function loadPromptAndInjectExample(
  requestData: ProcessedRequestData
): Promise<string> {
  if (!mainPromptTemplateCache) {
    try {
      const templatePath = path.join(
        process.cwd(),
        'app',
        'api',
        'generate-modal-narrative',
        '_prompts',
        'narrative_prompt_template.md'
      );
      mainPromptTemplateCache = await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
      console.error('Error reading main narrative prompt template:', error);
      throw new Error(
        'Failed to load main prompt template for modal narrative.'
      );
    }
  }

  if (exampleNarrativeTemplatesCache.length === 0) {
    try {
      const examplesDir = path.join(
        process.cwd(),
        'app',
        'api',
        'generate-modal-narrative',
        '_data'
      );
      const files = await fs.readdir(examplesDir);
      const mdFiles = files.filter(
        (file) => file.endsWith('.md') && /^\d\d_template\.md$/.test(file)
      );
      console.log(
        `[Narrative API] Found ${mdFiles.length} example template files: ${mdFiles.join(', ')}`
      );
      for (const file of mdFiles) {
        const filePath = path.join(examplesDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        exampleNarrativeTemplatesCache.push(content.trim());
      }
      console.log(
        `[Narrative API] Loaded ${exampleNarrativeTemplatesCache.length} templates into cache.`
      );
      if (exampleNarrativeTemplatesCache.length === 0) {
        console.warn(
          '[API generate-modal-narrative] No example templates found in _data directory (e.g., 01_template.md).'
        );
      }
    } catch (error) {
      console.warn(
        '[API generate-modal-narrative] Error reading example templates:',
        error
      );
    }
  }

  let exampleContentToSubstitute = `EPIC_COMPANY_NAME::Default Example Co.
EPIC_COMPANY_EMOJI::📝
EPIC_COMPANY_EMPLOYEE_NAME::N. A. Example
EPIC_COMPANY_JOB_TITLE::Placeholder
EPIC_COMPANY_EMPLOYEE_EMOJI::🧑‍🔬
--START_CHAPTER--
CHAPTER_EMOJI::🤔
CHAPTER_STORY::OET is building '{{TOOL_DIRECTIVE}}'. Interesting...
--END_CHAPTER--
--START_CHAPTER--
CHAPTER_EMOJI::🧐
CHAPTER_STORY::Description: '{{TOOL_DESCRIPTION}}'. Hmm.
--END_CHAPTER--
--START_CHAPTER--
CHAPTER_EMOJI::😅
CHAPTER_STORY::Model '{{GENERATION_MODEL_NAME}}', eh?
--END_CHAPTER--
--START_CHAPTER--
CHAPTER_EMOJI::😬
CHAPTER_STORY::User refined: '{{USER_ADDITIONAL_DESCRIPTION}}'.
--END_CHAPTER--
--START_CHAPTER--
CHAPTER_EMOJI::💦
CHAPTER_STORY::Examples like '{{AI_REQUESTED_EXAMPLES_LIST}}' and '{{USER_SELECTED_EXAMPLES_LIST}}'.
--END_CHAPTER--
--START_CHAPTER--
CHAPTER_EMOJI::😨
CHAPTER_STORY::This '{{TOOL_DIRECTIVE}}' is almost ready!
--END_CHAPTER--
--START_CHAPTER--
CHAPTER_EMOJI::😰
CHAPTER_STORY::Our market share!
--END_CHAPTER--
--START_CHAPTER--
CHAPTER_EMOJI::😱
CHAPTER_STORY::It's probably done!
--END_CHAPTER--
--START_CHAPTER--
CHAPTER_EMOJI::🔥
CHAPTER_STORY::We need a plan!
--END_CHAPTER--
--START_CHAPTER--
CHAPTER_EMOJI::💀
CHAPTER_STORY::Maybe OET is hiring?
--END_CHAPTER--`;

  if (exampleNarrativeTemplatesCache.length > 0) {
    const randomIndex = Math.floor(
      Math.random() * exampleNarrativeTemplatesCache.length
    );
    console.log(
      `[Narrative API] Picked random example template index: ${randomIndex} (out of ${exampleNarrativeTemplatesCache.length})`
    );
    exampleContentToSubstitute = exampleNarrativeTemplatesCache[randomIndex];
  }

  const {
    toolDirective,
    toolDescription,
    generationModelName,
    userAdditionalDescription,
    aiRequestedExamples,
    userSelectedExamples,
  } = requestData;

  const formatExampleListForPrompt = (examples?: string[]): string => {
    if (!examples || examples.length === 0) return '    - None.';
    return examples.map((ex) => `    - \`${ex}\``).join('\n');
  };

  const aiRequestedExamplesListString =
    formatExampleListForPrompt(aiRequestedExamples);
  const userSelectedExamplesListString =
    formatExampleListForPrompt(userSelectedExamples);

  const fullySubstitutedExample = exampleContentToSubstitute
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

  let finalPrompt = mainPromptTemplateCache.replace(
    '{{FULL_EXAMPLE}}',
    fullySubstitutedExample
  );

  finalPrompt = finalPrompt
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

  return finalPrompt;
}

function parseDelimitedNarrative(
  responseText: string
): ResouceGenerationEpic | null {
  console.log(responseText);
  try {
    const lines = responseText.split('\n');
    const result: Partial<ResouceGenerationEpic> = { epicNarrative: [] };
    let currentChapter: Partial<ResouceGenerationEpicChapter> | null = null;
    let inChapterStory = false;

    for (const line of lines) {
      if (line.startsWith('--START_CHAPTER--')) {
        if (currentChapter) {
          (result.epicNarrative as ResouceGenerationEpicChapter[]).push(
            currentChapter as ResouceGenerationEpicChapter
          );
        }
        currentChapter = {};
        inChapterStory = false;
        continue;
      }
      if (line.startsWith('--END_CHAPTER--')) {
        if (
          currentChapter &&
          currentChapter.chapterEmoji &&
          currentChapter.chapterStory
        ) {
          (result.epicNarrative as ResouceGenerationEpicChapter[]).push(
            currentChapter as ResouceGenerationEpicChapter
          );
        } else {
          console.warn(
            '[Narrative Parser] Encountered END_CHAPTER without complete chapter data:',
            currentChapter
          );
        }
        currentChapter = null;
        inChapterStory = false;
        continue;
      }

      const parts = line.split('::');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('::').trim();

        if (currentChapter) {
          if (key === 'CHAPTER_EMOJI') {
            currentChapter.chapterEmoji = value;
            inChapterStory = false;
          } else if (key === 'CHAPTER_STORY') {
            currentChapter.chapterStory = value;
            inChapterStory = true;
          }
        } else {
          switch (key) {
            case 'EPIC_COMPANY_NAME':
              result.epicCompanyName = value;
              break;
            case 'EPIC_COMPANY_EMOJI':
              result.epicCompanyEmoji = value;
              break;
            case 'EPIC_COMPANY_EMPLOYEE_NAME':
              result.epicCompanyEmployeeName = value;
              break;
            case 'EPIC_COMPANY_JOB_TITLE':
              result.epicCompanyJobTitle = value;
              break;
            case 'EPIC_COMPANY_EMPLOYEE_EMOJI':
              result.epicCompanyEmployeeEmoji = value;
              break;
          }
        }
      } else if (
        inChapterStory &&
        currentChapter &&
        currentChapter.chapterStory !== undefined
      ) {
        currentChapter.chapterStory += '\n' + line;
      }
    }

    if (
      currentChapter &&
      currentChapter.chapterEmoji &&
      currentChapter.chapterStory
    ) {
      (result.epicNarrative as ResouceGenerationEpicChapter[]).push(
        currentChapter as ResouceGenerationEpicChapter
      );
    }

    if (
      !result.epicCompanyName ||
      !result.epicCompanyEmoji ||
      typeof result.epicCompanyEmoji !== 'string' ||
      result.epicCompanyEmoji.trim() === '' ||
      !result.epicCompanyEmployeeName ||
      !result.epicCompanyJobTitle ||
      !result.epicCompanyEmployeeEmoji ||
      typeof result.epicCompanyEmployeeEmoji !== 'string' ||
      result.epicCompanyEmployeeEmoji.trim() === '' ||
      !result.epicNarrative ||
      result.epicNarrative.length !== 10 ||
      !result.epicNarrative.every(
        (ch) =>
          ch.chapterEmoji &&
          typeof ch.chapterEmoji === 'string' &&
          ch.chapterEmoji.trim() !== '' &&
          ch.chapterStory &&
          typeof ch.chapterStory === 'string' &&
          ch.chapterStory.trim() !== ''
      )
    ) {
      console.warn(
        '[Narrative Parser] Parsed object failed validation. Missing fields or incorrect chapter count/structure.',
        result
      );
      return null;
    }

    return result as ResouceGenerationEpic;
  } catch (error) {
    console.error(
      '[Narrative Parser] Error parsing delimited text:',
      error,
      '\nText was:\n',
      responseText
    );
    return null;
  }
}

const defaultFallbackEpic: ResouceGenerationEpic = {
  epicCompanyName: "Cogsworth's Calculators & Curios",
  epicCompanyEmoji: '⚙️',
  epicCompanyEmployeeName: "Barnaby 'Bytes' Buttons",
  epicCompanyJobTitle: 'Chief Innovation Quasher',
  epicCompanyEmployeeEmoji: '🧑‍🔧',
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

  let processedRequestDataForPrompt: ProcessedRequestData;

  try {
    const body: RequestBody = await request.json();
    const toolDirective = body.toolDirective?.trim();
    const toolDescription = body.toolDescription?.trim();

    if (!toolDirective || !toolDescription) {
      console.warn(
        '[API generate-modal-narrative] Missing toolDirective or toolDescription. Returning fallback epic.'
      );
      return NextResponse.json(defaultFallbackEpic, { status: 200 });
    }

    processedRequestDataForPrompt = {
      toolDirective,
      toolDescription,
      generationModelName:
        body.generationModelName?.trim() || 'an unspecified AI model',
      userAdditionalDescription:
        body.userAdditionalDescription?.trim() || 'None provided.',
      aiRequestedExamples: body.aiRequestedExamples,
      userSelectedExamples: body.userSelectedExamples,
    };
  } catch (error) {
    console.warn(
      '[API generate-modal-narrative] Invalid request body. Returning fallback epic.',
      error
    );
    return NextResponse.json(defaultFallbackEpic, { status: 200 });
  }

  let prompt: string;
  try {
    prompt = await loadPromptAndInjectExample(processedRequestDataForPrompt);
  } catch (templateError) {
    console.error(
      '[API generate-modal-narrative] Prompt template load error. Returning fallback epic.',
      templateError
    );
    return NextResponse.json(defaultFallbackEpic, { status: 200 });
  }

  try {
    console.log(
      `[API generate-modal-narrative] Calling Gemini (${NARRATIVE_MODEL_NAME}) for narrative for tool: ${processedRequestDataForPrompt.toolDirective}. Prompt length: ~${prompt.length}`
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

    const narrativeResult = parseDelimitedNarrative(responseText);

    if (narrativeResult) {
      console.log(
        `[API generate-modal-narrative] Narrative generation and parsing successful for ${processedRequestDataForPrompt.toolDirective}`
      );
      return NextResponse.json(narrativeResult, { status: 200 });
    } else {
      console.warn(
        '[API generate-modal-narrative] Failed to parse delimited narrative from AI. Returning fallback epic. Raw text:',
        responseText
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
