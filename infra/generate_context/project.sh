#!/bin/bash

# Navigate to the project root directory
cd "$(dirname "$0")/../.." || exit 1
PROJECT_ROOT=$(pwd)

echo "Generating contexts from project root: $PROJECT_ROOT"

# --- Configuration ---

# Output directory
OUTPUT_DIR_BASE="infra/data"
mkdir -p "$OUTPUT_DIR_BASE" || { echo "Error: Could not create output directory '$OUTPUT_DIR_BASE'"; exit 1; }

# --- General Project Context Configuration ---
CONTEXT_GENERAL_NAME="project_context"
SPECIFIC_FILES_GENERAL=(
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
SCAN_DIRS_GENERAL=(
  "src"
  # "app/api" # MOVED to Build Tool Context
  "app/_components"
  "app/context"
  "app/lib"
  "app/tool/_components"
  "app/tool/_hooks"
)

# --- Build Tool Context Configuration ---
CONTEXT_BUILD_TOOL_NAME="project_build_tool_context"
SPECIFIC_FILES_BUILD_TOOL=(
  # Add any build/tool specific top-level files if needed
)
SCAN_DIRS_BUILD_TOOL=(
  "app/build/tool"
  "app/api"
  "src/types"
)

# --- GitHub Actions Context Configuration ---
CONTEXT_ACTIONS_NAME="project_github_actions_context"
SPECIFIC_FILES_ACTIONS=(
  # No specific top-level files usually for actions
)
SCAN_DIRS_ACTIONS=(
  ".github/workflows"
)

# --- Global Configuration ---
# Files to explicitly exclude from ALL contexts
GLOBAL_EXCLUDE_FILES=(
  "src/constants/emojis.txt"
  "src/constants/html-entities-data.json"
  ".DS_Store"
  "*.log"
  # "package-lock.json" # Uncomment if you want to exclude lock files
  # "yarn.lock"
  "*.env"
  "*.env.local"
  "*.env.*.local"
)
# Exclude patterns for the 'tree' command
TREE_EXCLUDE_PATTERNS='node_modules|.next|dist|out|build|assets|infra/data|.git|.cache|public/api|public/data|coverage'
# Adjust tree depth for the project structure overview
TREE_DEFAULT_DEPTH=4


# --- Helper function to check if an element is in an array ---
containsElement () {
  local e match="$1"
  shift
  for e; do [[ "$e" == "$match" ]] && return 0; done
  return 1
}

# --- Main Processing Function for a Single Context ---
generate_single_context() {
  local context_name="$1"
  local -n specific_files_ref="$2" # Nameref to specific files array
  local -n scan_dirs_ref="$3"     # Nameref to scan dirs array

  local output_file="$OUTPUT_DIR_BASE/$context_name.txt"
  local temp_specific_files=()
  local found_files=()
  local all_files_raw=()
  local all_files=() # Final unique list for this context
  local files_excluded_this_context=0

  echo "--- Generating context: $context_name ---"
  echo "Output file: $output_file"

  # Clear the output file
  > "$output_file" || { echo "Error: Could not clear output file '$output_file'"; exit 1; }

  # Process SPECIFIC_FILES for this context
  echo "  Processing specific files for '$context_name'..."
  for sf in "${specific_files_ref[@]}"; do
    if ! containsElement "$sf" "${GLOBAL_EXCLUDE_FILES[@]}"; then
      if [ -f "$sf" ]; then
        temp_specific_files+=("$sf")
      else
        echo "    Warning: Specific file '$sf' for context '$context_name' not found."
      fi
    else
      echo "    Excluding specific file '$sf' due to GLOBAL_EXCLUDE_FILES for context '$context_name'."
      files_excluded_this_context=$((files_excluded_this_context + 1))
    fi
  done

  # Process SCAN_DIRS for this context
  echo "  Processing scan directories for '$context_name'..."
  for dir in "${scan_dirs_ref[@]}"; do
    if [ -d "$dir" ]; then
      echo "    Scanning directory: $dir"
      while IFS= read -r -d $'\0' file; do
        # Check against GLOBAL_EXCLUDE_FILES
        is_globally_excluded=false
        for ge_pattern in "${GLOBAL_EXCLUDE_FILES[@]}"; do
            if [[ "$file" == $ge_pattern ]]; then # Use == for glob matching
                is_globally_excluded=true
                break
            fi
        done

        if ! $is_globally_excluded; then
          found_files+=("$file")
        else
          echo "      Excluding '$file' due to GLOBAL_EXCLUDE_FILES from dir '$dir'."
          files_excluded_this_context=$((files_excluded_this_context + 1))
        fi
      done < <(find "$dir" -type f -print0)
    else
      echo "    Warning: Scan directory '$dir' for context '$context_name' not found."
    fi
  done

  # Combine, deduplicate
  all_files_raw=("${temp_specific_files[@]}" "${found_files[@]}")
  if [ ${#all_files_raw[@]} -gt 0 ]; then
    mapfile -t all_files < <(printf "%s\n" "${all_files_raw[@]}" | sort -u)
  fi
  echo "  Total unique files for '$context_name' (after global exclusions & deduplication): ${#all_files[@]}"

  # Generate Header
  {
    echo "Context Name: $context_name"
    echo "Project Root: $PROJECT_ROOT"
    echo "Generated on: $(date)"
    echo ""
    echo "Important Rule Reminder: Please print whole files when making code changes. Ensure all remnant comments, placeholder comments, or inactive commented-out code are completely removed from the final output to avoid confusion."
    echo ""
  } >> "$output_file"

  # --- Add Tree Structure ---
  if command -v tree &> /dev/null; then
    echo "--- Project Structure (Root: $PROJECT_ROOT, Depth: $TREE_DEFAULT_DEPTH, Exclusions: $TREE_EXCLUDE_PATTERNS) ---" >> "$output_file"
    echo "" >> "$output_file"
    tree -L "$TREE_DEFAULT_DEPTH" -a -f -N -I "$TREE_EXCLUDE_PATTERNS" --charset ascii >> "$output_file" 2>/dev/null || \
      { echo "  (tree command ran but may have failed or produced no output. Check exclude patterns or tree depth.)" >> "$output_file"; }
  else
    echo "  (tree command not found, skipping structure view)" >> "$output_file"
  fi
  {
    echo ""
    echo "--- END Project Structure ---"
    echo ""
  } >> "$output_file"


  # Append File Contents
  local processed_count_this_context=0
  local skipped_not_found_this_context=0
  if [ ${#all_files[@]} -gt 0 ]; then
    echo "  Appending file contents for '$context_name'..."
    for file_path_in_context in "${all_files[@]}"; do
      if [ -f "$file_path_in_context" ]; then
        {
          echo "--- FILE: $file_path_in_context ---"
          echo ""
          cat "$file_path_in_context"
          echo "" 
          echo "--- END FILE: $file_path_in_context ---"
          echo ""
        } >> "$output_file"
        processed_count_this_context=$((processed_count_this_context + 1))
      else
          echo "    Skipping (Not Found during processing): $file_path_in_context"
          {
              echo "--- FILE: $file_path_in_context (Not Found during processing for $context_name) ---"
              echo ""
          } >> "$output_file"
          skipped_not_found_this_context=$((skipped_not_found_this_context + 1))
      fi
    done
  fi

  # Summary for this context
  echo "  Context '$context_name' generation complete."
  echo "  Output file: $output_file"
  echo "  Files processed for '$context_name': $processed_count_this_context"
  echo "  Files globally excluded for '$context_name': $files_excluded_this_context"
  echo "  Files skipped (not found during processing) for '$context_name': $skipped_not_found_this_context"
  echo "--------------------------------------"
}

# --- Call the function for each context ---

# General Project Context
generate_single_context "$CONTEXT_GENERAL_NAME" SPECIFIC_FILES_GENERAL SCAN_DIRS_GENERAL

# Build Tool Context
generate_single_context "$CONTEXT_BUILD_TOOL_NAME" SPECIFIC_FILES_BUILD_TOOL SCAN_DIRS_BUILD_TOOL

# GitHub Actions Context
generate_single_context "$CONTEXT_ACTIONS_NAME" SPECIFIC_FILES_ACTIONS SCAN_DIRS_ACTIONS


echo "All primary context generation complete."
echo "See output files in $OUTPUT_DIR_BASE/"