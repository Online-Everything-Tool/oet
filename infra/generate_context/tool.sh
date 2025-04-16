#!/bin/bash

# infra/generate_context/tool.sh
# Generates a context file containing the source code of all tools under app/tool/

# Navigate to the project root directory (assuming the script is run from infra/generate_context)
cd "$(dirname "$0")/../.." || exit 1 # Go up two levels from infra/generate_context

# --- Configuration ---
TOOL_BASE_DIR="app/tool"
OUTPUT_DIR="infra/data"
OUTPUT_FILE="$OUTPUT_DIR/tool_context.txt"
# Directories within TOOL_BASE_DIR to exclude (e.g., shared components)
EXCLUDE_DIRS=() # Example excluded directories
# --- End Configuration ---

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR" || { echo "Error: Could not create output directory '$OUTPUT_DIR'" >&2; exit 1; }

# Clear the output file
> "$OUTPUT_FILE" || { echo "Error: Could not clear output file '$OUTPUT_FILE'" >&2; exit 1; }

echo "Generating context for tools in $TOOL_BASE_DIR..." >> "$OUTPUT_FILE"
echo "Outputting to $OUTPUT_FILE" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Check if the base tool directory exists
if [ ! -d "$TOOL_BASE_DIR" ]; then
  echo "Error: Tool directory '$TOOL_BASE_DIR' not found." >&2
  exit 1
fi

# --- Find and Process Tool Directories ---
# Use find to locate immediate subdirectories of TOOL_BASE_DIR
find "$TOOL_BASE_DIR" -mindepth 1 -maxdepth 1 -type d | while IFS= read -r TOOL_DIR; do
  # Get the base name of the tool directory (the directive)
  DIRECTIVE_NAME=$(basename "$TOOL_DIR")

  # --- Check Exclusion ---
  EXCLUDE=0
  for EXCL in "${EXCLUDE_DIRS[@]}"; do
    if [[ "$DIRECTIVE_NAME" == "$EXCL" ]]; then
      EXCLUDE=1
      echo "Skipping excluded directory: $TOOL_DIR" >> "$OUTPUT_FILE"
      continue 2 # Skip to the next directory found by find (outer loop)
    fi
  done

  if [[ $EXCLUDE -eq 1 ]]; then
    continue # Skip to the next directory found by find (outer loop)
  fi

  echo "--- START TOOL DIRECTORY: $DIRECTIVE_NAME ---" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  echo "Directory Path: $TOOL_DIR" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"

  # --- Find and Process Files within the Tool Directory ---
  # Use find again to get all files within this specific tool directory (recursive)

  while IFS= read -r FILE; do
    # Get the relative path within the tool directory for cleaner header
    # Check if TOOL_DIR ends with a slash, handle if necessary (though find usually doesn't add it)
    if [[ "$TOOL_DIR" == */ ]]; then
      RELATIVE_PATH=${FILE#"$TOOL_DIR"}
    else
      RELATIVE_PATH=${FILE#"$TOOL_DIR/"}
    fi

    echo "--- FILE: $DIRECTIVE_NAME/$RELATIVE_PATH ---" >> "$OUTPUT_FILE"
    # Optionally include the full path: echo "--- FILE: $FILE ---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    if [ -f "$FILE" ]; then
      cat "$FILE" >> "$OUTPUT_FILE" || { echo "Error: Could not read file '$FILE'" >&2; }
    else
      # Should not happen if find worked, but as a safeguard
      echo "(File not found during processing: $FILE)" >> "$OUTPUT_FILE"
    fi
    echo "" >> "$OUTPUT_FILE"
    echo "--- END FILE: $DIRECTIVE_NAME/$RELATIVE_PATH ---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
  done < <(find "$TOOL_DIR" -type f) # Process substitution for inner find

  echo "--- END TOOL DIRECTORY: $DIRECTIVE_NAME ---" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  echo "Processed Tool Directory: $DIRECTIVE_NAME" >> "$OUTPUT_FILE"

done

echo "Tool context generation complete: $OUTPUT_FILE" >> "$OUTPUT_FILE"
echo "Project context generated in $OUTPUT_FILE"