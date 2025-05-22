// scripts/test-analyze-directive-name.mjs
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to load .env (basic version)
async function loadEnv() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
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
    console.log('[Test Analyze Script] .env file loaded.');
  } catch (error) {
    console.warn(
      '[Test Analyze Script] Could not load .env file. Error: ' + error.message
    );
  }
}

async function main() {
  await loadEnv();

  const args = process.argv.slice(2);
  const proposedDirective = args[0];

  if (!proposedDirective) {
    console.error(
      'Usage: node scripts/test-analyze-directive-name.mjs <proposed-directive-name>'
    );
    process.exit(1);
  }

  // Use NEXT_PUBLIC_GENERATE_API_URL if set (for EC2), otherwise default to live/local Netlify URL
  // Or, if APP_URL secret was what you used in CI, align with that.
  // For local testing of a Netlify function, it might be http://localhost:8888/api/analyze-directive-name
  // For testing EC2, it would be your NEXT_PUBLIC_GENERATE_API_URL + /api/analyze-directive-name
  // For live site, it's the production URL.

  // Let's make it configurable or use a sensible default for local testing
  const baseApiUrl =
    process.env.TEST_API_BASE_URL ||
    process.env.NEXT_PUBLIC_GENERATE_API_URL ||
    'https://online-everything-tool.com';
  const apiEndpoint = `${baseApiUrl}/api/analyze-directive-name`;

  console.log(
    `[Test Analyze Script] Testing directive: "${proposedDirective}"`
  );
  console.log(`[Test Analyze Script] Against API endpoint: ${apiEndpoint}`);

  const payload = {
    proposedDirective: proposedDirective,
    // You can make these configurable via more CLI args if needed
    existingDirectives: ['image-flip', 'text-reverse', 'json-formatter'],
    generativeDescription: `A tool that likely does something related to ${proposedDirective.replace(/-/g, ' ')}.`,
  };

  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add any necessary auth headers if your API requires them (e.g., an API key for the EC2 endpoint)
        // 'X-Api-Key': process.env.MY_EC2_API_KEY
      },
      body: JSON.stringify(payload),
    });

    console.log(
      `[Test Analyze Script] API Response Status: ${response.status} ${response.statusText}`
    );

    const responseBody = await response.json().catch((e) => {
      console.error(
        '[Test Analyze Script] Failed to parse JSON response body:',
        e
      );
      return {
        error: 'Invalid JSON response',
        rawText: response.text ? response.text() : 'Could not get raw text.',
      };
    });

    console.log('[Test Analyze Script] API Response Body:');
    console.log(JSON.stringify(responseBody, null, 2));

    if (!response.ok) {
      console.error(`[Test Analyze Script] API call failed.`);
    } else {
      console.log(`[Test Analyze Script] API call successful.`);
    }
  } catch (error) {
    console.error(
      '❌ [Test Analyze Script] Error making API call:',
      error.message
    );
    if (error.cause) {
      console.error('  Cause:', error.cause);
    }
  }
}

main();
