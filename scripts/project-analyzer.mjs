// FILE: scripts/project_analyzer.mjs
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const BASE_CONTEXT_FILE = path.join(
  PROJECT_ROOT,
  'infra',
  'data',
  'project_context.txt'
);
const ANALYSIS_OUTPUT_FILE = path.join(
  PROJECT_ROOT,
  'public',
  'data',
  'project_analysis.json'
);
const ENV_FILE = path.join(PROJECT_ROOT, '.env');

let GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-1.5-flash-latest';

const ANALYSIS_QUESTION = `Analyze the provided project context which includes base configuration, layout, home page (showing existing tools), global styles, HistoryContext, and the build/tool feature.
Based *only* on the information given:

1.  Generate a catchy, concise \`siteTagline\` (string, max 15 words) reflecting the tool's overall value proposition.
2.  Generate a \`siteDescription\` (string, exactly **2 sentences**) summarizing the application's purpose ("Online everything tool - largest assortment of free client-based utilities") and target audience.
3.  Infer a list of user \`siteBenefits\` (array of strings). Focus on the *value* provided, not just listing features. Examples: "Access a wide variety of utilities in one place", "Transform data quickly using client-side processing", "Track your past operations with the History feature", "Contribute new tools easily via the AI-assisted build process", "Works offline for many tools due to PWA setup". Derive these from the purpose, included tools, PWA config, history, and build/tool features shown in the context.
4.  **Brainstorm \`suggestedNewToolDirectives\` (array of strings): Based on the project's goal of being a comprehensive suite of *client-side utilities* and the *types* of tools already present (data transformation, generation, exploration - e.g., 'base64-converter', 'hash-generator', 'json-validator-formatter', 'emoji-explorer'), suggest exactly 5 potential *new* tool directives that would logically fit and expand the suite. Focus on common developer, data manipulation, or text utility tasks suitable for client-side implementation. Return these suggestions as an array of strings, using lowercase kebab-case. **Crucially, ensure the directives strictly follow the \`<thing>-<operation>\` or \`<thing>-<operation>-<operation>\` pattern (e.g., "diff-checker", "regex-tester", "color-picker", "jwt-debugger", "markdown-previewer") and explicitly avoid prepositions like 'to', 'for', 'with' or articles like 'a', 'an', 'the' within the directive name itself.**

Respond ONLY with a single JSON object adhering strictly to the following structure (the 'modelNameUsed' field will be added by the calling script, do not generate it):
{
  "siteTagline": "<Generated Tagline>",
  "siteDescription": "<Generated Description>",
  "siteBenefits": ["<Benefit 1>", "<Benefit 2>", "..."],
  "suggestedNewToolDirectives": ["<suggestion-1>", "<suggestion-2>", "<suggestion-3>", "<suggestion-4>", "<suggestion-5>"]
}
Do not include any explanatory text before or after the JSON object you generate. Do not use markdown formatting like \`\`\`json. Ensure the output is valid JSON based on the fields you generate.`;

async function loadEnvFile() {
  try {
    const envData = await fs.readFile(ENV_FILE, 'utf-8');
    const lines = envData.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts
          .join('=')
          .replace(/^["'](.*)["']$/, '$1')
          .trim(); // Remove surrounding quotes more robustly & trim
        if (key && value) {
          // Only set if value is not empty after potential quote removal
          process.env[key.trim()] = value;
          if (key.trim() === 'GEMINI_API_KEY') {
            GEMINI_API_KEY = value;
          }
        } else if (key && valueParts.length === 0) {
          // Handle KEY= (empty value)
          process.env[key.trim()] = '';
          if (key.trim() === 'GEMINI_API_KEY') {
            GEMINI_API_KEY = '';
          }
        }
      }
    }
    console.log(`Loaded environment variables from ${ENV_FILE}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(
        `Warning: ${ENV_FILE} file not found. Relying on pre-set environment variables.`
      );
    } else {
      console.error(`Error loading ${ENV_FILE}:`, error);
      // Optionally exit if .env is critical and not found, e.g. process.exit(1);
    }
  }
}

async function main() {
  console.log('--- Starting Project Analysis Script (MJS Version) ---');

  await loadEnvFile();

  if (!GEMINI_API_KEY) {
    // Re-check after loadEnvFile attempts to populate it
    console.error(
      'Error: GEMINI_API_KEY is not set in environment or .env file.'
    );
    process.exit(1);
  }
  console.log('GEMINI_API_KEY seems available.');
  console.log(`Using Gemini Model: ${MODEL_NAME}`);

  let baseContextContent;
  try {
    baseContextContent = await fs.readFile(BASE_CONTEXT_FILE, 'utf-8');
    console.log(`Base context file read: ${BASE_CONTEXT_FILE}`);
  } catch (error) {
    console.error(
      `Error: Could not read base context file '${BASE_CONTEXT_FILE}'.`
    );
    console.error(error.message);
    process.exit(1);
  }

  const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Here is the project context for analysis:\n\n' },
          { text: baseContextContent },
          {
            text: '\n\nBased *only* on the context provided above, please fulfill the following request:\n\n',
          },
          { text: ANALYSIS_QUESTION },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.6,
      maxOutputTokens: 4096, // Ensure this is sufficient
    },
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  };

  console.log(`Sending analysis request to Gemini (${MODEL_NAME})...`);
  let apiResponseData;
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorBody = `API request failed with status ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        errorBody += `\nDetails: ${JSON.stringify(errorJson, null, 2)}`;
      } catch (e) {
        const textError = await response.text();
        if (textError) errorBody += `\nResponse body: ${textError}`;
      }
      throw new Error(errorBody);
    }
    apiResponseData = await response.json();
  } catch (error) {
    console.error('Error during Gemini API call:');
    console.error(error.message);
    process.exit(1);
  }

  if (apiResponseData.error) {
    console.error(
      'Error: Gemini API returned an error object:',
      JSON.stringify(apiResponseData.error, null, 2)
    );
    process.exit(1);
  }

  const candidate = apiResponseData.candidates?.[0];
  if (!candidate) {
    const blockReason = apiResponseData.promptFeedback?.blockReason;
    const safetyRatings = apiResponseData.promptFeedback?.safetyRatings;
    if (blockReason) {
      console.error(
        `Error: Request was blocked by API. Reason: ${blockReason}`
      );
      if (safetyRatings)
        console.error(
          'Safety Ratings:',
          JSON.stringify(safetyRatings, null, 2)
        );
    } else {
      console.error(
        'Error: No candidate found in API response (response might be empty or malformed).'
      );
      console.error(
        'Full API Response:',
        JSON.stringify(apiResponseData, null, 2)
      );
    }
    process.exit(1);
  }

  const finishReason = candidate.finishReason;
  const rawAnalysisText = candidate.content?.parts?.[0]?.text;

  if (!rawAnalysisText || rawAnalysisText.trim() === '') {
    const safetyRatings = candidate.safetyRatings;
    if (finishReason === 'SAFETY') {
      console.error(
        'Error: Response was blocked due to safety concerns (Finish Reason: SAFETY).'
      );
      if (safetyRatings)
        console.error(
          'Candidate Safety Ratings:',
          JSON.stringify(safetyRatings, null, 2)
        );
    } else if (finishReason === 'MAX_TOKENS') {
      console.error(
        'Error: Response was truncated by API (MAX_TOKENS). The output is incomplete. Consider increasing maxOutputTokens in generationConfig or reducing context/question size.'
      );
    } else if (finishReason === 'RECITATION') {
      console.error(
        'Error: Response was blocked due to recitation policy (Finish Reason: RECITATION).'
      );
    } else if (finishReason === 'OTHER') {
      console.error(
        "Error: Response was stopped by API for 'OTHER' reasons (Finish Reason: OTHER)."
      );
    } else {
      console.error(
        `Error: No analysis text received from API. Finish Reason: ${finishReason || 'Unknown (likely empty response from model or unexpected structure)'}`
      );
    }
    console.error('Full Candidate Data:', JSON.stringify(candidate, null, 2));
    console.error(
      'Full API Response:',
      JSON.stringify(apiResponseData, null, 2)
    );
    process.exit(1);
  }

  let parsedAnalysis;
  try {
    parsedAnalysis = JSON.parse(rawAnalysisText);
  } catch (error) {
    console.error("Error: Gemini's text response was not valid JSON.");
    console.error('Raw text from Gemini to be parsed:');
    console.error('-----------------------------------------');
    console.error(rawAnalysisText);
    console.error('-----------------------------------------');
    console.error('Parsing error:', error.message);
    process.exit(1);
  }

  console.log(
    `Adding model name (${MODEL_NAME}) and timestamp to the result...`
  );
  const finalJsonOutput = {
    ...parsedAnalysis,
    modelNameUsed: MODEL_NAME,
    generatedAt: new Date().toISOString(),
  };

  console.log('\n--- Gemini Analysis Result (Final JSON) ---');
  console.log(JSON.stringify(finalJsonOutput, null, 2));
  console.log('--- End Analysis ---');

  try {
    await fs.mkdir(path.dirname(ANALYSIS_OUTPUT_FILE), { recursive: true });
    await fs.writeFile(
      ANALYSIS_OUTPUT_FILE,
      JSON.stringify(finalJsonOutput, null, 2),
      'utf-8'
    );
    console.log(`Successfully wrote analysis to ${ANALYSIS_OUTPUT_FILE}`);
  } catch (error) {
    console.error(`Error: Failed to write analysis to ${ANALYSIS_OUTPUT_FILE}`);
    console.error(error.message);
    process.exit(1);
  }

  console.log('--- Project Analysis Script Completed Successfully ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL: Unhandled error in main execution:', err);
  process.exit(1);
});
