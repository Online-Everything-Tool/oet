// /app/api/list-models/route.ts

import { NextResponse } from 'next/server';
// Remove GoogleGenerativeAI import if ONLY used for listModels here
// import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;

// Basic check for API Key
if (!API_KEY) {
    console.error("FATAL ERROR (list-models): GEMINI_API_KEY environment variable is not set.");
    // Optional: Throw error or handle differently if needed
}

// We don't need the genAI instance for this specific REST call route
// const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: Request) {
    console.log('[API /list-models] Received request (Using REST API)');

    if (!API_KEY) {
        console.error("[API /list-models] GEMINI_API_KEY is missing.");
        return NextResponse.json({ error: "AI service configuration error (API Key missing)." }, { status: 500 });
    }

    // --- Use Fetch to Call REST API ---
    const REST_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    // Alternative: Pass key in header:
    // const REST_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models`;
    // const headers = { 'x-goog-api-key': API_KEY }; // Need to add headers to fetch options

    try {
        console.log(`[API /list-models] Fetching models from REST endpoint: ${REST_API_ENDPOINT.split('?')[0]}...`); // Don't log key

        const response = await fetch(REST_API_ENDPOINT, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // Add API key header here if not using query param:
                // 'x-goog-api-key': API_KEY
            }
        });

        console.log(`[API /list-models] REST API response status: ${response.status}`);

        if (!response.ok) {
            let errorBody = 'Unknown API error';
            try {
                // Attempt to parse error details from Google's response
                const errorData = await response.json();
                console.error('[API /list-models] REST API Error Response:', errorData);
                errorBody = errorData?.error?.message || `API request failed with status ${response.status}`;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_parseError) {
                console.error('[API /list-models] Failed to parse error response body.');
                errorBody = `API request failed with status ${response.status}`;
            }
            throw new Error(errorBody);
        }

        // --- Process Successful REST Response ---
        const data = await response.json();
        // The REST API typically returns an object like { models: [...] }
        const modelsFromApi = data?.models || [];
        console.log(`[API /list-models] Received ${modelsFromApi.length} models from REST API.`);

        const availableModels = [];
        for (const model of modelsFromApi) {
            // REST API model structure might differ slightly, adjust property names if needed
            // Common properties: name, displayName, version, supportedGenerationMethods
            if (model.supportedGenerationMethods && model.supportedGenerationMethods.includes("generateContent")) {
                console.log(`[API /list-models] Found compatible model: ${model.displayName} (${model.name})`);
                 availableModels.push({
                    name: model.name, // Usually like "models/gemini-1.5-flash-latest"
                    displayName: model.displayName || model.name, // Fallback if displayName is missing
                    version: model.version || 'unknown', // Fallback
                });
            } else {
                console.log(`[API /list-models] Skipping model (unsupported method or missing data): ${model.displayName || model.name}`);
            }
        }
        console.log(`[API /list-models] Finished processing. Found ${availableModels.length} compatible models.`);
        // ---

        // Sort models (optional)
        availableModels.sort((a, b) => {
            if (a.name.includes('flash') && !b.name.includes('flash')) return -1;
            if (!a.name.includes('flash') && b.name.includes('flash')) return 1;
            if (a.name.includes('pro') && !b.name.includes('pro')) return -1;
            if (!a.name.includes('pro') && b.name.includes('pro')) return 1;
            return a.displayName.localeCompare(b.displayName);
        });

        return NextResponse.json({ models: availableModels }, { status: 200 });

    } catch (error: unknown) {
        console.error('[API /list-models] Error occurred during model listing fetch process.');
        let message = 'Failed to fetch available AI models.';

        if (error instanceof Error) {
            console.error(`[API /list-models] Error Name: ${error.name}`);
            console.error(`[API /list-models] Error Message: ${error.message}`); // Will show API error message if response.ok was false
            console.error(`[API /list-models] Error Stack: ${error.stack}`);
            message = error.message; // Use the more specific error message
        } else {
             console.error('[API /list-models] Unknown error type:', error);
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}