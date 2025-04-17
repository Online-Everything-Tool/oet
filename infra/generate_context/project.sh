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
  "CONTRIBUTING.md"
  "LICENSE"
  "TODO.md"
  "eslint.config.mjs"
  "next.config.ts"
  "app/layout.tsx"
  "app/page.tsx"
  "app/sw.ts"
  "app/globals.css"
)

SCAN_DIRS=(
  "src"        
  "app/api"
  "app/build-tool"
  "app/_components"
  "app/context"
  "app/lib"
  "app/history"
  "infra/cloudformation"
  "infra/generate_context"
  "infra/analyze_context"
)

# Define directories/patterns to exclude from the 'tree' command
TREE_EXCLUDE_PATTERNS='node_modules|.next|*.log|dist|out|build|assets|public/assets|infra/data|.git|.cache'

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
for dir in "${SCAN_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "Scanning directory: $dir"
    # Use find to get all files (-type f) within the directory.
    # -print0 and mapfile handle filenames with spaces/newlines safely.
    while IFS= read -r -d $'\0' file; do
      FOUND_FILES+=("$file")
    done < <(find "$dir" -type f -print0)
  else
    echo "Warning: Scatxtn directory not found: $dir"
  fi
done
echo "Found ${#FOUND_FILES[@]} files in scanned directories."

# --- Combine specific files and found files, then deduplicate ---
# Use printf and sort -u for robust deduplication
ALL_FILES_RAW=("${SPECIFIC_FILES[@]}" "${FOUND_FILES[@]}")
mapfile -t ALL_FILES < <(printf "%s\n" "${ALL_FILES_RAW[@]}" | sort -u)
echo "Total unique files to include: ${#ALL_FILES[@]}"

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
  tree -L 4 -I "$TREE_EXCLUDE_PATTERNS" >> "$OUTPUT_FILE" 2>/dev/null || echo "  (tree command ran but failed)" >> "$OUTPUT_FILE"
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
skipped_count=0
for FILE in "${ALL_FILES[@]}"; do
  if [ -f "$FILE" ]; then
    echo "  Appending: $FILE"
    {
      echo "--- FILE: $FILE ---"
      echo ""
      # Using cat. Consider alternatives like head/tail for very large binary files if needed.
      cat "$FILE"
      echo "" # Add a newline after file content just in case file doesn't end with one
      echo "--- END FILE: $FILE ---"
      echo ""
    } >> "$OUTPUT_FILE"
    processed_count=$((processed_count + 1))
  else
      echo "  Skipping (Not Found): $FILE"
      {
          echo "--- FILE: $FILE (Not Found during processing) ---"
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
echo "Files skipped (not found): $skipped_count"
echo "--------------------------------------"

# Optional: Copy directly to clipboard (uncomment the relevant line)
# echo "Attempting to copy to clipboard..."
# if command -v pbcopy &> /dev/null; then # macOS
#   pbcopy < "$OUTPUT_FILE" && echo "Copied to macOS clipboard."
# elif command -v xclip &> /dev/null; then # Linux/X11
#    xclip -selection clipboard < "$OUTPUT_FILE" && echo "Copied to X11 clipboard via xclip."
# elif command -v wl-copy &> /dev/null; then # Linux/Wayland
#    wl-copy < "$OUTPUT_FILE" && echo "Copied to Wayland clipboard via wl-copy."
# else
#   echo "Clipboard command (pbcopy, xclip, wl-copy) not found."
# fi