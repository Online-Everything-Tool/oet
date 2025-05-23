// scripts/test-json-mode-compatibility.mjs
import fs from 'fs/promises';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXCLUDE_FILE_PATH = path.resolve(
  __dirname,
  '..',
  'app',
  'api',
  'list-models',
  '_data',
  'exclude.json'
);

async function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    const envFile = await fs.readFile(envPath, 'utf-8');
    envFile.split('\n').forEach((line) => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (key && value) {
          process.env[key.trim()] = value.trim();
        }
      }
    });
    console.log('[JSON Test Script] .env file loaded.');
  } catch (error) {
    console.warn(
      '[JSON Test Script] Could not load .env file. Error: ' + error.message
    );
  }
}

async function getModelsToTest(baseApiUrlForListModels) {
  const listModelsEndpoint = `${baseApiUrlForListModels}/api/list-models?filterExcluded=false&latestOnly=false`;
  console.log(
    `[JSON Test Script] Fetching models (with filterExcluded=false) from: ${listModelsEndpoint}`
  );
  try {
    const response = await fetch(listModelsEndpoint);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch models: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
    const data = await response.json();
    if (!data.models || !Array.isArray(data.models)) {
      throw new Error('Invalid model list format received.');
    }
    console.log(
      `[JSON Test Script] Received ${data.models.length} models from /api/list-models (filterExcluded=false) and (latestOnly=false) to potentially test.`
    );
    return data.models;
  } catch (error) {
    console.error(
      '[JSON Test Script] Error fetching model list:',
      error.message
    );
    return [];
  }
}

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
];

async function testModelForJsonModeDirectly(
  genAIInstance,
  modelName,
  modelDisplayName
) {
  console.log(
    `[JSON Test Script] Directly testing model "${modelDisplayName}" (${modelName}) for JSON mode...`
  );

  try {
    const model = genAIInstance.getGenerativeModel({ model: modelName });
    const generationConfig = {
      temperature: 0.0,
      maxOutputTokens: 100, // Increased slightly
      responseMimeType: 'application/json',
    };
    const prompt =
      'Respond with ONLY the following valid JSON object and nothing else: { "json_mode_supported": true }';

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings,
    });

    if (!result.response) {
      console.warn(
        `  [FAIL] Model "${modelDisplayName}" (${modelName}): No response object from Gemini.`
      );
      return false;
    }

    let responseText = result.response.text().trim();

    const jsonRegex = /```json\s*([\s\S]*?)\s*```|({[\s\S]*})/;
    const match = responseText.match(jsonRegex);

    let extractedJsonText = null;
    if (match) {
      extractedJsonText = match[1] || match[2];
    } else {
      extractedJsonText = responseText;
    }

    if (!extractedJsonText) {
      console.warn(
        `  [FAIL] Model "${modelDisplayName}" (${modelName}): No JSON-like content found in response. Raw: "${responseText}"`
      );
      return false;
    }

    try {
      const jsonOutput = JSON.parse(extractedJsonText.trim());
      if (
        typeof jsonOutput === 'object' &&
        jsonOutput !== null &&
        jsonOutput.json_mode_supported === true
      ) {
        console.log(
          `  [PASS] Model "${modelDisplayName}" (${modelName}): Supports JSON mode and returned expected structure.`
        );
        return true;
      } else if (typeof jsonOutput === 'object' && jsonOutput !== null) {
        console.log(
          `  [PASS] Model "${modelDisplayName}" (${modelName}): Returned valid JSON, but structure/key differs. Extracted: ${extractedJsonText.trim()}`
        );
        return true;
      } else {
        console.warn(
          `  [FAIL] Model "${modelDisplayName}" (${modelName}): Parsed content was not a valid JSON object or did not meet criteria. Parsed:`,
          jsonOutput,
          `Extracted: ${extractedJsonText.trim()}`
        );
        return false;
      }
    } catch (jsonError) {
      console.warn(
        `  [FAIL] Model "${modelDisplayName}" (${modelName}): Could not parse extracted text as JSON. Extracted: "${extractedJsonText.trim()}". Raw: "${responseText}". Error: ${jsonError.message}`
      );
      return false;
    }
  } catch (error) {
    // Type guard for error properties
    const message =
      error && typeof error.message === 'string'
        ? error.message.toLowerCase()
        : '';
    const status =
      error && typeof error.status === 'number' ? error.status : undefined;
    const response =
      error && typeof error.response === 'object' ? error.response : undefined; // For SDK errors that might nest status

    if (
      message &&
      (message.includes('json mode is not enabled for') ||
        message.includes('json is not supported') ||
        (status === 400 && message.includes('json')) || // General JSON related 400
        (response &&
          typeof response.status === 'number' &&
          response.status === 400 &&
          message.includes('json')))
    ) {
      console.warn(
        `  [FAIL] Model "${modelDisplayName}" (${modelName}): Does not support JSON mode (Gemini API error: ${error.message}).`
      );
    } else if (message && message.includes('access_token_scope_insufficient')) {
      console.warn(
        `  [FAIL] Model "${modelDisplayName}" (${modelName}): Access token scope insufficient.`
      );
    } else if (message && message.includes('model not found')) {
      console.warn(
        `  [FAIL] Model "${modelDisplayName}" (${modelName}): Model not found by API key.`
      );
    } else {
      console.error(
        `  [FAIL] Model "${modelDisplayName}" (${modelName}): Error during direct Gemini call: ${error.message || error}`
      );
      if (error.cause) console.error('    Cause:', error.cause);
    }
    return false;
  }
}

async function main() {
  await loadEnv();

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.error(
      '[JSON Test Script] GEMINI_API_KEY is not set in .env. Exiting.'
    );
    process.exit(1);
  }
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  const baseApiUrlForListModels =
    process.env.TEST_API_BASE_URL_FOR_LIST_MODELS ||
    process.env.NEXT_PUBLIC_GENERATE_API_URL ||
    'https://online-everything-tool.com';

  console.log(
    `[JSON Test Script] Using Base API URL for /api/list-models: ${baseApiUrlForListModels}`
  );

  const modelsListedByApi = await getModelsToTest(baseApiUrlForListModels);
  if (modelsListedByApi.length === 0) {
    console.log(
      '[JSON Test Script] No models returned by /api/list-models to test. Exiting.'
    );
    return;
  }

  const modelsToExclude = [];
  const modelsToKeep = [];

  for (const model of modelsListedByApi) {
    if (!model.name || !model.displayName) {
      console.warn(
        '[JSON Test Script] Skipping model from /api/list-models with missing name or displayName:',
        model
      );
      continue;
    }
    const supportsJson = await testModelForJsonModeDirectly(
      genAI,
      model.name,
      model.displayName
    );
    if (!supportsJson) {
      modelsToExclude.push({
        name: model.name,
        displayName: model.displayName,
        reason: 'Failed direct JSON mode compatibility test with Gemini API.',
      });
    } else {
      modelsToKeep.push(model.name);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('\n[JSON Test Script] --- Test Summary ---');
  console.log(
    `Total models from /api/list-models (filterExcluded=false): ${modelsListedByApi.length}`
  );
  console.log(`Models passing direct JSON mode test: ${modelsToKeep.length}`);
  console.log(
    `Models failing direct JSON mode test (to be excluded): ${modelsToExclude.length}`
  );

  if (modelsToExclude.length > 0) {
    console.log('\nModels to exclude:');
    modelsToExclude.forEach((m) =>
      console.log(`- ${m.displayName} (${m.name}): ${m.reason}`)
    );
    try {
      await fs.mkdir(path.dirname(EXCLUDE_FILE_PATH), { recursive: true });
      await fs.writeFile(
        EXCLUDE_FILE_PATH,
        JSON.stringify(modelsToExclude, null, 2)
      );
      console.log(
        `\n[JSON Test Script] Successfully wrote ${modelsToExclude.length} model(s) to exclude list: ${EXCLUDE_FILE_PATH}`
      );
    } catch (error) {
      console.error(
        `[JSON Test Script] Error writing exclude file: ${error.message}`
      );
    }
  } else {
    console.log(
      '\n[JSON Test Script] No models failed the direct JSON mode test. Exclude file not updated.'
    );
  }
}

main().catch((err) => {
  console.error('[JSON Test Script] Unhandled error in main:', err);
  process.exit(1);
});
