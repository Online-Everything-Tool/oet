#!/bin/bash

# Script to remove comments (ignoring first line) and collapse blank lines.
# Version 9: Ignores "// eslint" comments.

# --- SAFETY WARNING ---
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
echo "!! WARNING: This script will modify files in place.         !!"
echo "!! >> TEST ON COPIES FIRST <<                             !!"
echo "!! Ensure your code is backed up or committed to Git first. !!"
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
read -p "Press Enter to continue, or Ctrl+C to abort..."

echo "Starting comment removal (ignoring first line, preserving '// eslint') and blank line collapsing (v9)..."

# --- Define Target Directories as an Array ---
TARGET_DIRS=(
    "app/"
    "src/"
    "scripts/"
    # Add more directories here if needed
)
# --- End Target Directories ---

TMP_FILE_COMMENTS=$(mktemp)
TMP_FILE_BLANKS=$(mktemp)

echo "Target directories:"
for dir in "${TARGET_DIRS[@]}"; do
    echo "  - $dir"
done
echo "Searching for .ts and .tsx files..."

find "${TARGET_DIRS[@]}" -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | while IFS= read -r -d $'\0' file; do

    if [ ! -f "$file" ]; then
        echo "  -> Skipping non-file: $file"
        continue
    fi

    echo "Processing: $file"

    # Step 1: Remove comments (lines 2+), but preserve lines starting with "// eslint"
    # The new logic uses a pattern to NOT match lines starting with // eslint
    sed -e '
    2,$ {
        # If the line starts with optional whitespace then // eslint, do nothing (branch to end)
        /^[[:space:]]*\/\/ eslint/{b}
        # If the line starts with optional whitespace then // prettier, do nothing (branch to end)
        /^[[:space:]]*\/\/ prettier/{b}
        
        # Case 1: Comment starts at the beginning of the line (preceded by potential whitespace)
        s,^[[:space:]]*//.*$,,
        # Case 2: Comment follows some code/text (preceded by potential whitespace)
        s,[[:space:]]//.*$,,
    }
    ' "$file" > "$TMP_FILE_COMMENTS"

    # Check if comment removal produced any output before proceeding
    if [ ! -s "$TMP_FILE_COMMENTS" ] && [ -s "$file" ]; then
        echo "  -> WARNING: Comment removal resulted in empty output for non-empty file. Skipping $file"
        truncate -s 0 "$TMP_FILE_COMMENTS" 
        continue 
    fi

    # Step 2: Collapse blank lines from first temp file into second temp file
    sed '/^$/N;/\n$/D' "$TMP_FILE_COMMENTS" > "$TMP_FILE_BLANKS"

    if [ ! -s "$TMP_FILE_BLANKS" ] && [ -s "$TMP_FILE_COMMENTS" ]; then
        echo "  -> INFO: Blank line collapsing resulted in empty output (likely okay). Continuing for $file"
    fi

    # Step 3: If all checks passed, overwrite original file using mv
    mv "$TMP_FILE_BLANKS" "$file"
     if [ $? -ne 0 ]; then
        echo "  -> ERROR: Failed to overwrite $file with mv. Check permissions or temp file state."
    else
        echo "  -> Processed successfully."
    fi

    truncate -s 0 "$TMP_FILE_COMMENTS"

done

rm -f "$TMP_FILE_COMMENTS" "$TMP_FILE_BLANKS" 

echo "Processing finished."
echo "Run 'npm run format' and 'npm run lint -- --fix' next."
echo "Please review the changes using 'git diff' or your backup."

exit 0