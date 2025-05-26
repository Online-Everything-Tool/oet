// scripts/test-narrative.mjs
import fetch from 'node-fetch'; // Make sure to install node-fetch: npm install node-fetch

const API_ENDPOINT = 'http://localhost:3000/api/generate-modal-narrative'; // Adjust if your port is different

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
    // Optional fields omitted to test defaults
  };

  const testPayloadEmptyExamples = {
    toolDirective: 'color-palette-extractor',
    toolDescription:
      'Extracts the dominant colors from an uploaded image to create a color palette.',
    generationModelName: 'models/gemini-1.5-flash-latest',
    userAdditionalDescription: 'I want at least 5 colors, and their hex codes.',
    aiRequestedExamples: [], // Empty AI examples
    userSelectedExamples: [], // Empty user examples
  };

  console.log(`\n--- TESTING NARRATIVE ENDPOINT: ${API_ENDPOINT} ---\n`);

  const payloadsToTest = [
    { name: 'Full Payload', data: testPayload },
    { name: 'Minimal Payload (testing defaults)', data: testPayloadMinimal },
    { name: 'Payload with Empty Examples', data: testPayloadEmptyExamples },
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

      // const responseBody = await response.json();
      // console.log("\nResponse Body:");
      // console.log(JSON.stringify(responseBody, null, 2));

      // if (responseBody && responseBody.epicNarrative && Array.isArray(responseBody.epicNarrative)) {
      //   console.log(`\nNarrative generated with ${responseBody.epicNarrative.length} chapters.`);
      //   if (responseBody.epicNarrative.length !== 10) {
      //     console.warn(`WARNING: Expected 10 chapters, but got ${responseBody.epicNarrative.length}.`);
      //   }
      //   responseBody.epicNarrative.forEach((chapter, index) => {
      //     console.log(`  Chapter ${index + 1}: ${chapter.chapterEmoji} ${chapter.chapterStory}`);
      //   });
      // } else {
      //   console.warn("WARNING: epicNarrative not found or not an array in the response.");
      // }
    } catch (error) {
      console.error('\nError during API call:', error);
    }
    console.log(`--- End Test Case: ${name} ---\n`);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Small delay between tests if needed
  }
}

testNarrativeEndpoint();
