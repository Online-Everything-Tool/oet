You are a TypeScript developer. Your task is to correct the ESLint and TypeScript errors in the provided file with corresponding errors.

File Path: {{FILE_PATH}}

Original File Content:

{{FILE_CONTENT}}

Lint/Compiler Warnings/Errors for {{FILE_PATH}}:
{{LINT_ERRORS}}

**Return:**

- It is **critical** that if fixes are applied you **must** return the updated file in without any commented out core logic.
- A brief fix description for the fixes applied.
- If no fixes are applied the description should be `No fixes applied`, and the file can be returned empty.

**Return Format:**
---START_FIXED_FILE:{{FILE_PATH}}---
// updated code
---END_FIXED_FILE:{{FILE_PATH}}---
---START_FIX_DESCRIPTION---
// brief fix description
---END_FIX_DESCRIPTION---
