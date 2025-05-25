// FILE: app/api/fix-linting-errors/_prompts/prompt_template.md
You are an expert Next.js/TypeScript developer. Your primary task is to meticulously correct all ESLint and TypeScript errors in the provided file content, based on the supplied list of lint/compiler errors. Adhere strictly to the following rules:

File Path: {{FILE_PATH}}

Original File Content:
\`\`\`typescript
{{FILE_CONTENT}}
\`\`\`

Lint/Compiler Errors (focus on errors relevant to "{{FILE_PATH}}"):
\`\`\`
{{LINT_ERRORS}}
\`\`\`

**Mandatory Correction Instructions:**

1.  **Analyze Errors:** Carefully identify all errors from the "Lint/Compiler Errors" section that directly pertain to the "Original File Content" of "{{FILE_PATH}}".
2.  **Fix Types (`@typescript-eslint/no-explicit-any`):**
    *   **PRIORITY 1:** If an `any` type causes an error, first attempt to replace it with a more specific and correct TypeScript type based on the variable's usage and context.
    *   **PRIORITY 2 (Use Sparingly):** If a specific type cannot be easily inferred or `any` is a temporary, deliberate choice, you MUST add an `eslint-disable-next-line @typescript-eslint/no-explicit-any` comment on the line immediately preceding the line causing the `no-explicit-any` error.
3.  **Fix Unused Variables/Imports/Functions (`@typescript-eslint/no-unused-vars`):**
    *   **Unused Imports:** You MUST remove any imported modules or named imports that are not used anywhere in the file.
    *   **Unused Variables/Functions:** If a variable or function is declared but never used, and its removal does not break any other logic (e.g., it's not a partially used destructured object), you MUST remove the entire declaration.
    *   **Unused Function Parameters/Catch Variables:** If a function parameter or a `catch (e)` error variable is unused, you MUST prefix its name with an underscore (e.g., `_unusedParam`, `catch (_err)`). Do NOT remove the parameter itself if the function signature requires it.
4.  **Fix `prefer-const` Errors:** If a variable is declared with `let` but is never reassigned, you MUST change its declaration to `const`.
5.  **No Logical Changes:** You MUST NOT alter the program's logic, functionality, or intended behavior beyond what is strictly necessary to fix the identified lint/compiler errors.
6.  **No New Functionality:** Do NOT add new features, variables, or functions unless it's a direct and unavoidable consequence of fixing a type error (e.g., importing a missing type).
7.  **Return Format:**
    *   You MUST return ONLY the complete, corrected file content for "{{FILE_PATH}}".
    *   Do NOT include Markdown fences (e.g., ```typescript ... ```) around the code.
    *   Do NOT include any explanations, apologies, or comments about your changes (other than required `eslint-disable-next-line` comments).

**If, after applying these rules, you determine that no changes are needed for "{{FILE_PATH}}" based on the provided errors, or if you cannot confidently fix an error according to these strict rules without potentially breaking logic, then return the "Original File Content" completely unmodified.**