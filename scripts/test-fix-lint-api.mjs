// scripts/test-fix-lint-api.mjs
import fetch from 'node-fetch'; // Or use native fetch if your Node version supports it well enough
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url'; // To get __dirname in ES modules

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = 'http://localhost:3000';
const TEST_DATA_DIR = path.join(__dirname, '_data', 'fix-linting-errors');

async function callFixLintingApi(testCaseName, apiUrl, dataPayload) {
  console.log(`\n--- Running Test Case: ${testCaseName} ---`);
  console.log(`Sending POST request to ${apiUrl}`);
  // console.log('Payload:', JSON.stringify(dataPayload, null, 2)); // Uncomment for full payload logging
  console.log('---');

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dataPayload),
    });

    console.log(`[${testCaseName}] Status Code: ${response.status}`);
    console.log(`[${testCaseName}] Status Text: ${response.statusText}`);
    console.log('---');

    const responseBody = await response.json();
    console.log(`[${testCaseName}] Response Body:`);
    console.log(JSON.stringify(responseBody, null, 2));

    if (!response.ok) {
      console.error(
        `[${testCaseName}] API call FAILED with status: ${response.status}`
      );
    } else {
      console.log(`[${testCaseName}] API call SUCCEEDED.`);
      if (responseBody.success && responseBody.fixedFiles) {
        console.log(`\n[${testCaseName}] Fixed Files Output:`);
        for (const [filePath, content] of Object.entries(
          responseBody.fixedFiles
        )) {
          console.log(`\n--- File: ${filePath} ---`);
          if (content === null) {
            console.log('(AI processing failed or safety block for this file)');
          } else {
            // To keep logs cleaner, optionally truncate long content
            console.log(content);
          }
        }
      }
    }
  } catch (error) {
    console.error(`[${testCaseName}] Error making API call:`, error);
  }
  console.log(`--- Finished Test Case: ${testCaseName} ---\n`);
}

async function runAllTests() {
  const apiUrl = `${API_BASE_URL}/api/fix-linting-errors`;
  let testFiles;

  try {
    testFiles = await fs.readdir(TEST_DATA_DIR);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Test data directory not found: ${TEST_DATA_DIR}`);
      console.error('Please create the directory and add JSON test files.');
    } else {
      console.error('Error reading test data directory:', error);
    }
    return;
  }

  const jsonTestFiles = testFiles.filter((file) => file.endsWith('.json'));

  if (jsonTestFiles.length === 0) {
    console.warn(`No JSON test files found in ${TEST_DATA_DIR}`);
    return;
  }

  console.log(`Found ${jsonTestFiles.length} test file(s) in ${TEST_DATA_DIR}`);

  for (const testFile of jsonTestFiles) {
    const testFilePath = path.join(TEST_DATA_DIR, testFile);
    const testCaseName = path.basename(testFile, '.json'); // Use filename (without .json) as test case name

    try {
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      const testData = JSON.parse(fileContent);

      if (testData && testData.payload) {
        // Optional: Log description from the test file
        if (testData.description) {
          console.log(
            `\nDescription for ${testCaseName}: ${testData.description}`
          );
        }
        await callFixLintingApi(testCaseName, apiUrl, testData.payload);
      } else {
        console.warn(
          `Skipping ${testFile}: does not contain a 'payload' property or is invalid JSON.`
        );
      }
    } catch (error) {
      console.error(`Error processing test file ${testFile}:`, error);
    }
  }
  console.log('All test cases processed.');
}

runAllTests();
