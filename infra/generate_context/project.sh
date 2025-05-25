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
  "app/api"
  # "app/build-tool" # Moved to its own context
  "app/_components"
  "app/context"
  "app/lib"
  # "app/history" # This was already commented out / not found
  "app/tool/_components"
  "app/tool/_hooks"
)
# Files to explicitly exclude from ALL contexts (if a file shouldn't appear anywhere)
# This is useful for very large data files or binaries you never want in context.
GLOBAL_EXCLUDE_FILES=(
  "src/constants/emojis.txt"
  "src/constants/html-entities-data.json"
  ".DS_Store"
  "*.log"
  "*.lock" # e.g. package-lock.json if you don't want it
)
# Exclude patterns for the 'tree' command (common for all contexts if tree is used)
TREE_EXCLUDE_PATTERNS='node_modules|.next|dist|out|build|assets|infra/data|.git|.cache|public/api|public/data'

# --- Build Tool Context Configuration ---
CONTEXT_BUILD_TOOL_NAME="project_build_tool_context"
SPECIFIC_FILES_BUILD_TOOL=(
  # Add any build-tool specific top-level files if needed, e.g. a specific README for it
)
SCAN_DIRS_BUILD_TOOL=(
  "app/build-tool"
  # You might want to include relevant API endpoints if they are ONLY for the build tool
  # "app/api/generate-tool-resources" # Example: if this API is solely for build-tool
)
# If build tool context needs specific files from other general areas, add them here.
# For example, if a utility from app/lib is CRITICAL and unique to build-tool's understanding.
# Be mindful of duplication if not handled carefully. For now, assume SCAN_DIRS are distinct.

# --- GitHub Actions Context Configuration ---
CONTEXT_ACTIONS_NAME="project_github_actions_context"
SPECIFIC_FILES_ACTIONS=(
  # No specific top-level files usually for actions, they are found by scan_dirs
)
SCAN_DIRS_ACTIONS=(
  ".github/workflows"
)

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
  # Use namerefs to access arrays passed by name
  local -n specific_files_ref="$2"
  local -n scan_dirs_ref="$3"
  # local -n exclude_files_ref="$4" # If you had per-context exclude files

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
  for sf in "${specific_files_ref[@]}"; do
    if ! containsElement "$sf" "${GLOBAL_EXCLUDE_FILES[@]}"; then
      if [ -f "$sf" ]; then
        temp_specific_files+=("$sf")
      else
        echo "  Warning: Specific file '$sf' for context '$context_name' not found."
      fi
    else
      echo "  Excluding specific file '$sf' due to GLOBAL_EXCLUDE_FILES for context '$context_name'."
      files_excluded_this_context=$((files_excluded_this_context + 1))
    fi
  done

  # Process SCAN_DIRS for this context
  for dir in "${scan_dirs_ref[@]}"; do
    if [ -d "$dir" ]; then
      echo "  Scanning directory for '$context_name': $dir"
      while IFS= read -r -d $'\0' file; do
        if ! containsElement "$file" "${GLOBAL_EXCLUDE_FILES[@]}"; then
          # Add additional per-context exclusion logic here if needed
          # Example: if ! containsElement "$file" "${exclude_files_ref[@]}"; then ...
          found_files+=("$file")
        else
          echo "    Excluding '$file' due to GLOBAL_EXCLUDE_FILES from dir '$dir' for context '$context_name'."
          files_excluded_this_context=$((files_excluded_this_context + 1))
        fi
      done < <(find "$dir" -type f -print0) # -print0 and read -d are robust for weird filenames
    else
      echo "  Warning: Scan directory '$dir' for context '$context_name' not found."
    fi
  done

  # Combine, deduplicate
  all_files_raw=("${temp_specific_files[@]}" "${found_files[@]}")
  if [ ${#all_files_raw[@]} -gt 0 ]; then
    mapfile -t all_files < <(printf "%s\n" "${all_files_raw[@]}" | sort -u)
  fi
  echo "  Total unique files for '$context_name' (after global exclusions & deduplication): ${#all_files[@]}"

  # Generate Header and Tree
  {
    echo "Context Name: $context_name"
    echo "Project Root: $PROJECT_ROOT"
    echo "Generated on: $(date)"
    echo ""
    echo "Important Rule Reminder: Please print whole files when making code changes. Ensure all remnant comments, placeholder comments, or inactive commented-out code are completely removed from the final output to avoid confusion."
    echo ""
  } >> "$output_file"

  if [ "${#scan_dirs_ref[@]}" -gt 0 ] || [ "${#specific_files_ref[@]}" -gt 0 ]; then
    # Only add tree if there are scan dirs or specific files (relevant to this context)
    # You might want to customize the tree root or depth per context
    local tree_roots_for_context=("${scan_dirs_ref[@]}" $(printf "%s\n" "${specific_files_ref[@]}" | xargs -r dirname -z | sort -u | tr '\0' ' '))
    # Filter out "." if it appears due to root-level specific files
    tree_roots_for_context=(${tree_roots_for_context[@]///.})


    # Build a relevant tree structure.
    # This is a bit tricky. Option 1: Tree from project root, filtered. Option 2: Tree for each scan_dir.
    # For now, let's do a general tree and you can refine.
    if command -v tree &> /dev/null && [ ${#all_files[@]} -gt 0 ]; then # Only run tree if files are included
        echo "--- Structure Overview (relevant to $context_name, up to depth 4) ---" >> "$output_file"
        echo "" >> "$output_file"
        # This simple tree from root might be too broad for very specific contexts.
        # Consider `tree ${tree_roots_for_context[@]} ...` if you want more targeted trees,
        # but that can also be complex if roots overlap or are too numerous.
        tree -L 4 -P "$(IFS='|'; echo "${all_files[*]}")" --prune --matchdirs -I "$TREE_EXCLUDE_PATTERNS" >> "$output_file" 2>/dev/null || echo "  (tree command for $context_name ran but failed or produced no output for the pattern)" >> "$output_file"
        # Fallback if pattern matching is too complex or tree version doesn't support -P well with many files
        # tree -L 4 -I "$TREE_EXCLUDE_PATTERNS" >> "$output_file" 2>/dev/null
    else
        echo "  (tree command not found or no files to show structure for $context_name, skipping structure view)" >> "$output_file"
    fi
    {
      echo ""
      echo "--- END Structure Overview ($context_name) ---"
      echo ""
    } >> "$output_file"
  fi

  # Append File Contents
  local processed_count_this_context=0
  local skipped_not_found_this_context=0
  if [ ${#all_files[@]} -gt 0 ]; then
    echo "  Appending file contents for '$context_name'..."
    for file_path_in_context in "${all_files[@]}"; do
      if [ -f "$file_path_in_context" ]; then
        # echo "    Appending: $file_path_in_context" # Can be noisy
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
  echo "  Files explicitly excluded by GLOBAL_EXCLUDE_FILES for '$context_name': $files_excluded_this_context"
  echo "  Files skipped (not found) for '$context_name': $skipped_not_found_this_context"
  echo "--------------------------------------"
}

# --- Call the function for each context ---

# General Project Context
generate_single_context "$CONTEXT_GENERAL_NAME" SPECIFIC_FILES_GENERAL SCAN_DIRS_GENERAL # Add per-context excludes if needed

# Build Tool Context
generate_single_context "$CONTEXT_BUILD_TOOL_NAME" SPECIFIC_FILES_BUILD_TOOL SCAN_DIRS_BUILD_TOOL

# GitHub Actions Context
generate_single_context "$CONTEXT_ACTIONS_NAME" SPECIFIC_FILES_ACTIONS SCAN_DIRS_ACTIONS


echo "All context generation complete."