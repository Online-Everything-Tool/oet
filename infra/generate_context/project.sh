#!/bin/bash

# infra/generate_context/project.sh

# Navigate to the project root directory (assuming the script is run from infra/generate_context)
cd "$(dirname "$0")/../.." || exit 1 # More robust way to get to root
PROJECT_ROOT=$(pwd) # Store the project root path

echo "Generating context from project root: $PROJECT_ROOT"

# --- Configuration ---

# Define specific files you *always* want to include (relative to project root)
# Even if they are also found in the scanned directories, they will only be included once.
SPECIFIC_FILES=(
  "README.md"
  "package.json"
  "TODO.md"
  "eslint.config.mjs"
  "next.config.ts"
  "app/layout.tsx"
  "app/page.tsx"
  "app/sw.ts"
  "app/globals.css"
)

# *** ADDED: Define files to explicitly exclude ***
EXCLUDE_FILES=(
  "src/constants/emojis-text.ts"
  "src/constants/html-entities-data.json"
  # Add other specific files to exclude here, e.g.,
  # "app/some/other/file/to/exclude.ts"
)
# ***********************************************

SCAN_DIRS=(
  "src"
  "app/api"
  "app/build-tool"
  "app/_components"
  "app/context"
  "app/lib"
  "app/history"
  "app/tool/_components" # For shared tool components like Range, FileSelectionModal
  "app/tool/_hooks"    # For shared tool hooks
  "infra/cloudformation"
  "infra/generate_context"
  "infra/analyze_context"
)


# Define directories/patterns to exclude from the 'tree' command
TREE_EXCLUDE_PATTERNS='node_modules|.next|*.log|dist|out|build|assets|infra/data|.git|.cache'


# Output file location (relative to project root)
OUTPUT_DIR="infra/data"
OUTPUT_FILE="$OUTPUT_DIR/project_context.txt"

# --- Script Logic ---

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR" || { echo "Error: Could not create output directory '$OUTPUT_DIR'"; exit 1; }

# Clear the output file
> "$OUTPUT_FILE" || { echo "Error: Could not clear output file '$OUTPUT_FILE'"; exit 1; }

echo "Gathering file list..."

# --- Find files in specified directories ---
FOUND_FILES=()
files_to_exclude_count=0 # Counter for excluded files

# Helper function to check if an element is in an array
containsElement () {
  local e match="$1"
  shift
  for e; do [[ "$e" == "$match" ]] && return 0; done
  return 1
}

for dir in "${SCAN_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "Scanning directory: $dir"
    while IFS= read -r -d $'\0' file; do
      # *** MODIFIED: Check against EXCLUDE_FILES before adding ***
      if containsElement "$file" "${EXCLUDE_FILES[@]}"; then
        echo "  Excluding specific file: $file"
        files_to_exclude_count=$((files_to_exclude_count + 1))
      else
        FOUND_FILES+=("$file")
      fi
      # *********************************************************
    done < <(find "$dir" -type f -print0)
  else
    echo "Warning: Scan directory not found: $dir" # Corrected typo
  fi
done
echo "Found ${#FOUND_FILES[@]} files in scanned directories (after excluding ${files_to_exclude_count} specific files)."

# --- Combine specific files and found files, then deduplicate and exclude again ---
# The SPECIFIC_FILES might contain something that's also in EXCLUDE_FILES,
# so we need to filter EXCLUDE_FILES from SPECIFIC_FILES too if that's the intent.
# For now, assuming EXCLUDE_FILES primarily targets what's found by `find`.
# If SPECIFIC_FILES should also be filtered by EXCLUDE_FILES, that's a more complex merge.

# Create a temporary array for files that are truly specific and not in EXCLUDE_FILES
TEMP_SPECIFIC_FILES=()
for specific_file in "${SPECIFIC_FILES[@]}"; do
    if ! containsElement "$specific_file" "${EXCLUDE_FILES[@]}"; then
        TEMP_SPECIFIC_FILES+=("$specific_file")
    else
        echo "  Note: Specific file '$specific_file' is in EXCLUDE_FILES, it will not be included."
        files_to_exclude_count=$((files_to_exclude_count + 1)) # Count it if specific file is excluded
    fi
done


ALL_FILES_RAW=("${TEMP_SPECIFIC_FILES[@]}" "${FOUND_FILES[@]}")
mapfile -t ALL_FILES < <(printf "%s\n" "${ALL_FILES_RAW[@]}" | sort -u)
echo "Total unique files to include (after all exclusions and deduplication): ${#ALL_FILES[@]}"


# --- Generate Header and Tree ---
echo "Generating project context header and structure..."
{
  echo "Project Root: $PROJECT_ROOT"
  echo "Generated on: $(date)"
  echo ""
  echo "Important Rule Reminder: Please print whole files when making code changes. Ensure all remnant comments, placeholder comments, or inactive commented-out code are completely removed from the final output to avoid confusion."
  echo ""
  echo "--- Project Structure (up to depth 3, excluding common patterns) ---"
  echo ""
} >> "$OUTPUT_FILE"

# Add tree command output
if command -v tree &> /dev/null; then
  # Update tree exclude pattern to include public/api and public/data
  EFFECTIVE_TREE_EXCLUDE_PATTERNS="${TREE_EXCLUDE_PATTERNS}|public/api|public/data"
  tree -L 4 -I "$EFFECTIVE_TREE_EXCLUDE_PATTERNS" >> "$OUTPUT_FILE" 2>/dev/null || echo "  (tree command ran but failed)" >> "$OUTPUT_FILE"
else
  echo "  (tree command not found, skipping structure view)" >> "$OUTPUT_FILE"
fi

{
  echo ""
  echo "--- END Project Structure ---"
  echo ""
} >> "$OUTPUT_FILE"


# --- Append File Contents ---
echo "Appending file contents..."
processed_count=0
skipped_count=0 # This counts files not found, not ones intentionally excluded by EXCLUDE_FILES
for FILE_PATH in "${ALL_FILES[@]}"; do # Renamed loop variable to avoid conflict
  # Double check if file is in EXCLUDE_FILES again, just in case it came from SPECIFIC_FILES and wasn't caught
  # This check is redundant if TEMP_SPECIFIC_FILES logic correctly filters SPECIFIC_FILES
  # but it's a safe guard.
  # if containsElement "$FILE_PATH" "${EXCLUDE_FILES[@]}"; then
  #   echo "  Skipping due to EXCLUDE_FILES (safeguard): $FILE_PATH"
  #   continue
  # fi

  if [ -f "$FILE_PATH" ]; then
    echo "  Appending: $FILE_PATH"
    {
      echo "--- FILE: $FILE_PATH ---"
      echo ""
      cat "$FILE_PATH"
      echo ""
      echo "--- END FILE: $FILE_PATH ---"
      echo ""
    } >> "$OUTPUT_FILE"
    processed_count=$((processed_count + 1))
  else
      echo "  Skipping (Not Found): $FILE_PATH"
      {
          echo "--- FILE: $FILE_PATH (Not Found during processing) ---"
          echo ""
      } >> "$OUTPUT_FILE"
      skipped_count=$((skipped_count + 1))
  fi
done

# --- Final Summary ---
echo "--------------------------------------"
echo "Project context generation complete."
echo "Output file: $OUTPUT_FILE"
echo "Files processed: $processed_count"
echo "Specific files explicitly excluded: ${files_to_exclude_count}" # New summary line
echo "Files skipped (not found): $skipped_count"
echo "--------------------------------------"

# ... (clipboard copy logic) ...