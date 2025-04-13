#!/bin/bash

# infra/analyze_context/project.sh
# Reads .env file for API key, loads the pre-generated base project context
# (expected to include history/build-tool details), asks Gemini to generate a
# structured analysis (tagline, desc, benefits, suggestions) and adds the
# model name used, saving the final JSON to public/data/project_analysis.json.

# --- Configuration ---
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)" # Determine project root relative to script
BASE_CONTEXT_FILE="$PROJECT_ROOT/infra/data/project_context.txt"
ANALYSIS_OUTPUT_FILE="$PROJECT_ROOT/public/data/project_analysis.json"
ENV_FILE="$PROJECT_ROOT/.env"

# --- Gemini Configuration ---
API_KEY="${GEMINI_API_KEY}" # Loaded later from .env or environment
MODEL_NAME="gemini-1.5-flash-latest" # Or gemini-1.5-pro-latest

# --- The Analysis Question (Refined v4 - Brainstorming + Added modelNameUsed to example) ---
ANALYSIS_QUESTION=$(cat <<- 'EOF'
Analyze the provided project context which includes base configuration, layout, home page (showing existing tools), global styles, HistoryContext, and the build-tool feature.
Based *only* on the information given:

1.  Generate a catchy, concise `siteTagline` (string, max 15 words) reflecting the tool's overall value proposition.
2.  Generate a `siteDescription` (string, exactly **2 sentences**) summarizing the application's purpose ("Online everything tool - largest assortment of free client-based utilities") and target audience.
3.  Infer a list of user `siteBenefits` (array of strings). Focus on the *value* provided, not just listing features. Examples: "Access a wide variety of utilities in one place", "Transform data quickly using client-side processing", "Track your past operations with the History feature", "Contribute new tools easily via the AI-assisted build process", "Enjoy a consistent experience with Shoelace components", "Works offline for many tools due to PWA setup". Derive these from the purpose, included tools, PWA config, history, and build-tool features shown in the context.
4.  **Brainstorm `suggestedNewToolDirectives` (array of strings): Based on the project's goal of being a comprehensive suite of *client-side utilities* and the *types* of tools already present (data transformation, generation, exploration - e.g., 'base64-converter', 'hash-generator', 'json-validator-formatter', 'emoji-explorer'), suggest exactly 5 potential *new* tool directives that would logically fit and expand the suite. Focus on common developer, data manipulation, or text utility tasks suitable for client-side implementation. Return these suggestions as an array of strings, using lowercase kebab-case format (e.g., "diff-checker", "regex-tester", "color-picker", "jwt-debugger", "markdown-previewer").**

Respond ONLY with a single JSON object adhering strictly to the following structure (the 'modelNameUsed' field will be added by the calling script, do not generate it):
{
  "siteTagline": "<Generated Tagline>",
  "siteDescription": "<Generated Description>",
  "siteBenefits": ["<Benefit 1>", "<Benefit 2>", "..."],
  "suggestedNewToolDirectives": ["<suggestion-1>", "<suggestion-2>", "<suggestion-3>", "<suggestion-4>", "<suggestion-5>"],
  "modelNameUsed": "<This will be added by the script>" 
}
Do not include any explanatory text before or after the JSON object you generate. Do not use markdown formatting like ```json. Ensure the output is valid JSON based on the fields you generate.
EOF
)


# --- Prerequisite Checks ---
if ! command -v curl &> /dev/null; then echo "Error: curl is not installed."; exit 1; fi
if ! command -v jq &> /dev/null; then echo "Error: jq is not installed."; exit 1; fi

# --- Load .env file ---
if [ -f "$ENV_FILE" ]; then
    echo "Loading environment variables from $ENV_FILE"
    set -a
    source <(grep -v '^#' "$ENV_FILE" | grep -v '^$')
    set +a
else
    echo "Warning: $ENV_FILE file not found. Relying on environment variables."
fi

# --- Check for API Key ---
API_KEY="${GEMINI_API_KEY}"
if [ -z "$API_KEY" ]; then echo "Error: GEMINI_API_KEY is not set."; exit 1; fi
echo "GEMINI_API_KEY loaded."

# --- Check Base Context File ---
if [ ! -f "$BASE_CONTEXT_FILE" ]; then
    echo "Error: Base context file '$BASE_CONTEXT_FILE' not found."; exit 1
fi

# --- Read Base Context ---
echo "Reading base context (including History/Build-Tool) from $BASE_CONTEXT_FILE..."
CONTEXT_CONTENT=$(<"$BASE_CONTEXT_FILE")
if [ -z "$CONTEXT_CONTENT" ]; then echo "Error: Context file '$BASE_CONTEXT_FILE' is empty."; exit 1; fi
echo "Context read successfully (${#CONTEXT_CONTENT} characters)."

# --- Prepare API Request ---
API_ENDPOINT="https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}"

JSON_PAYLOAD=$(jq -n \
  --arg context "$CONTEXT_CONTENT" \
  --arg question "$ANALYSIS_QUESTION" \
  '{
     "contents": [
       {
         "role": "user",
         "parts": [
           { "text": "Here is the project context for analysis:\n\n" },
           { "text": $context },
           { "text": "\n\nBased *only* on the context provided above, please fulfill the following request:\n\n" },
           { "text": $question }
         ]
       }
     ],
     "generationConfig": {
       "responseMimeType": "application/json",
       "temperature": 0.6, 
       "maxOutputTokens": 2048
     },
     "safetySettings": [
        { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
        { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
        { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
        { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" }
     ]
   }')

# --- Call Gemini API ---
echo "Sending context to Gemini (${MODEL_NAME}) for brainstorming JSON analysis..."
API_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \
    -d "$JSON_PAYLOAD" \
    "$API_ENDPOINT")
CURL_EXIT_CODE=$?

if [ $CURL_EXIT_CODE -ne 0 ]; then echo "Error: curl command failed: $CURL_EXIT_CODE."; exit 1; fi

# --- Process API Response ---
if echo "$API_RESPONSE" | jq -e '.error' > /dev/null; then
    echo "Error: Gemini API returned an error:"
    echo "$API_RESPONSE" | jq '.error'
    exit 1
fi

RAW_ANALYSIS_TEXT=$(echo "$API_RESPONSE" | jq -r '.candidates[0].content.parts[0].text // empty')

if [ -z "$RAW_ANALYSIS_TEXT" ]; then
    BLOCK_REASON=$(echo "$API_RESPONSE" | jq -r '.promptFeedback.blockReason // empty')
    FINISH_REASON=$(echo "$API_RESPONSE" | jq -r '.candidates[0].finishReason // empty')
     if [ -n "$BLOCK_REASON" ]; then echo "Error: Request blocked. Reason: $BLOCK_REASON";
    elif [[ "$FINISH_REASON" == "SAFETY" ]]; then echo "Error: Response blocked (Finish Reason: SAFETY).";
    elif [[ "$FINISH_REASON" == "MAX_TOKENS" ]]; then echo "Error: Response truncated (MAX_TOKENS). Increase maxOutputTokens?";
    else echo "Error: No analysis text received. Finish Reason: ${FINISH_REASON:-Unknown}"; echo "Raw Response: $API_RESPONSE"; fi
    exit 1
fi

# Attempt to parse the extracted text as JSON
PARSED_JSON=$(echo "$RAW_ANALYSIS_TEXT" | jq -e '.' 2> /dev/null)
JQ_EXIT_CODE=$?

if [ $JQ_EXIT_CODE -ne 0 ]; then
    echo "Error: Gemini response was not valid JSON."
    echo "Raw Response Text from Gemini:"
    echo "$RAW_ANALYSIS_TEXT"
    exit 1
fi

# --- Add Model Name and Finalize JSON ---
echo "Adding model name (${MODEL_NAME}) to the result..."
FINAL_JSON=$(echo "$PARSED_JSON" | jq --arg model "$MODEL_NAME" '. + {modelNameUsed: $model}')

# --- Output and Save Analysis ---
echo ""
echo "--- Gemini Analysis Result (JSON with Model Name) ---"
echo "$FINAL_JSON" | jq '.' # Pretty print final JSON to terminal
echo "--- End Analysis ---"
echo ""

# Ensure the output directory exists
mkdir -p "$(dirname "$ANALYSIS_OUTPUT_FILE")"

# Write the final, validated, pretty-printed JSON directly to the target file
echo "Writing final analysis JSON to $ANALYSIS_OUTPUT_FILE..."
echo "$FINAL_JSON" | jq '.' > "$ANALYSIS_OUTPUT_FILE"

if [ $? -eq 0 ]; then
  echo "Successfully wrote analysis to $ANALYSIS_OUTPUT_FILE"
else
  echo "Error: Failed to write analysis to $ANALYSIS_OUTPUT_FILE"
  exit 1
fi

exit 0