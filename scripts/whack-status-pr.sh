#!/bin/bash

PR_NUMBER="220" # Or pass as an argument
API_URL="http://localhost:3000/api/status-pr" # Or your deployed API
OUTPUT_DIR="./pr_status_logs_pr${PR_NUMBER}"
POLL_INTERVAL_SECONDS=2 # How often to poll
MAX_ATTEMPTS=200 # Max polls to prevent infinite loop

mkdir -p "$OUTPUT_DIR"
echo "Starting to poll PR #$PR_NUMBER. Logs will be saved to $OUTPUT_DIR"
echo "Press Ctrl+C to stop."

for i in $(seq 1 $MAX_ATTEMPTS); do
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  FILENAME="${OUTPUT_DIR}/status_${TIMESTAMP}_attempt_${i}.json"
  
  echo "Attempt #$i at $(date): Fetching status for PR #$PR_NUMBER..."
  
  # Use curl to fetch and save the response. Add -s for silent, -f to fail silently on server errors (though we might want to see them)
  curl -s "${API_URL}?prNumber=${PR_NUMBER}&pollingAttempt=${i}" -o "$FILENAME"
  
  if [ $? -eq 0 ]; then
    echo "Successfully fetched and saved to $FILENAME"
    # Optionally, you can use `jq` here to display a summary or check a specific field
    # For example, to see the currentAutomationPhase (if your API adds it):
    # PHASE=$(jq -r '.automatedActions.nextExpectedAction' "$FILENAME") # Adjust path based on actual JSON output
    # echo "Current Next Expected Action: $PHASE"
    # if [ "$PHASE" == "USER_REVIEW_PREVIEW_READY" ] || [ "$PHASE" == "PR_MERGED" ] || [ "$PHASE" == "PR_CLOSED" ] || [[ "$PHASE" == MANUAL_REVIEW* ]]; then
    #   echo "Reached a terminal or manual review state. Stopping polling."
    #   break
    # fi
  else
    echo "Error fetching status (curl exit code: $?). Saved potential error output to $FILENAME."
    # Decide if you want to stop on error or continue
  fi
  
  # Add a small delay to allow API/GitHub events to propagate if testing rapid changes
  # sleep 2 
  echo "Waiting ${POLL_INTERVAL_SECONDS} seconds..."
  sleep $POLL_INTERVAL_SECONDS
done

echo "Finished polling PR #$PR_NUMBER."
