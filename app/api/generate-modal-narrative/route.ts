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
import {
  ResourceGenerationEpic,
  ResourceGenerationEpicChapter,
} from '@/src/types/tools';

const API_KEY = process.env.GEMINI_API_KEY;
const NARRATIVE_MODEL_NAME = 'models/gemini-1.5-pro-latest';

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
    } catch (error) {
      console.warn(
        '[API generate-modal-narrative] Error reading example templates:',
        error
      );
    }
  }

  const randomIndex = Math.floor(
    Math.random() * exampleNarrativeTemplatesCache.length
  );
  console.log(
    `[Narrative API] Picked random example template index: ${randomIndex} (out of ${exampleNarrativeTemplatesCache.length})`
  );
  const exampleContentToSubstitute =
    exampleNarrativeTemplatesCache[randomIndex];

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

  console.log(finalPrompt);
  console.log('');
  console.log('');
  console.log('');
  console.log('');
  console.log('');

  return finalPrompt;
}

function parseDelimitedNarrative(
  responseText: string
): ResourceGenerationEpic | null {
  try {
    const lines = responseText.split('\n');
    const result: Partial<ResourceGenerationEpic> = { epicNarrative: [] };
    let currentChapter: Partial<ResourceGenerationEpicChapter> | null = null;
    let inChapterStory = false;

    for (const line of lines) {
      if (line.startsWith('--START_CHAPTER--')) {
        if (currentChapter) {
          (result.epicNarrative as ResourceGenerationEpicChapter[]).push(
            currentChapter as ResourceGenerationEpicChapter
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
          (result.epicNarrative as ResourceGenerationEpicChapter[]).push(
            currentChapter as ResourceGenerationEpicChapter
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
      (result.epicNarrative as ResourceGenerationEpicChapter[]).push(
        currentChapter as ResourceGenerationEpicChapter
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

    return result as ResourceGenerationEpic;
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

export async function POST(request: NextRequest) {
  console.log('[API generate-modal-narrative] Received POST request');

  if (genAI) {
    let processedRequestDataForPrompt: ProcessedRequestData;
    try {
      const body: RequestBody = await request.json();
      const toolDirective = body.toolDirective?.trim();
      const toolDescription = body.toolDescription?.trim();

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

      const prompt = await loadPromptAndInjectExample(
        processedRequestDataForPrompt
      );

      const model = genAI.getGenerativeModel({ model: NARRATIVE_MODEL_NAME });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
        safetySettings,
      });

      const responseText = result.response.text();

      const narrativeResult = parseDelimitedNarrative(responseText);

      return NextResponse.json(narrativeResult, { status: 200 });
    } catch (error) {
      console.warn(
        '[API generate-modal-narrative] Invalid request body. Returning fallback epic.',
        error
      );
    }
  }
}
