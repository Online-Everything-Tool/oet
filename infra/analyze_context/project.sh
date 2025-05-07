#!/bin/bash

# infra/analyze_context/project.sh
# Reads .env file for API key, loads the pre-generated base project context
# (expected to include history/build-tool details), asks Gemini to generate a
# structured analysis (tagline, desc, benefits, suggestions) and adds the
# model name used, saving the final JSON to public/data/project_analysis.json.

# --- Configuration ---
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)" # Determine project root relative to script location
BASE_CONTEXT_FILE="$PROJECT_ROOT/infra/data/project_context.txt"
ANALYSIS_OUTPUT_FILE="$PROJECT_ROOT/public/data/project_analysis.json"
ENV_FILE="$PROJECT_ROOT/.env"

# --- Gemini Configuration ---
API_KEY="${GEMINI_API_KEY}" # Loaded later from .env or environment
# Use environment variable ANALYSIS_MODEL_NAME if set, otherwise default
DEFAULT_MODEL_NAME="gemini-1.5-flash-latest" # Or "gemini-1.5-pro-latest"
MODEL_NAME="${ANALYSIS_MODEL_NAME:-$DEFAULT_MODEL_NAME}"

# --- The Analysis Question (Refined v5 - Explicit Naming Rule Reinforcement) ---
# Note: The final 'modelNameUsed' field is added by *this* script, not requested from the AI.
ANALYSIS_QUESTION=$(cat <<- 'EOF'
Analyze the provided project context which includes base configuration, layout, home page (showing existing tools), global styles, HistoryContext, and the build-tool feature.
Based *only* on the information given:

1.  Generate a catchy, concise `siteTagline` (string, max 15 words) reflecting the tool's overall value proposition.
2.  Generate a `siteDescription` (string, exactly **2 sentences**) summarizing the application's purpose ("Online everything tool - largest assortment of free client-based utilities") and target audience.
3.  Infer a list of user `siteBenefits` (array of strings). Focus on the *value* provided, not just listing features. Examples: "Access a wide variety of utilities in one place", "Transform data quickly using client-side processing", "Track your past operations with the History feature", "Contribute new tools easily via the AI-assisted build process", "Works offline for many tools due to PWA setup". Derive these from the purpose, included tools, PWA config, history, and build-tool features shown in the context.
4.  **Brainstorm `suggestedNewToolDirectives` (array of strings): Based on the project's goal of being a comprehensive suite of *client-side utilities* and the *types* of tools already present (data transformation, generation, exploration - e.g., 'base64-converter', 'hash-generator', 'json-validator-formatter', 'emoji-explorer'), suggest exactly 5 potential *new* tool directives that would logically fit and expand the suite. Focus on common developer, data manipulation, or text utility tasks suitable for client-side implementation. Return these suggestions as an array of strings, using lowercase kebab-case. **Crucially, ensure the directives strictly follow the `<thing>-<operation>` or `<thing>-<operation>-<operation>` pattern (e.g., "diff-checker", "regex-tester", "color-picker", "jwt-debugger", "markdown-previewer") and explicitly avoid prepositions like 'to', 'for', 'with' or articles like 'a', 'an', 'the' within the directive name itself.**

Respond ONLY with a single JSON object adhering strictly to the following structure (the 'modelNameUsed' field will be added by the calling script, do not generate it):
{
  "siteTagline": "<Generated Tagline>",
  "siteDescription": "<Generated Description>",
  "siteBenefits": ["<Benefit 1>", "<Benefit 2>", "..."],
  "suggestedNewToolDirectives": ["<suggestion-1>", "<suggestion-2>", "<suggestion-3>", "<suggestion-4>", "<suggestion-5>"]
}
Do not include any explanatory text before or after the JSON object you generate. Do not use markdown formatting like ```json. Ensure the output is valid JSON based on the fields you generate.
EOF
)

# --- Prerequisite Checks ---
if ! command -v curl &> /dev/null; then echo "Error: curl is not installed." >&2; exit 1; fi
if ! command -v jq &> /dev/null; then echo "Error: jq is not installed." >&2; exit 1; fi
echo "Prerequisites met (curl, jq)."

# --- Load .env file ---
if [ -f "$ENV_FILE" ]; then
    echo "Loading environment variables from $ENV_FILE"
    set -a # Automatically export all variables subsequently defined or modified
    # Source the file, filtering out comments and blank lines
    source <(grep -vE '^\s*(#|$)' "$ENV_FILE")
    set +a # Turn off auto-export
else
    echo "Warning: $ENV_FILE file not found. Relying on environment variables." >&2
fi

# --- Check for API Key ---
API_KEY="${GEMINI_API_KEY}" # Re-assign after potential sourcing from .env
if [ -z "$API_KEY" ]; then echo "Error: GEMINI_API_KEY is not set in environment or .env file." >&2; exit 1; fi
echo "GEMINI_API_KEY loaded."
echo "Using Gemini Model: ${MODEL_NAME}" # Confirm which model is being used

# --- Check Base Context File ---
if [ ! -f "$BASE_CONTEXT_FILE" ]; then
    echo "Error: Base context file '$BASE_CONTEXT_FILE' not found." >&2; exit 1
fi
echo "Base context file found: $BASE_CONTEXT_FILE"

# --- Prepare API Request ---
API_ENDPOINT="https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}"

# Use jq --rawfile to load the large context file directly into a jq variable
# The content of $BASE_CONTEXT_FILE will be available as the jq variable $context
JSON_PAYLOAD=$(jq -n \
  --rawfile context "$BASE_CONTEXT_FILE" \
  --arg question "$ANALYSIS_QUESTION" \
  '{
     "contents": [
       {
         "role": "user",
         "parts": [
           { "text": "Here is the project context for analysis:\n\n" },
           { "text": $context }, # Use the jq variable $context, populated by --rawfile
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

# Check if jq failed (e.g., file not found error within jq itself)
JQ_EXIT_CODE=$?
if [ $JQ_EXIT_CODE -ne 0 ]; then
    echo "Error: jq command failed to construct JSON payload. Exit code: $JQ_EXIT_CODE" >&2
    # jq might have printed an error related to --rawfile if $BASE_CONTEXT_FILE was not found by jq
    exit 1
fi

# Optional: Check if payload is empty (shouldn't happen if jq succeeded, but as a safeguard)
if [ -z "$JSON_PAYLOAD" ]; then
    echo "Error: JSON_PAYLOAD generation resulted in an empty string." >&2
    exit 1
fi


# --- Call Gemini API ---
echo "Sending context to Gemini (${MODEL_NAME}) for brainstorming JSON analysis..."
# Pipe the JSON payload directly to curl using -d @-
API_RESPONSE=$(echo "$JSON_PAYLOAD" | curl -s -X POST -H "Content-Type: application/json" \
    -d @- \
    "$API_ENDPOINT")
CURL_EXIT_CODE=$?

if [ $CURL_EXIT_CODE -ne 0 ]; then echo "Error: curl command failed with exit code $CURL_EXIT_CODE." >&2; exit 1; fi

# --- Process API Response ---
# Check for explicit error object in the response
if echo "$API_RESPONSE" | jq -e '.error' > /dev/null; then
    echo "Error: Gemini API returned an error:" >&2
    echo "$API_RESPONSE" | jq '.error' # Output the error details
    exit 1
fi

# Extract the text content safely, handling potential nulls
RAW_ANALYSIS_TEXT=$(echo "$API_RESPONSE" | jq -r '.candidates[0].content.parts[0].text // empty')

# Check if the extracted text is empty (could be due to blocking or other issues)
if [ -z "$RAW_ANALYSIS_TEXT" ]; then
    BLOCK_REASON=$(echo "$API_RESPONSE" | jq -r '.promptFeedback.blockReason // empty')
    FINISH_REASON=$(echo "$API_RESPONSE" | jq -r '.candidates[0].finishReason // empty') # Check finishReason too
     if [ -n "$BLOCK_REASON" ]; then echo "Error: Request blocked by API. Reason: $BLOCK_REASON" >&2;
    elif [[ "$FINISH_REASON" == "SAFETY" ]]; then echo "Error: Response blocked by API (Finish Reason: SAFETY)." >&2;
    elif [[ "$FINISH_REASON" == "MAX_TOKENS" ]]; then echo "Error: Response truncated by API (MAX_TOKENS). Consider increasing maxOutputTokens in generationConfig." >&2;
    elif [[ "$FINISH_REASON" == "OTHER" ]]; then echo "Error: Response stopped by API for other reasons (Finish Reason: OTHER)." >&2;
    else echo "Error: No analysis text received from API. Finish Reason: ${FINISH_REASON:-Unknown}" >&2;
         echo "Raw Response: $API_RESPONSE" >&2; # Dump raw response for debugging
    fi
    exit 1
fi

# Attempt to parse the extracted text as JSON, suppressing jq's own error output
PARSED_JSON=$(echo "$RAW_ANALYSIS_TEXT" | jq -e '.' 2> /dev/null)
JQ_EXIT_CODE=$?

if [ $JQ_EXIT_CODE -ne 0 ]; then
    echo "Error: Gemini response was not valid JSON." >&2
    echo "Raw Response Text from Gemini:" >&2
    echo "$RAW_ANALYSIS_TEXT" >&2
    exit 1
fi

# --- Add Model Name and Finalize JSON ---
echo "Adding model name (${MODEL_NAME}) to the result..."
# Add the modelNameUsed field using jq
FINAL_JSON=$(echo "$PARSED_JSON" | jq --arg model "$MODEL_NAME" '. + {modelNameUsed: $model}')

# --- Output and Save Analysis ---
echo ""
echo "--- Gemini Analysis Result (JSON with Model Name) ---"
echo "$FINAL_JSON" | jq '.' # Pretty print final JSON to terminal
echo "--- End Analysis ---"
echo ""

# Ensure the output directory exists just before writing
mkdir -p "$(dirname "$ANALYSIS_OUTPUT_FILE")"

# Write the final, validated, pretty-printed JSON directly to the target file
echo "Writing final analysis JSON to $ANALYSIS_OUTPUT_FILE..."
# Use jq '.' again to ensure the output file is pretty-printed
echo "$FINAL_JSON" | jq '.' > "$ANALYSIS_OUTPUT_FILE"
WRITE_EXIT_CODE=$?

if [ $WRITE_EXIT_CODE -eq 0 ]; then
  echo "Successfully wrote analysis to $ANALYSIS_OUTPUT_FILE"
else
  echo "Error: Failed to write analysis to $ANALYSIS_OUTPUT_FILE" >&2
  exit 1
fi

exit 0