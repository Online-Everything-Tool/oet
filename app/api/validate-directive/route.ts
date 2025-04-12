// /app/api/validate-directive/route.ts

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import fs from 'fs/promises';
import path from 'path';

// --- Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL_NAME = process.env.DEFAULT_GEMINI_MODEL_NAME;

// --- Helper Function to Get Context ---
async function getApplicationContext() {
    let packageJsonContent = '{}'; let existingDirectives: string[] = [];
    try {
        const packageJsonPath = path.resolve(process.cwd(), 'package.json'); packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
        const toolsDirPath = path.resolve(process.cwd(), 'app', 't'); const entries = await fs.readdir(toolsDirPath, { withFileTypes: true });
        existingDirectives = entries.filter(d => d.isDirectory() && !d.name.startsWith('_')).map(d => d.name);
    } catch (_error) { console.warn('[Context] Warning:', _error); packageJsonContent = '{}'; existingDirectives = []; }
    return { packageJsonContent, existingDirectives };
}
// --- End Helper Function ---

// Initialize GenAI Client
if (!API_KEY) console.error("FATAL ERROR (validate-directive): GEMINI_API_KEY missing.");
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// --- Generation Config & Safety Settings ---
const generationConfig = { temperature: 0.6, topK: 1, topP: 1, maxOutputTokens: 300 };
const safetySettings = [ { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }, ];
// --- END Definitions ---

export async function POST(request: Request) {
  console.log('[API /validate-directive] Received request');
  if (!genAI) { console.error("[API /validate-directive] AI Service configuration error."); return NextResponse.json({ valid: false, generativeDescription: null, message: "AI service configuration error.", generativeRequestedDirectives: [] }, { status: 500 }); }

  const { packageJsonContent, existingDirectives } = await getApplicationContext();

  try {
    const body = await request.json();
    const { toolDirective, modelName: requestedModelName } = body;
    console.log(`[API /validate-directive] Directive: ${toolDirective}, Model: ${requestedModelName || 'None'}`);

    // --- FIX: Use const ---
    const finalModelName = requestedModelName?.trim() || DEFAULT_MODEL_NAME?.trim();

    if (!finalModelName) { console.error('[API /validate-directive] No valid AI model name available.'); return NextResponse.json({ valid: false, generativeDescription: null, message: 'AI model configuration error.', generativeRequestedDirectives: [] }, { status: 400 }); }
    if (!toolDirective || typeof toolDirective !== 'string' || toolDirective.trim() === '') { return NextResponse.json({ valid: false, generativeDescription: null, message: 'Tool directive cannot be empty.', generativeRequestedDirectives: [] }, { status: 400 }); }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(toolDirective)) { return NextResponse.json({ valid: false, generativeDescription: null, message: 'Directive format is invalid.', generativeRequestedDirectives: [] }, { status: 400 }); }
    if (existingDirectives.includes(toolDirective)) { return NextResponse.json({ valid: false, generativeDescription: null, message: `Directive '${toolDirective}' already exists.`, generativeRequestedDirectives: [] }, { status: 400 }); }
    if (existingDirectives.length < 2) { console.warn('[API /validate-directive] Fewer than 2 existing tools, cannot request examples effectively.'); }

    console.log(`[API /validate-directive] Calling Gemini (${finalModelName}) for directive: ${toolDirective}`);
    const model = genAI.getGenerativeModel({ model: finalModelName });

    // Prompt remains the same (V7)
    const prompt = `
You are an assistant evaluating potential new tool directives (URL slugs) for a web application defined by the following \`package.json\`.
**Application Context:**
\`\`\`json
${packageJsonContent}
\`\`\`
- **Intended Character (Derived):** Practical, developer-centric client-side utilities.
- Existing Tools (Directives): ${existingDirectives.join(', ')}
**Task:**
1. Analyze the **New Directive**: "${toolDirective}". 2. Evaluate its suitability (uniqueness, scope, sensibility, clarity, format). 3. **If the directive is VALID:** - Generate a concise, single-sentence description (\`generative_description\`) for the user (max 150 chars). - Select exactly TWO existing directives from the list whose code would be the best examples for implementing the new tool. Add these directive names as an array to \`generative_requested_directives\`. These examples will be provided to the next AI step for code generation. If fewer than two relevant examples exist, provide the best one(s). 4. Respond **ONLY** with a single JSON object matching one of the structures below.
**Output Structures:** (Use these exact field names)
*   **If VALID:** \`\`\`json { "evaluation": "VALID", "reason": null, "generative_description": "<Generated user-centric description>", "generative_requested_directives": ["<example_directive_1>", "<example_directive_2>"] } \`\`\`
*   **If INVALID (any reason):** \`\`\`json { "evaluation": "INVALID", "reason": "<DUPLICATE | VAGUE | OUT_OF_SCOPE_OR_NONSENSICAL | OTHER>", "generative_description": null, "generative_requested_directives": [] } \`\`\`
`;

    let finalGenerativeDescription: string | null = null; let finalGenerativeRequestedDirectives: string[] = [];
    let isValid = false; let message = "";

    try {
        const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig, safetySettings, });

        if (result.response) {
            // --- FIX: Refactor responseText handling ---
            const rawResponseText = result.response.text().trim();
            console.log(`[API /validate-directive] Gemini raw response text: "${rawResponseText}"`);
            // Clean potential markdown fences in a new const
            const cleanedResponseText = rawResponseText.replace(/^```json\s*|\s*```$/g, '');

            try {
                const parsedJson = JSON.parse(cleanedResponseText); // Parse the cleaned text

                if (parsedJson.evaluation === "VALID" && typeof parsedJson.generative_description === 'string' && Array.isArray(parsedJson.generative_requested_directives) ) {
                    isValid = true; finalGenerativeDescription = parsedJson.generative_description.trim();
                    finalGenerativeRequestedDirectives = parsedJson.generative_requested_directives.filter((ex: unknown) => typeof ex === 'string' && existingDirectives.includes(ex as string)).slice(0, 2);
                    if (finalGenerativeRequestedDirectives.length < 2 && existingDirectives.length >=2) { console.warn(`[API /validate-directive] AI requested fewer than 2 valid directives.`); }
                    message = "Directive validated. Review description and requested example directives.";
                    console.log(`[API /validate-directive] Parsed Valid Response: description="${finalGenerativeDescription}", requestedDirectives=[${finalGenerativeRequestedDirectives.join(', ')}]`);
                } else if (parsedJson.evaluation === "INVALID" && typeof parsedJson.reason === 'string') {
                    isValid = false; finalGenerativeDescription = null; finalGenerativeRequestedDirectives = [];
                    switch (parsedJson.reason) { case "DUPLICATE": message = "Validation Failed: Directive is too similar."; break; case "VAGUE": message = "Validation Failed: Directive is too vague."; break; case "OUT_OF_SCOPE_OR_NONSENSICAL": message = "Validation Failed: Directive is out of scope or nonsensical."; break; default: message = "Validation Failed: Directive deemed unsuitable."; break; }
                    console.log(`[API /validate-directive] Parsed Invalid Response: reason="${parsedJson.reason}"`);
                } else { throw new Error("Unexpected JSON structure received from AI."); }
            } catch (parseError) {
                console.error('[API /validate-directive] Error parsing JSON response:', parseError, `Raw text: ${cleanedResponseText}`); // Log cleaned text
                isValid = false; message = "AI response format error.";
                const blockReason = result.response.promptFeedback?.blockReason; if (blockReason) { message += ` Block reason: ${blockReason}`; }
            }
        } else { message = "AI validation failed: No response object."; isValid = false; console.error('[API /validate-directive] Gemini result missing response object.'); }

    } catch (geminiError: unknown) { console.error('[API /validate-directive] Error calling Gemini API:', geminiError); isValid = false; message = `AI service error during validation.`; }

    if (isValid && finalGenerativeDescription) { return NextResponse.json({ valid: true, generativeDescription: finalGenerativeDescription, message: message, generativeRequestedDirectives: finalGenerativeRequestedDirectives }, { status: 200 }); }
    else { message = message || "Directive validation failed."; return NextResponse.json({ valid: false, generativeDescription: null, message: message, generativeRequestedDirectives: [] }, { status: 400 }); }

  } catch (_error) { console.error('[API /validate-directive] General error:', _error); let errorMessage = 'Unexpected error.'; let status = 500; if (_error instanceof SyntaxError) { errorMessage = 'Invalid JSON payload.'; status = 400; } return NextResponse.json({ valid: false, generativeDescription: null, message: errorMessage, generativeRequestedDirectives: [] }, { status: status }); }
}