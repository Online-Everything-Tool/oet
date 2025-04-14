#!/bin/bash

# infra/analyze_context/tool.sh
# Reads .env file for API key, loads the base project context AND the tool context,
# asks Gemini to analyze the tool code for LoC estimate and consistency metrics (1-100 scale),
# adds the model name used, and saves the JSON to public/data/tool_analysis.json.

# --- Configuration ---
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)" # Determine project root relative to script location
PROJECT_CONTEXT_FILE="$PROJECT_ROOT/infra/data/project_context.txt" # Context for overall project standards
TOOL_CONTEXT_FILE="$PROJECT_ROOT/infra/data/tool_context.txt"       # Context for the specific tools' code
TOOL_ANALYSIS_OUTPUT_FILE="$PROJECT_ROOT/public/data/tool_analysis.json" # Output file for this analysis
ENV_FILE="$PROJECT_ROOT/.env"

# --- Gemini Configuration ---
API_KEY="${GEMINI_API_KEY}" # Loaded later from .env or environment
# Use environment variable ANALYSIS_MODEL_NAME if set, otherwise default
DEFAULT_MODEL_NAME="gemini-1.5-flash-latest" # Or "gemini-1.5-pro-latest"
MODEL_NAME="${ANALYSIS_MODEL_NAME:-$DEFAULT_MODEL_NAME}"

# --- The Tool Analysis Question (Updated for 1-100 Scale) ---
# Note: The final 'modelNameUsed' field is added by *this* script, not requested from the AI.
TOOL_ANALYSIS_QUESTION=$(cat <<- 'EOF'
You are provided with two contexts:
1.  **Project Context:** Contains overall project information like README rules, core configuration, layout, global styles (`globals.css`), potentially HistoryContext, and the build-tool implementation. This represents the project's standards and patterns.
2.  **Tool Context:** Contains the actual source code for various tools located under `app/t/`.

Based on *both* contexts provided:

Analyze the code within the **Tool Context**. For all tools collectively present in the **Tool Context**:

1.  Estimate the approximate total `linesOfCode` (number). Count only lines within the files provided in the **Tool Context**. This is an estimation based on the text provided.
2.  Assess the `codeConsistency` (number, scale **1-100**, where 100 is highly consistent). Evaluate how well the tool code (from **Tool Context**) adheres to general React/TypeScript patterns, uses client components (`'use client'`) where appropriate, follows the file structure seen (if discernible), and aligns with the overall project setup implied by the **Project Context**. Consider adherence to the directive naming rules mentioned in the README (part of **Project Context**).
3.  Assess the `cssConsistency` (number, scale **1-100**, where 100 is highly consistent). Evaluate how well the tool code (from **Tool Context**) utilizes Tailwind CSS classes and potentially the CSS variables defined in `globals.css` (found in **Project Context**). Penalize use of excessive inline styles or custom CSS that doesn't align with the project's styling approach.

Respond ONLY with a single JSON object adhering strictly to the following structure (the 'modelNameUsed' field will be added by the calling script, do not generate it):
{
  "linesOfCode": <Estimated_Number>,
  "codeConsistency": <Consistency_Score_1_to_100>,
  "cssConsistency": <CSS_Consistency_Score_1_to_100>
}
Do not include any explanatory text, rationale, or markdown formatting before or after the JSON object. Ensure the output is valid JSON containing only these three numeric fields based on your analysis.
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

# --- Check Context Files ---
if [ ! -f "$PROJECT_CONTEXT_FILE" ]; then
    echo "Error: Project context file '$PROJECT_CONTEXT_FILE' not found." >&2; exit 1
fi
if [ ! -f "$TOOL_CONTEXT_FILE" ]; then
    echo "Error: Tool context file '$TOOL_CONTEXT_FILE' not found." >&2; exit 1
fi
echo "Checked context files exist." # Confirmation message

# --- Prepare API Request ---
API_ENDPOINT="https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}"
echo "Preparing JSON payload for Gemini..."

# Use jq --rawfile to load large context files directly into jq variables, avoiding ARG_MAX limit
# Note: Context file contents are no longer read into shell variables first.
JSON_PAYLOAD=$(jq -n \
  --rawfile project_context "$PROJECT_CONTEXT_FILE" \
  --rawfile tool_context "$TOOL_CONTEXT_FILE" \
  --arg question "$TOOL_ANALYSIS_QUESTION" \
  '{
     "contents": [
       {
         "role": "user",
         "parts": [
           { "text": "=== START PROJECT CONTEXT ===\n\n" },
           { "text": $project_context },
           { "text": "\n\n=== END PROJECT CONTEXT ===\n\n" },
           { "text": "=== START TOOL CONTEXT ===\n\n" },
           { "text": $tool_context },
           { "text": "\n\n=== END TOOL CONTEXT ===\n\n" },
           { "text": "Based on BOTH contexts provided above, please fulfill the following request:\n\n" },
           { "text": $question }
         ]
       }
     ],
     "generationConfig": {
       "responseMimeType": "application/json",
       "temperature": 0.4, # Slightly lower temp for more deterministic analysis
       "maxOutputTokens": 1024 # Reduced max tokens as output is small JSON
     },
     "safetySettings": [
        { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
        { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
        { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
        { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" }
     ]
   }')

# Check if jq failed (e.g., file not found error within jq)
JQ_EXIT_CODE=$?
if [ $JQ_EXIT_CODE -ne 0 ]; then
    echo "Error: jq command failed to construct JSON payload. Exit code: $JQ_EXIT_CODE" >&2
    # jq might have printed an error, or it could be a file issue.
    exit 1
fi

# Optional: Check if payload is empty (shouldn't happen if jq succeeded, but as a safeguard)
if [ -z "$JSON_PAYLOAD" ]; then
    echo "Error: JSON_PAYLOAD generation resulted in an empty string." >&2
    exit 1
fi
echo "JSON payload prepared successfully."

# --- Call Gemini API ---
echo "Sending project and tool contexts to Gemini (${MODEL_NAME}) for tool analysis..."
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
echo "--- Gemini Tool Analysis Result (JSON with Model Name) ---"
echo "$FINAL_JSON" | jq '.' # Pretty print final JSON to terminal
echo "--- End Tool Analysis ---"
echo ""

# Ensure the output directory exists just before writing
mkdir -p "$(dirname "$TOOL_ANALYSIS_OUTPUT_FILE")"

# Write the final, validated, pretty-printed JSON directly to the target file
echo "Writing final tool analysis JSON to $TOOL_ANALYSIS_OUTPUT_FILE..."
# Use jq '.' again to ensure the output file is pretty-printed
echo "$FINAL_JSON" | jq '.' > "$TOOL_ANALYSIS_OUTPUT_FILE"
WRITE_EXIT_CODE=$?

if [ $WRITE_EXIT_CODE -eq 0 ]; then
  echo "Successfully wrote tool analysis to $TOOL_ANALYSIS_OUTPUT_FILE"
else
  echo "Error: Failed to write tool analysis to $TOOL_ANALYSIS_OUTPUT_FILE" >&2
  exit 1
fi

exit 0