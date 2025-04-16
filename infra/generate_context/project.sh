#!/bin/bash

# infra/generate_context/project.sh

# Navigate to the project root directory (assuming the script is run from infra/generate_context)
cd "$(dirname "$0")/../.." || exit 1 # More robust way to get to root


# Define the files you want to include
FILES=(
  "README.md"
  "package.json"
  "next.config.ts"
  "app/layout.tsx"
  "app/page.tsx"
  "app/_components/BuildToolWidge.tsx"
  "app/_components/RecentlyUsedWidget.tsx"
  "app/_components/HistoryOutputPreview.tsx"
  "app/globals.css"
  "app/context/HistoryContext.tsx"
  "app/context/ImageLibraryContext.tsx"
  "app/lib/workers/thumbnail.worker.ts"
  "app/history/page.tsx"
  "app/build-tool/page.tsx"
  "app/build-tool/_components/ValidateDirective.tsx"
  "app/build-tool/_components/GenerateToolResources.tsx"
  "app/build-tool/_components/CreateAnonymousPr.tsx"
  "app/tool/_hooks/useToolUrlState.ts"
)

# Output file location
OUTPUT_DIR="infra/data"
OUTPUT_FILE="$OUTPUT_DIR/project_context.txt"

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Clear the output file
> "$OUTPUT_FILE"

echo "Project Structure:" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Important Rule Reminder: Please print whole files when making code changes. Ensure all remnant comments, placeholder comments, or inactive commented-out code are completely removed from the final output to avoid confusion." >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
# Add tree command output (Suggesting L3 for potentially less verbose output)
tree -L 3 -I 'node_modules|.next|*.log|dist|out|build|assets|public/assets|infra/data|.git|.cache' >> "$OUTPUT_FILE" 2>/dev/null || echo "  (tree command not found or failed)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "--- END Project Structure ---" >> "$OUTPUT_FILE" # Clearer separator
echo "" >> "$OUTPUT_FILE"

# Loop through files and append their content with separators
for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    echo "--- FILE: $FILE ---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    # Using head/tail might be better for very large files if needed, but cat is fine for now
    cat "$FILE" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "--- END FILE: $FILE ---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
  else
      echo "--- FILE: $FILE (Not Found) ---" >> "$OUTPUT_FILE"
      echo "" >> "$OUTPUT_FILE"
  fi
done

echo "Project context generated in $OUTPUT_FILE"
# Optional: Copy directly to clipboard (macOS/Linux with xclip/wl-copy)
# pbcopy < "$OUTPUT_FILE" # macOS
# xclip -selection clipboard < "$OUTPUT_FILE" # Linux/X11
# wl-copy < "$OUTPUT_FILE" # Linux/Wayland