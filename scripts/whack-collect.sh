#!/bin/bash
# scripts/whack-collect.sh

# Check if a PR number is provided as the first argument
if [ -z "$1" ]; then
  echo "Error: PR Number argument is required."
  echo "Usage: $0 <PR_NUMBER>"
  exit 1
fi

PR_NUMBER="$1"

LOG_DIR_PATH="./_data/pr_status_logs_pr${PR_NUMBER}" # Corrected line

if [ ! -d "$LOG_DIR_PATH" ]; then
  echo "Error: Log directory not found: $LOG_DIR_PATH"
  echo "Ensure the PR number is correct and logs exist."
  exit 1
fi

for file in $(ls -v "${LOG_DIR_PATH}/status_"*.json); do # Corrected line
  echo "--- START OF FILE: $(basename "$file") ---"
  cat "$file"
  echo "" # Add a newline for better separation
  echo "--- END OF FILE: $(basename "$file") ---"
  echo "" # Add another newline
done
