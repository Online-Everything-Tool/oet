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
const DEFAULT_MODEL_NAME = 'models/gemini-1.5-flash-latest';

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
  maxOutputTokens: 8192,
  responseMimeType: 'text/plain',
};

const safetySettings: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

let promptTemplateCache: string | null = null;

async function getPromptTemplate(): Promise<string> {
  if (promptTemplateCache) { return promptTemplateCache; }
  try {
    const templatePath = path.join(process.cwd(),'app','api','fix-linting-errors','_prompts','prompt_template.md');
    promptTemplateCache = await fs.readFile(templatePath, 'utf-8');
    console.log('[API fix-linting-errors] Prompt template loaded successfully.');
    return promptTemplateCache;
  } catch (error) {
    console.error('[API fix-linting-errors] Error reading prompt template:', error);
    throw new Error('Failed to load prompt template for lint fixing.');
  }
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log(`[API fix-linting-errors] Received POST request at ${new Date(requestStartTime).toISOString()}`);

  if (!genAI) {
    console.error('[API fix-linting-errors] AI service not configured (GEMINI_API_KEY missing).');
    return NextResponse.json({ success: false, message: 'AI service configuration error (API Key missing).', fixedFiles: {} } as ApiResponse, { status: 500 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
    const { filesToFix, lintErrors } = body;
    if (!Array.isArray(filesToFix) || filesToFix.length === 0) { throw new Error('Missing or empty "filesToFix" array.'); }
    if (!filesToFix.every(f => typeof f.path === 'string' && typeof f.currentContent === 'string')) {
      throw new Error('Invalid structure in "filesToFix". Each item must have "path" (string) and "currentContent" (string).');
    }
    if (typeof lintErrors !== 'string') { console.warn('[API fix-linting-errors] "lintErrors" string is missing or not a string. Treating as empty.');}
    console.log(`[API fix-linting-errors] Request body parsed successfully. Files to fix: ${filesToFix.length}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid request body format';
    console.error('[API fix-linting-errors] Error parsing request body:', message, error);
    return NextResponse.json({ success: false, message: message, error: message, fixedFiles: {} } as ApiResponse, { status: 400 });
  }

  const { filesToFix, lintErrors: globalLintErrorsInput } = body;
  const modelToUse = DEFAULT_MODEL_NAME;
  const model = genAI.getGenerativeModel({ model: modelToUse });
  const fixedFilesResults: Record<string, string | null> = {};
  let anyAiCallAttempted = false;
  let allAttemptedAiCallsSucceeded = true; 
  let anyFileActuallyChangedByAI = false;
  let promptTemplate: string;
  const globalLintErrors = (globalLintErrorsInput || "").replace(/\r\n/g, '\n');

  try {
    promptTemplate = await getPromptTemplate();
  } catch (templateError) {
    const errMsg = templateError instanceof Error ? templateError.message : 'Unknown template error';
    return NextResponse.json({ success: false, message: `Failed to load AI prompt configuration: ${errMsg}`, error: errMsg, fixedFiles: {} } as ApiResponse, { status: 500 });
  }

  console.log(`[API fix-linting-errors] Attempting to fix ${filesToFix.length} file(s) using model ${modelToUse}.`);

  for (const file of filesToFix) {
    const fileProcessStartTime = Date.now();
    console.log(`[API fix-linting-errors] Processing file: ${file.path}`);

    // --- TARGETED LINT/TYPE ERROR EXTRACTION (Attempt 6) ---
    const lines = globalLintErrors.split('\n');
    const messagesForThisFileArray: string[] = [];
    const currentFilePathNormalized = path.normalize(file.path);

    // Regex to identify a line that IS a file path (acting as a header)
    const pathHeaderRegex = /^(?:\.\/)?((?:app|src|node_modules)[\w/\-.]+\.(tsx|ts|js|jsx|mjs|cjs))$/i;
    
    // Regex to identify typical lint/type error lines that start with line:col or are specific TS errors
    // Example line: "  281:5  Warning: React Hook useCallback..."
    // Example line: "18:68  Error: The `{}`..."
    // Example TS Error: "error TS2322: Type 'string' is not assignable to type 'number'." (might not start with path)
    const actualMessagePattern = /^\s*(?:\d+:\d+\s+(?:Error|Warning)|(?:error|warning)\s+TS\d+:)/i;
    // Regex for lines that are continuations of a multi-line error message (e.g., starting with "- ")
    const continuationMessagePattern = /^\s*-\s+/;


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
        collectingForCurrentFileTarget = false; 
      } else if (collectingForCurrentFileTarget && trimmedLineFull) {
        // If we are in the "collecting" state for our target file,
        // add lines that look like actual error/warning messages or their continuations.
        if (actualMessagePattern.test(trimmedLineStart) || continuationMessagePattern.test(trimmedLineStart)) {
            messagesForThisFileArray.push(line); // Push original line to preserve indentation
        } else {
            // Optional: Log lines under context but not matching specific patterns
            // console.log(`[API fix-linting-errors] INFO: Line under context for ${file.path} but not matching detailed message pattern: "${line}"`);
        }
      }
    }
    const specificLintMessagesForThisFile = messagesForThisFileArray.join('\n');
    // --- END TARGETED LINT/TYPE ERROR EXTRACTION (Attempt 6) ---

    console.log(`[API fix-linting-errors] For file ${file.path}, specificLintMessagesForThisFile (TARGETED EXTRACTION Attempt 6) (trimmed length ${specificLintMessagesForThisFile.trim().length}):\n---\n${specificLintMessagesForThisFile.trim()}\n---`);

    let hasActualErrors = false;
    if (specificLintMessagesForThisFile.trim()) {
      const errorIndicatorRegex = /(?:^|\s|-|\d+:\d+\s+)(error|error ts\d+)/i; 
      const buildFailureIndicators = /(module not found|failed to compile)/i;
      for (const line of messagesForThisFileArray) {
        if (errorIndicatorRegex.test(line.toLowerCase()) && !buildFailureIndicators.test(line.toLowerCase())) {
          hasActualErrors = true;
          break;
        }
      }
    }
    console.log(`[API fix-linting-errors] File ${file.path}: Has actual errors (for AI fixing)? ${hasActualErrors}`);

    if (!specificLintMessagesForThisFile.trim() || !hasActualErrors) {
      const skipReason = !specificLintMessagesForThisFile.trim() 
        ? "No specific lint/type error messages found for this file" 
        : "Only warnings found (or messages not identified as fixable errors), no critical errors detected for AI fixing";
      console.log(`[API fix-linting-errors] ${skipReason} for ${file.path}. Skipping AI processing.`);
      console.log(`[API fix-linting-errors] Finished processing ${file.path} in ${Date.now() - fileProcessStartTime}ms (skipped AI).`);
      continue;
    }

    anyAiCallAttempted = true;
    const populatedPrompt = promptTemplate
      .replace(/{{FILE_PATH}}/g, file.path)
      .replace(/{{FILE_CONTENT}}/g, file.currentContent)
      .replace(/{{LINT_ERRORS}}/g, specificLintMessagesForThisFile);

    try {
      console.log(`[API fix-linting-errors] Sending to AI for ${file.path} with ${messagesForThisFileArray.length} specific lint message line(s). Prompt length: ~${populatedPrompt.length}`);
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: populatedPrompt }] }],
        generationConfig,
        safetySettings,
      });

      if (!result.response) { throw new Error(`AI analysis failed for ${file.path}: No response object received from Gemini.`); }
      
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
      const markdownFenceRegex = /^```(?:typescript|javascript|tsx|jsx)?\s*[\r\n]?|\s*[\r\n]?```$/g;
      const strippedResponseText = trimmedRawResponseText.replace(markdownFenceRegex, '').trim();
      
      const CHARACTER_LIMIT_HEURISTIC = 25000; 
      if (file.currentContent.length > CHARACTER_LIMIT_HEURISTIC && finishReason === 'MAX_TOKENS') {
          console.warn(`[API fix-linting-errors] File ${file.path} is large and AI response was truncated (MAX_TOKENS). Marking as failed to fix (null).`);
          fixedFilesResults[file.path] = null;
          allAttemptedAiCallsSucceeded = false; 
      } else if (!strippedResponseText || strippedResponseText === file.currentContent.trim()) {
        console.warn(`[API fix-linting-errors] AI did not propose changes for ${file.path} or returned empty. Not adding to 'fixedFiles' response.`);
      } else {
        fixedFilesResults[file.path] = strippedResponseText;
        anyFileActuallyChangedByAI = true;
        console.log(`[API fix-linting-errors] AI PROPOSED FIXES for ${file.path}. Will be included in response.`);
      }
    } catch (error: unknown) {
      const extractedMessage = error instanceof Error ? error.message : `Unknown AI service error for ${file.path}.`;
      console.error(`[API fix-linting-errors] Error during AI analysis for ${file.path}: ${extractedMessage}`, error);
      fixedFilesResults[file.path] = null;
      allAttemptedAiCallsSucceeded = false;
    }
    console.log(`[API fix-linting-errors] Finished processing ${file.path} in ${Date.now() - fileProcessStartTime}ms.`);
  }

  let determinedOverallMessage: string;
  if (!anyAiCallAttempted) {
    determinedOverallMessage = 'No files required AI processing (e.g., no critical errors found or all files were skipped).';
  } else { 
    if (allAttemptedAiCallsSucceeded) {
      if (anyFileActuallyChangedByAI) {
        determinedOverallMessage = 'Lint fixing process completed successfully. AI proposed fixes for one or more files.';
      } else {
        determinedOverallMessage = 'Lint fixing process completed. AI was called for files with errors, but proposed no changes to the content.';
      }
    } else { 
      const attemptedFilesWithNullResult = Object.keys(fixedFilesResults).filter(k => fixedFilesResults[k] === null).length;
      const totalFilesWithNonNullResult = Object.keys(fixedFilesResults).filter(k => fixedFilesResults[k] !== null).length;
      if (attemptedFilesWithNullResult > 0 && totalFilesWithNonNullResult === 0 && Object.keys(fixedFilesResults).length > 0) {
        determinedOverallMessage = 'AI lint fixing failed for all attempted files (e.g., due to errors, safety blocks, or truncation).';
      } else { 
        determinedOverallMessage = 'Lint fixing completed with partial success. Some files could not be processed fully by AI, while others were processed (potentially with no changes proposed).';
      }
    }
  }
  console.log(`[API fix-linting-errors] Overall outcome: ${determinedOverallMessage}`);

  console.log(`[API fix-linting-errors] Request completed in ${Date.now() - requestStartTime}ms. Sending response.`);
  return NextResponse.json(
    {
      success: allAttemptedAiCallsSucceeded,
      message: determinedOverallMessage,
      fixedFiles: fixedFilesResults,
    } as ApiResponse,
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json({
    message: 'API route /api/fix-linting-errors is active. Use POST with filesToFix and lintErrors.',
  });
}