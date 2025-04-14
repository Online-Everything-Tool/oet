// FILE: app/api/validate-directive/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
    GenerationConfig,
    SafetySetting,
} from "@google/generative-ai";
import fs from 'fs/promises';
import path from 'path';

// --- Interfaces ---
interface RequestBody {
    toolDirective: string;
    modelName?: string;
}

// --- Constants ---
const DEFAULT_MODEL_NAME = "gemini-1.5-flash-latest";
const API_KEY = process.env.GEMINI_API_KEY;

// --- Helper: Get available tool directives ---
async function getAvailableDirectives(): Promise<string[]> {
    const toolsDirPath = path.join(process.cwd(), 'app', 't');
    const directives: string[] = [];
    try {
        const entries = await fs.readdir(toolsDirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('_')) {
                directives.push(entry.name);
            }
        }
    } catch (error) {
        console.error("[API validate-directive] Error reading tools directory:", error);
        // Return empty or handle error as appropriate
    }
    return directives.sort();
}

// --- Main API Handler ---
export async function POST(req: NextRequest) {
    if (!API_KEY) {
        return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    try {
        const body: RequestBody = await req.json();
        const toolDirective = body.toolDirective?.trim();
        const modelName = body.modelName || DEFAULT_MODEL_NAME;

        if (!toolDirective) {
            return NextResponse.json({ valid: false, message: "Tool directive is required." }, { status: 400 });
        }

        // Basic Validation (Format: kebab-case, no special chars except hyphen)
        const directiveRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        if (!directiveRegex.test(toolDirective)) {
            return NextResponse.json({
                valid: false,
                message: "Invalid format. Directive must be lowercase kebab-case (e.g., 'text-formatter', 'image-resizer')."
            }, { status: 400 });
        }

        const availableDirectives = await getAvailableDirectives();
        if (availableDirectives.includes(toolDirective)) {
            return NextResponse.json({
                valid: false,
                message: `Directive "${toolDirective}" already exists.`
            }, { status: 409 }); // 409 Conflict
        }

        // --- Gemini Interaction ---
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: modelName });

        const generationConfig: GenerationConfig = {
          temperature: 0.6, // Slightly creative but still grounded
          topK: 40,
          topP: 0.9,
          maxOutputTokens: 1024,
          responseMimeType: "application/json", // Expect JSON response
        };

        const safetySettings: SafetySetting[] = [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ];

        // *** UPDATED PROMPT: Requesting 3 examples ***
        const prompt = `
Analyze the proposed tool directive "${toolDirective}" for the "Online Everything Tool" project.

The project provides free, client-side browser utilities. Adhere to these strict rules:
1. Tool logic MUST primarily run client-side (in the browser). No server-side processing for core functionality.
2. Directives MUST be lowercase kebab-case (e.g., 'text-reverse', 'json-validator-formatter').
3. Directives should represent a clear 'thing-operation' or 'thing-operation-operation' structure.

Existing tool directives are: ${availableDirectives.join(', ')}.

Based on the proposed directive "${toolDirective}":

1.  **Validate:** Does it seem like a feasible client-side tool? Does it follow the naming rules? Is it unique?
2.  **Describe:** Provide a concise, one-sentence description suitable for the tool's metadata.json file.
3.  **Suggest Examples:** Identify EXACTLY THREE existing tool directives from the list above that would be most relevant as implementation examples for building this new tool. Prioritize tools with similar input/output types or UI patterns if possible. If fewer than three truly relevant examples exist, provide as many as make sense, but aim for three.

Return the response ONLY as a valid JSON object with the following structure:
{
  "directive": "${toolDirective}",
  "isValid": boolean, // true if it seems like a valid, unique, client-side tool idea, false otherwise
  "validationMessage": "string", // Brief reason if invalid, or "Directive appears valid." if valid.
  "generativeDescription": "string", // One-sentence description for metadata.
  "generativeRequestedDirectives": ["string"] // Array containing EXACTLY THREE suggested existing directive names, or fewer if not applicable.
}
        `;

        const parts = [{ text: prompt }];
        const result = await model.generateContent({ contents: [{ role: "user", parts }], generationConfig, safetySettings });

        if (!result.response) {
             throw new Error("Gemini API call failed: No response received.");
        }

        const responseText = result.response.text();
        console.log("[API validate-directive] Raw Gemini Response:", responseText);

        // --- Parse Gemini Response ---
        let parsedResponse: any;
        try {
            parsedResponse = JSON.parse(responseText);
        } catch (e) {
            console.error("[API validate-directive] Failed to parse Gemini JSON response:", e);
            console.error("[API validate-directive] Response Text Was:", responseText); // Log the problematic text
            throw new Error("Failed to parse validation response from AI.");
        }

        // --- Validate Parsed Structure ---
         if (typeof parsedResponse !== 'object' || parsedResponse === null ||
             typeof parsedResponse.isValid !== 'boolean' ||
             typeof parsedResponse.validationMessage !== 'string' ||
             typeof parsedResponse.generativeDescription !== 'string' ||
             !Array.isArray(parsedResponse.generativeRequestedDirectives) ||
             !parsedResponse.generativeRequestedDirectives.every((item: unknown) => typeof item === 'string') )
         {
              console.error("[API validate-directive] Invalid structure in parsed AI response:", parsedResponse);
              throw new Error("Received malformed validation data structure from AI.");
         }

        // Return the validated response
        if (parsedResponse.isValid) {
             return NextResponse.json({
                 valid: true,
                 message: parsedResponse.validationMessage,
                 generativeDescription: parsedResponse.generativeDescription,
                 generativeRequestedDirectives: parsedResponse.generativeRequestedDirectives,
             }, { status: 200 });
        } else {
             // Even if AI says invalid, we return 200 but with valid: false
             // Let the frontend decide how to handle the AI's validation opinion
             return NextResponse.json({
                 valid: false,
                 message: parsedResponse.validationMessage || "AI validation indicated an issue.",
                 generativeDescription: parsedResponse.generativeDescription, // Still send description back
                 generativeRequestedDirectives: parsedResponse.generativeRequestedDirectives, // And suggestions
             }, { status: 200 });
        }

    } catch (error: unknown) {
        console.error("[API validate-directive] Error:", error);
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        // Check for specific Gemini content safety errors
        if (message.includes("response was blocked due to safety")) {
             return NextResponse.json({ error: "Validation blocked due to safety settings.", details: message }, { status: 400 });
        }
        return NextResponse.json({ error: `Internal Server Error: ${message}` }, { status: 500 });
    }
}