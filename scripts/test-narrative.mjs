// scripts/test-narrative.mjs
import fetch from 'node-fetch'; // Make sure to install node-fetch: npm install node-fetch

const API_ENDPOINT =
  process.env.API_URL || 'http://localhost:3000/api/generate-modal-narrative'; // Adjust if your port is different or use API_URL env var

async function testNarrativeEndpoint() {
  const testPayload = {
    toolDirective: 'json-tree-viewer',
    toolDescription:
      'A tool to display JSON data in an interactive, collapsible tree view, making it easy to navigate and understand complex JSON structures.',
    generationModelName: 'models/gemini-1.5-pro-latest', // Example model
    userAdditionalDescription:
      'Make sure it can handle very large JSON files without crashing the browser, perhaps with some kind of virtualization for the tree.',
    aiRequestedExamples: ['json-validate-format', 'xml-viewer', 'file-storage'],
    userSelectedExamples: ['text-counter'],
  };

  const testPayloadMinimal = {
    toolDirective: 'quick-qr-generator',
    toolDescription:
      'Generates a QR code instantly from user-provided text or URL.',
    // Optional fields: generationModelName, userAdditionalDescription, aiRequestedExamples, userSelectedExamples
    // These will be handled by defaults or undefined in the API.
  };

  const testPayloadEmptyExamples = {
    toolDirective: 'color-palette-extractor',
    toolDescription:
      'Extracts the dominant colors from an uploaded image to create a color palette.',
    generationModelName: 'models/gemini-1.5-flash-latest',
    userAdditionalDescription: 'I want at least 5 colors, and their hex codes.',
    aiRequestedExamples: [], // Empty AI examples
    userSelectedExamples: null, // Testing null for user examples
  };

  const testPayloadNoOptionalFields = {
    toolDirective: 'text-case-randomizer',
    toolDescription: 'Randomly alters the casing of input text for fun.',
  };

  console.log(`\n--- TESTING NARRATIVE ENDPOINT: ${API_ENDPOINT} ---\n`);

  const payloadsToTest = [
    { name: 'Full Payload', data: testPayload },
    { name: 'Minimal Payload (API defaults tested)', data: testPayloadMinimal },
    {
      name: 'Payload with Empty/Null Examples',
      data: testPayloadEmptyExamples,
    },
    {
      name: 'Payload with No Optional Fields',
      data: testPayloadNoOptionalFields,
    },
  ];

  for (const { name, data } of payloadsToTest) {
    console.log(`\n--- Test Case: ${name} ---`);
    console.log('Sending payload:', JSON.stringify(data, null, 2));

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      console.log(`\nStatus Code: ${response.status}`);

      if (!response.ok) {
        let errorBodyText = `API request failed with status ${response.status}`;
        try {
          const errorJson = await response.json();
          errorBodyText = JSON.stringify(errorJson, null, 2);
        } catch (e) {
          errorBodyText = await response.text();
        }
        console.error('Error Response Body:\n', errorBodyText);
        continue;
      }

      const responseBody = await response.json(); // Removed type annotation ': any'
      console.log('\nResponse Body:');
      console.log(JSON.stringify(responseBody, null, 2));

      if (
        !responseBody ||
        typeof responseBody.epicCompanyName !== 'string' ||
        typeof responseBody.epicCompanyEmoji !== 'string' ||
        typeof responseBody.epicCompanyEmployeeName !== 'string' ||
        typeof responseBody.epicCompanyJobTitle !== 'string' ||
        typeof responseBody.epicCompanyEmployeeEmoji !== 'string' ||
        !Array.isArray(responseBody.epicNarrative)
      ) {
        console.warn(
          'WARNING: Response body is missing expected top-level fields or epicNarrative is not an array.'
        );
      } else {
        console.log(`\n--- Generated Narrative Details ---`);
        console.log(
          `Company: ${responseBody.epicCompanyEmoji} ${responseBody.epicCompanyName}`
        );
        console.log(
          `Employee: ${responseBody.epicCompanyEmployeeEmoji} ${responseBody.epicCompanyEmployeeName} (${responseBody.epicCompanyJobTitle})`
        );

        console.log(
          `\nNarrative generated with ${responseBody.epicNarrative.length} chapters.`
        );
        if (responseBody.epicNarrative.length !== 10) {
          console.warn(
            `WARNING: Expected 10 chapters, but got ${responseBody.epicNarrative.length}.`
          );
        }

        let allChaptersValid = true;
        responseBody.epicNarrative.forEach((chapter, index) => {
          const chapterNum = index + 1;
          if (
            typeof chapter.chapterEmoji !== 'string' ||
            typeof chapter.chapterStory !== 'string'
          ) {
            console.warn(
              `WARNING: Chapter ${chapterNum} has invalid structure:`,
              chapter
            );
            allChaptersValid = false;
          } else {
            console.log(
              `  Chapter ${chapterNum}: ${chapter.chapterEmoji} ${chapter.chapterStory}`
            );
          }
        });
        if (!allChaptersValid) {
          console.warn('One or more chapters had invalid structure.');
        }
      }
    } catch (error) {
      console.error('\nError during API call or processing response:', error);
    }
    console.log(`--- End Test Case: ${name} ---`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

testNarrativeEndpoint();
