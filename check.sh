TOOL_DIRECTIVE="diff-checker"
PATTERN_FILE=".github/tool-directive-patterns.txt"
MATCH_FOUND=false
if [ ! -f "$PATTERN_FILE" ]; then 
    echo "::error::Pattern file not found."; 
    echo "check_passed=false" >> $GITHUB_OUTPUT; 
    exit 1; 
fi
while IFS= read -r pattern || [[ -n "$pattern" ]]; do 
    if echo "$TOOL_DIRECTIVE" | grep -q -E -- "$pattern"; then 
        MATCH_FOUND=true; break; fi; done < <(grep -v '^#' "$PATTERN_FILE" | grep -v '^$')
if $MATCH_FOUND; then 
    echo "check_passed=true" >> $GITHUB_OUTPUT; 
else 
    echo "::error::Directive does not match patterns."; 
    echo "check_passed=false" >> $GITHUB_OUTPUT; 
    exit 1; 
fi

