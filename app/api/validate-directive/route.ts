// /app/api/validate-directive/route.ts

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import fs from 'fs/promises';
import path from 'path';

// --- Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL_NAME = process.env.DEFAULT_GEMINI_MODEL_NAME;

// --- Helper Function to Get Context (Unchanged) ---
async function getApplicationContext() {
    let appDescription = "A collection of client-side utility tools.";
    let existingDirectives: string[] = [];
    try {
        const packageJsonPath = path.resolve(process.cwd(), 'package.json');
        const packageJsonData = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonData);
        appDescription = packageJson.description || appDescription;
        console.log(`[Context] App Description: ${appDescription}`);
        const toolsDirPath = path.resolve(process.cwd(), 'app', 't');
        const entries = await fs.readdir(toolsDirPath, { withFileTypes: true });
        existingDirectives = entries
            .filter(dirent => dirent.isDirectory()).map(dirent => dirent.name)
            .filter(name => !name.startsWith('_'));
        console.log(`[Context] Existing Directives: ${existingDirectives.join(', ')}`);
    } catch (error) {
        console.warn('[Context] Warning: Could not fully read application context:', error);
    }
    return { applicationDescription: appDescription, existingDirectives };
}
// --- End Helper Function ---

// Initialize GenAI Client
if (!API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY environment variable is not set.");
}
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// --- Generation Config & Safety Settings (DEFINED HERE) ---
const generationConfig = {
  temperature: 0.6, // Slightly lower temp for more focused description
  topK: 1,
  topP: 1,
  maxOutputTokens: 200, // Allow slightly more tokens for JSON structure + description
  // responseMimeType: "application/json", // Uncomment if model supports
};
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];
// --- END Definitions ---


export async function POST(request: Request) {
  console.log('[API /validate-directive] Received request');

  if (!genAI) {
      console.error("[API /validate-directive] AI Service configuration error (Client init failed).");
      return NextResponse.json({ valid: false, description: null, message: "AI service configuration error." }, { status: 500 });
  }

  const { applicationDescription, existingDirectives } = await getApplicationContext();

  try {
    const body = await request.json();
    const { toolDirective, modelName: requestedModelName } = body;

    console.log(`[API /validate-directive] Received directive: ${toolDirective}, requested model: ${requestedModelName || 'None'}`);

    // --- Determine Final Model Name ---
    let finalModelName: string | undefined | null = null;
    if (requestedModelName && typeof requestedModelName === 'string' && requestedModelName.trim() !== '') {
        finalModelName = requestedModelName.trim();
        console.log(`[API /validate-directive] Using model name from request: ${finalModelName}`);
    }
    else if (DEFAULT_MODEL_NAME && typeof DEFAULT_MODEL_NAME === 'string' && DEFAULT_MODEL_NAME.trim() !== '') {
        finalModelName = DEFAULT_MODEL_NAME.trim();
        console.log(`[API /validate-directive] No valid requested model, using default from .env: ${finalModelName}`);
    }
    // --- End Determine Final Model Name ---

    // --- Input Validation ---
    if (!finalModelName) {
         console.error('[API /validate-directive] No valid AI model name available (neither requested nor default).');
         return NextResponse.json({ valid: false, description: null, message: 'AI model configuration error: No model specified.' }, { status: 400 });
    }
    if (!toolDirective || typeof toolDirective !== 'string' || toolDirective.trim() === '') {
        return NextResponse.json({ valid: false, description: null, message: 'Tool directive cannot be empty.' }, { status: 400 });
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(toolDirective)) {
       return NextResponse.json({ valid: false, description: null, message: 'Directive format is invalid (use lowercase letters, numbers, hyphens).' }, { status: 400 });
    }
     if (existingDirectives.includes(toolDirective)) {
         return NextResponse.json({ valid: false, description: null, message: `Validation failed: A tool with the directive '${toolDirective}' already exists.` }, { status: 400 });
     }
    // --- End Input Validation ---


    // --- Gemini API Call ---
    console.log(`[API /validate-directive] Calling Gemini (${finalModelName}) for directive: ${toolDirective}`);
    const model = genAI.getGenerativeModel({ model: finalModelName });

    // --- REFINED PROMPT V3 ---
    const prompt = `
You are an assistant evaluating potential new tool directives (URL slugs) for a web application.

**Application Context:**
- Stated Purpose: "${applicationDescription}"
- **Intended Character:** The application focuses on **practical, developer-centric client-side utilities** for tasks like data transformation, text manipulation, encoding/decoding, format conversion, simple media inspection/generation, and web development helpers. It avoids purely whimsical, nonsensical, or highly complex/specialized tools.
- Existing Tools (Directives): ${existingDirectives.join(', ')}

**Task:**
1. Analyze the **New Directive**: "${toolDirective}".
2. Evaluate its suitability based on the following criteria:
    - **Uniqueness:** Is it sufficiently distinct from existing directives (considering function, not just keywords)? Avoid near-duplicates.
    - **Scope & Sensibility:** Does it fit the application's intended character (practical, developer-centric utility)? Is the implied function sensible and technically feasible as a standard client-side browser tool? **Reject directives that are nonsensical (e.g., 'banana-angry-chart'), purely whimsical, impossible, or clearly unrelated to typical developer/data tasks.**
    - **Clarity:** Is the directive specific enough to clearly imply a primary function? Avoid overly generic terms without context (e.g., 'converter', 'formatter').
    - **Format:** Does it appear to be a reasonable, URL-friendly slug?
3. Based on your evaluation, respond **ONLY** with a single JSON object matching one of the structures below.

**Regarding the 'generative_description':**
   - If the directive is VALID, you must generate a value for the 'generative_description' field.
   - This description should be a concise, single sentence (max 150 chars) describing the tool's likely function, phrased as if explaining it to a user (e.g., "Converts JSON data input into YAML format.").
   - Focus on the primary input and output implied by the directive name.
   - **Crucially, this description serves as a starting point for the user, who may add more details later before the final tool code (page.tsx) is generated.** Aim for clarity and accuracy based *only* on the directive and application context.

**Output Structures:** (Respond ONLY with the JSON object, no extra text or markdown formatting)

*   **If the directive is VALID and SUITABLE:**
    \`\`\`json
    {
      "evaluation": "VALID",
      "reason": null,
      "generative_description": "<Populate with the generated user-centric description based on instructions above>"
    }
    \`\`\`

*   **If the directive is INVALID due to DUPLICATION:**
    \`\`\`json
    {
      "evaluation": "INVALID",
      "reason": "DUPLICATE",
      "generative_description": null
    }
    \`\`\`

*   **If the directive is INVALID due to being TOO VAGUE/GENERIC:**
    \`\`\`json
    {
      "evaluation": "INVALID",
      "reason": "VAGUE",
      "generative_description": null
    }
    \`\`\`

*   **If the directive is INVALID because it's OUTSIDE THE APPLICATION'S SCOPE or NONSENSICAL/UNFEASIBLE:**
    \`\`\`json
    {
      "evaluation": "INVALID",
      "reason": "OUT_OF_SCOPE_OR_NONSENSICAL",
      "generative_description": null
    }
    \`\`\`

*   **If the directive is INVALID for OTHER specific reasons:**
    \`\`\`json
    {
      "evaluation": "INVALID",
      "reason": "OTHER",
      "generative_description": null
    }
    \`\`\`
`; // End of prompt string
    console.log("--- Using Prompt --- \n", prompt, "\n--------------------");
    // --- End Refined Prompt V3 ---


    let generativeDescription: string | null = null;
    let isValid = false;
    let message = "";

    try {
        const result = await model.generateContent({
             contents: [{ role: "user", parts: [{ text: prompt }] }],
             generationConfig, // Use defined config
             safetySettings,   // Use defined settings
        });

        // --- Process Gemini Response (Parsing JSON - Unchanged logic) ---
        if (result.response) {
            let responseText = result.response.text().trim();
            console.log(`[API /validate-directive] Gemini raw response text: "${responseText}"`);
            responseText = responseText.replace(/^```json\s*|```\s*$/g, '');

            try {
                const parsedJson = JSON.parse(responseText);
                if (parsedJson.evaluation === "VALID" && typeof parsedJson.generative_description === 'string') {
                    isValid = true;
                    generativeDescription = parsedJson.generative_description.trim();
                    message = "Directive validated. Review the generative description.";
                    console.log(`[API /validate-directive] Parsed Valid Response: description="${generativeDescription}"`);
                } else if (parsedJson.evaluation === "INVALID" && typeof parsedJson.reason === 'string') {
                    isValid = false;
                    generativeDescription = null;
                    switch (parsedJson.reason) {
                        case "DUPLICATE":
                            message = "Validation Failed: Directive is too similar to an existing tool.";
                            break;
                        case "VAGUE":
                            message = "Validation Failed: Directive is too vague or generic. Be more specific.";
                            break;
                        case "OUT_OF_SCOPE_OR_NONSENSICAL":
                            message = "Validation Failed: Directive is out of scope (not a practical developer utility), nonsensical, or unfeasible.";
                            break;
                        case "OTHER":
                        default:
                            message = "Validation Failed: Directive deemed unsuitable by AI.";
                            break;
                    }
                    console.log(`[API /validate-directive] Parsed Invalid Response: reason="${parsedJson.reason}"`);
                } else {
                    throw new Error("Unexpected JSON structure received from AI.");
                }
            } catch (parseError) {
                console.error('[API /validate-directive] Error parsing JSON response from Gemini:', parseError);
                console.error('[API /validate-directive] Raw text was:', responseText);
                isValid = false;
                message = "AI response format error. Could not interpret validation result.";
                const blockReason = result.response.promptFeedback?.blockReason;
                 if (blockReason) {
                     message += ` Possible block reason: ${blockReason}`;
                     console.warn(`[API /validate-directive] Gemini response blocked. Reason: ${blockReason}`, result.response.promptFeedback);
                 }
            }
        } else {
            message = "AI validation failed: No response object received.";
            isValid = false;
            console.error('[API /validate-directive] Gemini result missing response object.');
        }
        // --- End Process Gemini Response ---

    } catch (geminiError: unknown) {
        console.error('[API /validate-directive] Error calling Gemini API:', geminiError);
        isValid = false;
        message = `AI service error during validation. Please try again later.`;
    }

    // --- Return Response Based on Validation Outcome (Unchanged logic) ---
    if (isValid && generativeDescription) {
        return NextResponse.json({ valid: true, description: generativeDescription, message: message }, { status: 200 });
    } else {
        message = message || "Directive validation failed.";
        return NextResponse.json({ valid: false, description: null, message: message }, { status: 400 });
    }
    // --- End Gemini API Call ---

  } catch (error: unknown) {
    // --- General Error Handling (Unchanged logic) ---
    console.error('[API /validate-directive] General error processing request:', error);
    let errorMessage = 'An unexpected error occurred during validation.';
    let status = 500;
    if (error instanceof SyntaxError) {
        errorMessage = 'Invalid JSON payload received.';
        status = 400;
    }
    return NextResponse.json({ valid: false, description: null, message: errorMessage }, { status: status });
  }
}