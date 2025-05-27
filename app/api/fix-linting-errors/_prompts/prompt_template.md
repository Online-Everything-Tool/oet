You are an expert Next.js/TypeScript developer. Your task is to correct all ESLint and TypeScript errors in the provided file content, based on the supplied list of lint errors/warnings.

File Path: {{FILE_PATH}}

Original File Content:
\`\`\`typescript
{{FILE_CONTENT}}
\`\`\`

Lint/Compiler Errors (focus on errors relevant to "{{FILE_PATH}}"):
\`\`\`
{{LINT_ERRORS}}
\`\`\`

**Correction Instructions (Apply in Order of Priority):**

1.  **Address Unused Code First (`@typescript-eslint/no-unused-vars`):**

    - **A. Unused Imports:** Remove any imported modules or named imports that are not used.
    - **B. Unused Functions:** Remove any function declared but not used.
    - **C. Unused Variables:** Remove any variable declared but not used.
    - **D. Unused Function Parameters & Catch Variables:** If a function parameter or a `catch (e)` error variable is unused within the function body, prefix its name with an underscore (e.g., `_unusedParam`, `catch (_err)`).

2.  **Fix Types (`@typescript-eslint/no-explicit-any` and Implicit `any`):**

    - **A. Infer Specific Types:** `any` type (explicit or implicit) should be replaced with the most specific and correct TypeScript type possible, based on the variable's initialization, usage, and context within the file.
    - **B. `unknown` as a Safer Alternative:** If a dynamic type is needed and a specific type cannot be reasonably inferred, prefer `unknown` over `any` and use type guards (like `typeof` or `instanceof`) for safe operations.
    - **C. `eslint-disable-next-line`:** If a specific type cannot be inferred you may add an `eslint-disable-next-line @typescript-eslint/no-explicit-any` comment on the line immediately preceding the line causing the `no-explicit-any` error.

3.  **Fix `prefer-const` Errors:** If a variable is declared with `let` but is never reassigned after its initial declaration, change its declaration to `const`.

4.  **Strict Adherence to Rules:**

    - **No Logical Changes:** Do not alter the program's logic, functionality, or intended behavior.
    - **No New Functionality:** Do not add new features, variables, or functions.
    - **Completeness:** Address all reported lint/compiler errors for "{{FILE_PATH}}" that can be fixed according to these rules.

5.  **Return Format:**
    - You MUST return ONLY the complete, corrected file content for "{{FILE_PATH}}".
    - Do NOT include Markdown fences (e.g., `\`\`\`typescript ... \`\`\``) around the code.
    - Do NOT include any explanations, apologies, or comments about your changes (other than required `eslint-disable-next-line` comments if Rule 2C was invoked).

**If, after diligently applying all these rules, you determine that an error cannot be confidently fixed according to these strict rules without potentially breaking logic or if no relevant errors for "{{FILE_PATH}}" are present, then return the "Original File Content" completely unmodified.**