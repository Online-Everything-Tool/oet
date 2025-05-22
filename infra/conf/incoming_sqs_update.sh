#!/bin/bash

REPO_DIR=$(dirname "$0") # Assumes this script is in the repo root
LOG_FILE="/var/log/oet_code_update_action.log" # Separate log for actions
GIT_BRANCH="main"

export NVM_DIR="$HOME/.nvm" 
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') - NVM script not found at $NVM_DIR. Using system Node if available." | tee -a "$LOG_FILE"
fi

log_action() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_action "Update process initiated by SQS trigger."

cd "$REPO_DIR" || { 
  log_action "FATAL ERROR: Could not navigate to repository directory $REPO_DIR. Aborting update."
  exit 1 # Critical failure
}
log_action "Current directory: $(pwd)"

if command -v nvm &> /dev/null && [ -f ".nvmrc" ]; then
    log_action "Attempting to use Node version from .nvmrc..."
    NVM_USE_OUTPUT=$(nvm use 2>&1)
    if [ $? -ne 0 ]; then
        log_action "WARNING: nvm use failed or .nvmrc not effective: $NVM_USE_OUTPUT. Continuing with current Node version."
    else
        log_action "Successfully switched to Node version: $(node -v) using .nvmrc."
    fi
elif command -v nvm &> /dev/null ; then
    log_action "NVM sourced but no .nvmrc found in $REPO_DIR. Using current NVM Node version: $(node -v)"
else
    log_action "NVM not available or not sourced. Using system Node version: $(node -v)"
fi


log_action "Fetching latest changes for branch '$GIT_BRANCH'..."
git fetch origin "$GIT_BRANCH"
if [ $? -ne 0 ]; then
  log_action "ERROR: git fetch failed. Aborting update."
  exit 1
fi

log_action "Resetting to latest 'origin/$GIT_BRANCH'..."
GIT_PULL_OUTPUT=$(git reset --hard "origin/$GIT_BRANCH" 2>&1)
if [ $? -ne 0 ]; then
  log_action "ERROR: git reset --hard failed: $GIT_PULL_OUTPUT. Aborting update."
  exit 1
fi
log_action "Git reset successful: $GIT_PULL_OUTPUT"

log_action "Running npm run prebuild (to regenerate context files, etc.)..."
NPM_BUILD_OUTPUT=$(npm run prebuild 2>&1)
if [ $? -ne 0 ]; then
  log_action "ERROR: npm run prebuild failed: $NPM_BUILD_OUTPUT. Aborting update."
  exit 1
fi
log_action "npm run prebuild successful."


log_action "Update process completed successfully."
exit 0