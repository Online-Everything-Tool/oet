#!/bin/bash

QUEUE_URL="https://sqs.us-east-1.amazonaws.com/822884795371/oet"
REGION="us-east-1"
REPO_DIR="/home/ubuntu/oet"
UPDATE_SCRIPT_PATH="$REPO_DIR/incoming_sqs_update.sh"
LOG_FILE="/home/ubuntu/log/oet_sqs_checker.log"

log_message() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_message "Cron job started: Checking SQS for new messages."

if ! command -v aws &> /dev/null; then
    log_message "ERROR: AWS CLI command could not be found. Exiting."
    exit 1
fi

MESSAGE_OUTPUT=$(/usr/local/bin/aws sqs receive-message \
  --queue-url "$QUEUE_URL" \
  --max-number-of-messages 1 \
  --region "$REGION" \
  --wait-time-seconds 1 2>&1)

if [ $? -ne 0 ]; then
  log_message "ERROR: Failed to receive message from SQS: $MESSAGE_OUTPUT"
  exit 1
fi

RECEIPT_HANDLE=$(echo "$MESSAGE_OUTPUT" | /usr/bin/jq -r '.Messages[0].ReceiptHandle // empty')

if [ -z "$RECEIPT_HANDLE" ]; then
  log_message "No new messages in SQS queue. Nothing to do."
  exit 0
fi

log_message "Message received from SQS (ReceiptHandle: $RECEIPT_HANDLE). Triggering update script."

if [ -f "$UPDATE_SCRIPT_PATH" ]; then
  log_message "Executing update script: $UPDATE_SCRIPT_PATH"
  bash "$UPDATE_SCRIPT_PATH"
  UPDATE_SCRIPT_EXIT_CODE=$?

  if [ $UPDATE_SCRIPT_EXIT_CODE -ne 0 ]; then
    log_message "ERROR: Update script at $UPDATE_SCRIPT_PATH failed with exit code $UPDATE_SCRIPT_EXIT_CODE."
    log_message "WARNING: SQS Message with ReceiptHandle $RECEIPT_HANDLE will NOT be deleted due to update script failure."
    exit 1
  else
    log_message "Update script completed successfully."
  fi
else
  log_message "ERROR: Update script not found at $UPDATE_SCRIPT_PATH."
  log_message "WARNING: SQS Message with ReceiptHandle $RECEIPT_HANDLE will NOT be deleted."
  exit 1
fi

log_message "Deleting message from SQS (ReceiptHandle: $RECEIPT_HANDLE)..."
aws sqs delete-message --queue-url "$QUEUE_URL" --receipt-handle "$RECEIPT_HANDLE" --region "$REGION"
if [ $? -ne 0 ]; then
  log_message "ERROR: Failed to delete message from SQS (ReceiptHandle: $RECEIPT_HANDLE)."
  exit 1 
fi

log_message "Message deleted successfully. SQS check complete."
exit 0