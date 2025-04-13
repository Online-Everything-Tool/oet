// /app/api/analyze-directive-name/route.ts

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import fs from 'fs/promises';
import path from 'path';

// --- Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL_NAME = process.env.DEFAULT_GEMINI_MODEL_NAME || "models/gemini-1.5-flash-latest"; // Use a reasonable default

// --- Helper: Get App Purpose (Simplified) ---
async function getAppPurpose(): Promise<string> {
     try {
        const packageJsonPath = path.resolve(process.cwd(), 'package.json');
        const packageJsonData = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonData);
        return packageJson.description || "a collection of client-side utility tools";
    } catch (_error) {
        console.warn(`[API analyze-directive] Could not read package.json description. ${_error}`);
        return "a collection of client-side utility tools";
    }
}

// Initialize GenAI Client
if (!API_KEY) console.error("FATAL ERROR (analyze-directive): GEMINI_API_KEY missing.");
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// --- Generation Config & Safety Settings ---
const generationConfig = { temperature: 0.4, maxOutputTokens: 250 }; // Lower temp for focused analysis
const safetySettings = [ /* ... keep standard safety settings ... */
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export async function POST(request: Request) {
    console.log(`[API analyze-directive-name] Received POST request`);

    if (!genAI) {
        return NextResponse.json({ error: "AI service configuration error." }, { status: 500 });
    }

    let proposedDirective: string | undefined;
    let existingDirectives: string[] = [];
    let generativeDescription: string | undefined;

    try {
        const body = await request.json();
        proposedDirective = body.proposedDirective?.trim();
        generativeDescription = body.generativeDescription?.trim(); // Get description from validation step

        if (Array.isArray(body.existingDirectives)) {
             existingDirectives = body.existingDirectives.filter((d: unknown) => typeof d === 'string');
        }

        if (!proposedDirective || !generativeDescription) {
             return NextResponse.json({ error: "Missing required fields: proposedDirective, generativeDescription" }, { status: 400 });
        }

    } catch (error) {
        return NextResponse.json({ error: `Invalid request body format: ${error}` }, { status: 400 });
    }

    const appPurpose = await getAppPurpose();

    // Construct Prompt for AI Analysis
    const prompt = `
Analyze the proposed tool directive \`${proposedDirective}\` for a web application.

Application Purpose: ${appPurpose}.
Existing Tool Directives: ${existingDirectives.join(', ') || 'None'}
Proposed Tool's Function (Generated Description): "${generativeDescription}"

Based ONLY on the information provided, evaluate the proposed directive:
1.  **Clarity & Conciseness:** Is the name clear and easy to understand?
2.  **Convention:** Does it follow common naming patterns (e.g., kebab-case)?
3.  **Redundancy:** Does it seem functionally very similar to an existing directive, suggesting a potentially better name or consolidation?
4.  **Typo Likelihood:** Is there a significant chance it's a typo of a more standard term or an existing directive (e.g., "test-" vs "text-", "covert" vs "convert")? Consider common English typos and the context of developer tools.
5.  **Suggestions:** If the name could be improved (due to typo, vagueness, or better alternatives), suggest 1-2 better names.

Respond ONLY with a single JSON object with the following structure:
\`\`\`json
{
  "score": <A numerical score from 0.0 (very bad name / likely typo) to 1.0 (excellent name) representing the overall quality and appropriateness>,
  "is_likely_typo": <boolean - true if a typo is strongly suspected>,
  "suggestions": ["<alternative_name_1>", "<alternative_name_2>"], // Array of strings, empty if no suggestions
  "reasoning": "<A brief (1-2 sentence) explanation for the score and suggestions/typo assessment>"
}
\`\`\`
`;

    try {
        console.log(`[API analyze-directive-name] Calling Gemini (${DEFAULT_MODEL_NAME}) for analysis of: ${proposedDirective}`);
        const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL_NAME }); // Use default or specific model

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig, safetySettings,
        });

        if (!result.response) {
             throw new Error("AI analysis failed: No response object received.");
        }

        const rawResponseText = result.response.text().trim();
        const cleanedResponseText = rawResponseText.replace(/^```json\s*|\s*```$/g, '');
        console.log(`[API analyze-directive-name] Gemini analysis raw response: ${rawResponseText}`);

        // Try to parse the JSON response
        try {
            const analysisResult = JSON.parse(cleanedResponseText);
            // Basic validation of expected fields (can be more thorough)
            if (typeof analysisResult.score !== 'number' || typeof analysisResult.is_likely_typo !== 'boolean' || !Array.isArray(analysisResult.suggestions) || typeof analysisResult.reasoning !== 'string') {
                 throw new Error("AI response missing expected JSON fields.");
            }
            console.log(`[API analyze-directive-name] Analysis successful for ${proposedDirective}`);
            return NextResponse.json(analysisResult, { status: 200 });

        } catch (parseError) {
             console.error('[API analyze-directive-name] Error parsing JSON response:', parseError, `Raw text: ${cleanedResponseText}`);
             // Return a default "unable to analyze" response
             return NextResponse.json({ score: 0.5, is_likely_typo: false, suggestions: [], reasoning: "Error: Could not parse analysis result from AI." }, { status: 200 }); // Return 200 but indicate parsing failure
        }

    } catch (error: unknown) {
        console.error('[API analyze-directive-name] Error during AI analysis:', error);
        const message = error instanceof Error ? error.message : "Unknown AI service error.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// Optional GET handler
export async function GET() {
    return NextResponse.json({ message: "API route /api/analyze-directive-name is active. Use POST." });
}