// /app/api/list-models/route.ts

import { NextResponse } from 'next/server';

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error(
    'FATAL ERROR (list-models): GEMINI_API_KEY environment variable is not set.'
  );
}

export async function GET(_request: Request) {
  console.log('[API /list-models] Received request (Using REST API)');

  if (!API_KEY) {
    console.error('[API /list-models] GEMINI_API_KEY is missing.');
    return NextResponse.json(
      { error: 'AI service configuration error (API Key missing).' },
      { status: 500 }
    );
  }

  const REST_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

  try {
    console.log(
      `[API /list-models] Fetching models from REST endpoint: ${REST_API_ENDPOINT.split('?')[0]}...`
    );

    const response = await fetch(REST_API_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(
      `[API /list-models] REST API response status: ${response.status}`
    );

    if (!response.ok) {
      let errorBody = 'Unknown API error';
      try {
        const errorData = await response.json();
        console.error('[API /list-models] REST API Error Response:', errorData);
        errorBody =
          errorData?.error?.message ||
          `API request failed with status ${response.status}`;
      } catch (_parseError) {
        console.error(
          '[API /list-models] Failed to parse error response body.'
        );
        errorBody = `API request failed with status ${response.status}`;
      }
      throw new Error(errorBody);
    }

    const data = await response.json();

    const modelsFromApi = data?.models || [];
    console.log(
      `[API /list-models] Received ${modelsFromApi.length} models from REST API.`
    );

    const availableModels = [];
    for (const model of modelsFromApi) {
      if (
        model.supportedGenerationMethods &&
        model.supportedGenerationMethods.includes('generateContent')
      ) {
        availableModels.push({
          name: model.name,
          displayName: model.displayName || model.name,
          version: model.version || 'unknown',
        });
      } else {
        console.log(
          `[API /list-models] Skipping model (unsupported method or missing data): ${model.displayName || model.name}`
        );
      }
    }
    console.log(
      `[API /list-models] Finished processing. Found ${availableModels.length} compatible models.`
    );

    availableModels.sort((a, b) => {
      if (a.name.includes('flash') && !b.name.includes('flash')) return -1;
      if (!a.name.includes('flash') && b.name.includes('flash')) return 1;
      if (a.name.includes('pro') && !b.name.includes('pro')) return -1;
      if (!a.name.includes('pro') && b.name.includes('pro')) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

    return NextResponse.json({ models: availableModels }, { status: 200 });
  } catch (error: unknown) {
    console.error(
      '[API /list-models] Error occurred during model listing fetch process.'
    );
    let message = 'Failed to fetch available AI models.';

    if (error instanceof Error) {
      console.error(`[API /list-models] Error Name: ${error.name}`);
      console.error(`[API /list-models] Error Message: ${error.message}`);
      console.error(`[API /list-models] Error Stack: ${error.stack}`);
      message = error.message;
    } else {
      console.error('[API /list-models] Unknown error type:', error);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
