#!/bin/bash

# infra/generate_context/tools.sh
# Generates individual context files for each specific tool under app/tool/,
# prepending the content of shared directories (app/tool/_*) to each.
# Output: infra/data/tool_context/<directive_snake_case>_context.txt.

# Navigate to the project root directory
cd "$(dirname "$0")/../.." || exit 1

# --- Configuration ---
TOOL_BASE_DIR="app/tool"
# Output directory for individual context files
OUTPUT_BASE_DIR="infra/data/tool_context"

EXCLUDE_DIRS=("_components" "_hooks")

# Ensure the base output directory exists
mkdir -p "$OUTPUT_BASE_DIR" || { echo "Error: Could not create output directory '$OUTPUT_BASE_DIR'" >&2; exit 1; }

# --- Check if the base tool directory exists ---
if [ ! -d "$TOOL_BASE_DIR" ]; then
  echo "Error: Tool directory '$TOOL_BASE_DIR' not found." >&2
  exit 1
fi

echo "Generating individual tool context files..."
echo "Base Tool Directory: $TOOL_BASE_DIR"
echo "Output Directory:    $OUTPUT_BASE_DIR"

processed_count=0
skipped_count=0

# --- Step 2: Find and Process Specific Tool Directories ---
# Use process substitution `< <(find ...)` for the main loop to ensure SHARED_CONTEXT_CONTENT is available
while IFS= read -r TOOL_DIR; do
  DIRECTIVE_NAME=$(basename "$TOOL_DIR")

  # --- Check Exclusion (Skip _* dirs in this loop) ---
  EXCLUDE=0
  for EXCL in "${EXCLUDE_DIRS[@]}"; do
    if [[ "$DIRECTIVE_NAME" == "$EXCL" ]]; then
      EXCLUDE=1
      skipped_count=$((skipped_count + 1))
      continue # Skip to the next directory in the find results
    fi
  done
  if [[ $EXCLUDE -eq 1 ]]; then
     echo "Skipping excluded/internal directory: $DIRECTIVE_NAME (already processed as shared or excluded)"
     continue
  fi


  # --- Determine Output Filename ---
  SNAKE_CASE_DIRECTIVE=$(echo "$DIRECTIVE_NAME" | tr '-' '_')
  TOOL_OUTPUT_FILE="$OUTPUT_BASE_DIR/${SNAKE_CASE_DIRECTIVE}_context.txt"

  echo "--------------------------------------"
  echo "Processing Tool: $DIRECTIVE_NAME -> $SNAKE_CASE_DIRECTIVE"
  echo "Outputting to: $TOOL_OUTPUT_FILE"

  # Clear/Create the specific output file for this tool
  > "$TOOL_OUTPUT_FILE" || { echo "Error: Could not clear output file '$TOOL_OUTPUT_FILE'" >&2; continue; } # Skip tool on error

  # --- Write Header and Shared Context ---
  {
    echo "Context for Tool: $DIRECTIVE_NAME"
    echo "Generated on: $(date)"
    echo "Source Directory: $TOOL_DIR"
    echo ""
    echo "--- START SHARED CONTEXT (app/tool/_*) ---"
    echo ""
    # Add the captured shared content directly from the variable
    echo -e "$SHARED_CONTEXT_CONTENT" # Use -e to interpret potential newlines correctly
    echo ""
    echo "--- END SHARED CONTEXT ---"
    echo ""
    echo "--- START TOOL-SPECIFIC CONTEXT ($DIRECTIVE_NAME) ---"
    echo ""
  } >> "$TOOL_OUTPUT_FILE"


  # --- Find and Append Tool-Specific Files ---
  files_found_in_tool=0
  while IFS= read -r FILE; do
    files_found_in_tool=$((files_found_in_tool + 1))
    if [[ "$TOOL_DIR" == */ ]]; then
      RELATIVE_PATH=${FILE#"$TOOL_DIR"}
    else
      RELATIVE_PATH=${FILE#"$TOOL_DIR/"}
    fi

    echo "  Adding specific file: $RELATIVE_PATH"
    # Append file content to the specific tool's context file
    {
      echo "--- FILE: $DIRECTIVE_NAME/$RELATIVE_PATH ---"
      echo ""
      cat "$FILE" || echo "[ERROR READING FILE: $FILE]" # Add error marker if cat fails
      echo ""
      echo "--- END FILE: $DIRECTIVE_NAME/$RELATIVE_PATH ---"
      echo ""
    } >> "$TOOL_OUTPUT_FILE"

  done < <(find "$TOOL_DIR" -type f) # Find files within the current tool's directory

  # Add marker if no specific files found
  if [ $files_found_in_tool -eq 0 ]; then
     echo "Warning: No specific files found within directory '$TOOL_DIR'."
     {
        echo "[No tool-specific source files found in this directory]"
        echo ""
     } >> "$TOOL_OUTPUT_FILE"
  fi

  # Add final marker for tool-specific section
  {
     echo "--- END TOOL-SPECIFIC CONTEXT ($DIRECTIVE_NAME) ---"
     echo ""
  } >> "$TOOL_OUTPUT_FILE"


  processed_count=$((processed_count + 1))

done < <(find "$TOOL_BASE_DIR" -mindepth 1 -maxdepth 1 -type d) # End of main loop using process substitution

echo "--------------------------------------"
echo "Tool context generation complete."
echo "Processed specific tool directories: $processed_count"
echo "Skipped internal/excluded directories: $skipped_count"
echo "Individual context files saved in: $OUTPUT_BASE_DIR"
echo "--------------------------------------"

exit 0